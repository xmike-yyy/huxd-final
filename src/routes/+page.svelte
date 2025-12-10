<script>
  import { onMount, afterUpdate } from 'svelte';
  import { conversations } from '$lib/stores/conversations.js';
  import { reflections } from '$lib/stores/reflections.js';
  import { withRetry } from '$lib/services/retry.js';

  let input = '';
  let isLoading = false;
  let showReflectionModal = false;
  let reflectionInput = '';
  let deleteConfirmSessionId = null;
  let renameSessionId = null;
  let renameInput = '';
  let isRecording = false;
  let recognition = null;
  let sttSupported = false;
  let finalTranscriptAccumulated = ''; // Track finalized speech text
  let chatContainerEl = null;
  let selectionVisible = false;
  let selectionText = '';
  let selectionTop = 0;
  let selectionLeft = 0;

  let isLeftSidebarOpen = true;
  let isRightSidebarOpen = true;

  // Auto-scroll logic
  afterUpdate(() => {
    if (chatContainerEl) {
      // Check if we were already near bottom before update to decide whether to auto-scroll
      const threshold = 150; // pixels from bottom
      const isNearBottom = chatContainerEl.scrollHeight - chatContainerEl.scrollTop - chatContainerEl.clientHeight <= threshold;
      
      // If we are sending (loading) or were already at the bottom, auto-scroll
      if (isNearBottom || isLoading) {
         chatContainerEl.scrollTo({ top: chatContainerEl.scrollHeight, behavior: 'smooth' });
      }
    }
  });

  // Reactive variables from store
  $: currentSession = $conversations.currentSessionId
    ? $conversations.sessions[$conversations.currentSessionId]
    : null;
  $: messages = currentSession?.messages || [];
  $: sessionList = Object.entries($conversations.sessions).map(([id, session]) => ({
    id,
    ...session
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // For real-time timestamp updates
  let now = Date.now();

  // Initialize with a session if none exists
  onMount(() => {
    if (!$conversations.currentSessionId) {
      conversations.createSession();
    }

    // Update timestamps every 30 seconds
    const interval = setInterval(() => {
      now = Date.now();
    }, 30000);

    // Setup speech recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      sttSupported = true;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        // Process all results to separate final and interim
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript + ' ';
          }
        }

        // Update accumulated final transcript only if we have new final text
        if (finalTranscript.trim()) {
          finalTranscriptAccumulated = finalTranscript.trim();
        }

        // Show combined final + latest interim
        input = (finalTranscriptAccumulated + ' ' + interimTranscript).trim();
      };

      recognition.onerror = () => {
        isRecording = false;
      };

      recognition.onend = () => {
        isRecording = false;
      };
    }

    return () => clearInterval(interval);
  });

  function startRecording() {
    if (!sttSupported || isRecording) return;
    input = ''; // reset for a fresh message
    finalTranscriptAccumulated = ''; // reset accumulated transcript
    isRecording = true;
    try {
      recognition?.start();
    } catch {
      isRecording = false;
    }
  }

  function stopRecording() {
    if (!sttSupported || !isRecording) return;
    try {
      recognition?.stop();
    } catch {
      // ignore
    } finally {
      isRecording = false;
    }
  }

  function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  function speakText(text) {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis?.speak(utterance);
    } catch {
      // no-op
    }
  }

  function onChatMouseUp() {
    // Defer to allow selection to register
    setTimeout(() => {
      const sel = window.getSelection && window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!chatContainerEl || !sel || !text) {
        selectionVisible = false;
        return;
      }
      const anchorOk = chatContainerEl.contains(sel.anchorNode);
      const focusOk = chatContainerEl.contains(sel.focusNode);
      if (!anchorOk || !focusOk) {
        selectionVisible = false;
        return;
      }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = chatContainerEl.getBoundingClientRect();
        // Position the toolbar slightly above the selection start
        selectionTop = Math.max(8, rect.top - containerRect.top - 36);
        selectionLeft = Math.min(
          Math.max(8, rect.left - containerRect.left),
          (containerRect.width - 160) // keep within container
        );
        selectionText = text;
        selectionVisible = true;
      } catch {
        selectionVisible = false;
      }
    }, 0);
  }

  function addSelectionToReflection() {
    if (!selectionText) return;
    const quote = `“${selectionText}”`;
    reflectionInput = reflectionInput ? `${reflectionInput}\n\n${quote}` : quote;
    showReflectionModal = true;
    selectionVisible = false;
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // ignore
    }
  }

  function clearSelectionToolbar() {
    selectionVisible = false;
  }

  async function send() {
    if (!input.trim() || isLoading) return;

    // Add user message with timestamp
    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };
    conversations.addMessage(userMessage);

    const userInput = input;
    input = '';
    isLoading = true;
    stopRecording();

    try {
      // Get current session ID and metrics (conversation-specific)
      const sessionId = $conversations.currentSessionId;
      const previousMetrics = currentSession?.metrics || null;

      // Filter reflections: send summary + only items newer than the summary
      const reflectionState = $reflections;
      const lastSummarized = reflectionState.lastSummarizedAt ? new Date(reflectionState.lastSummarizedAt) : new Date(0);
      
      const newReflections = reflectionState.items.filter(item => 
        new Date(item.createdAt) > lastSummarized
      );

      const reflectionContext = {
        summary: reflectionState.summary,
        items: newReflections
      };

      // Call API with session ID and previous metrics (with auto-retry)
      const data = await withRetry(async () => {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: messages.concat([userMessage]),
            sessionId: sessionId,
            previousMetrics: previousMetrics,
            reflectionContext: reflectionContext
          })
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.error || 'Request failed');
        }
        return body;
      }, { retries: 2, delayMs: 300, factor: 2 });

      // Update reflection summary if backend returned a new one
      if (data.updatedReflectionSummary) {
        reflections.updateSummary(data.updatedReflectionSummary);
      }

      // Add assistant message with timestamp
      const assistantMessage = {
        role: 'assistant',
        content: data.assistantMessage,
        frame: data.frame,
        timestamp: new Date().toISOString()
      };
      conversations.addMessage(assistantMessage);
      speakText(data.assistantMessage);

      // Update session metrics with the new metrics from the response
      if (data.metrics && sessionId) {
        conversations.updateSessionMetrics(sessionId, data.metrics);
      }
    } catch (err) {
      console.error('Send error:', err);
      alert('Failed to send message: ' + err.message);
      input = userInput; // Restore input
    } finally {
      isLoading = false;
    }
  }

  function saveReflection() {
    if (!reflectionInput.trim()) return;

    reflections.addReflection(reflectionInput);
    reflectionInput = '';
    showReflectionModal = false;
  }

  function confirmDelete(sessionId) {
    deleteConfirmSessionId = sessionId;
  }

  function cancelDelete() {
    deleteConfirmSessionId = null;
  }

  function executeDelete() {
    if (deleteConfirmSessionId) {
      conversations.deleteSession(deleteConfirmSessionId);
      deleteConfirmSessionId = null;
    }
  }

  function startRename(sessionId, currentTitle) {
    renameSessionId = sessionId;
    renameInput = currentTitle;
  }

  function cancelRename() {
    renameSessionId = null;
    renameInput = '';
  }

  function saveRename() {
    if (renameSessionId && renameInput.trim()) {
      conversations.updateSessionTitle(renameSessionId, renameInput.trim());
      renameSessionId = null;
      renameInput = '';
    }
  }

  function getFrameColor(frame) {
    switch (frame) {
      case 'reflective-listener':
        return '#E8F0FF';
      case 'clarity-coach':
        return '#FFF4E6';
      case 'momentum-partner':
        return '#FFE8EC';
      default:
        return '#F5F7FB';
    }
  }

  function getFrameName(frame) {
    switch (frame) {
      case 'reflective-listener':
        return 'Reflective Listener';
      case 'clarity-coach':
        return 'Clarity Coach';
      case 'momentum-partner':
        return 'Momentum Partner';
      default:
        return 'B-Me';
    }
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    const currentTime = new Date(now); // Use the reactive `now` variable
    const diffMs = currentTime - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
</script>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fb;
  }

  .app {
    display: grid;
    grid-template-columns: var(--left-w) minmax(300px, 1fr) var(--right-w);
    height: 100vh;
    gap: 0;
    transition: grid-template-columns 0.3s ease;
  }

  /* Sidebar Section */
  .sidebar {
    background: white;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e5e7eb;
    overflow: hidden;
  }
  
  .sidebar-content {
    width: 280px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .sidebar-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: #1e293b;
    margin-bottom: 1rem;
  }

  .new-chat-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .new-chat-btn:hover {
    background: #5568d3;
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .session-item {
    padding: 0.75rem 1rem;
    margin-bottom: 0.25rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    position: relative;
    color: #1e293b;
    font-size: 0.9rem;
  }

  .session-item:hover {
    background: #f1f5f9;
  }

  .session-item.active {
    background: #e8f0ff;
    border-left: 3px solid #667eea;
  }

  .session-item:hover .session-actions {
    opacity: 1;
  }

  .session-actions {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .session-rename,
  .session-delete {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    cursor: pointer;
  }

  .session-delete {
    background: #ef4444;
  }

  .session-rename:hover {
    background: #5568d3;
  }

  .session-delete:hover {
    background: #dc2626;
  }

  .session-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .session-date {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
  }

  .empty-sessions {
    text-align: center;
    color: #94a3b8;
    padding: 2rem 1rem;
    font-size: 0.9rem;
  }

  /* Chat Section */
  .chat-section {
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
    min-height: 0;
    overflow: hidden;
  }

  .header {
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 2rem;
    font-weight: bold;
    color: white;
  }

  .flower {
    font-size: 2.5rem;
  }

  .header-actions .about-btn {
    background: white;
    color: #667eea;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .header-actions .about-btn:hover {
    background: #eef2ff;
  }

  .chat-container {
    flex: 1;
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    position: relative;
    scroll-behavior: smooth;
  }

  .message-wrapper {
    display: flex;
    flex-direction: column;
    max-width: 75%;
    animation: fadeIn 0.2s ease-in;
  }

  .message-wrapper.user {
    align-self: flex-end;
  }

  .message-wrapper.assistant {
    align-self: flex-start;
  }

  .frame-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 0.25rem;
    padding-left: 0.5rem;
  }

  .message {
    padding: 1rem 1.25rem;
    border-radius: 12px;
    line-height: 1.6;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message.user {
    background: #e8f0ff;
    border: 1px solid #c7d2fe;
    color: #1e293b;
  }

  .message.assistant {
    border: 1px solid #e5e7eb;
    color: #1e293b;
  }

  .message-content {
    margin-bottom: 0.25rem;
  }

  .message-timestamp {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-top: 0.5rem;
    opacity: 0.8;
  }

  .message.user .message-timestamp {
    text-align: right;
  }

  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 3rem 1rem;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: #64748b;
  }

  .input-container {
    margin-top: 1rem;
    display: flex;
    gap: 0.75rem;
  }

  input {
    flex: 1;
    padding: 1rem 1.25rem;
    border: 2px solid white;
    border-radius: 12px;
    font-size: 1rem;
    background: white;
    outline: none;
  }

  input:focus {
    border-color: #667eea;
  }

  button {
    padding: 1rem 2rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #5568d3;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .typing {
    display: inline-flex;
    gap: 4px;
    padding: 0.5rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    background: #94a3b8;
    border-radius: 50%;
    animation: blink 1.4s infinite both;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes blink {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }

  /* Reflection Log Section */
  .reflection-section {
    background: white;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #e5e7eb;
    overflow: hidden;
  }
  
  .reflection-content-wrapper {
    width: 350px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .reflection-header {
    padding: 2rem 1.5rem 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .reflection-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e293b;
  }

  .reflections-list {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .reflection-card {
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 3px solid #667eea;
    position: relative;
  }

  .reflection-card:hover .delete-btn {
    opacity: 1;
  }

  .reflection-date {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  .reflection-content {
    color: #1e293b;
    line-height: 1.5;
    font-size: 0.9rem;
  }

  .delete-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .reflection-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .start-btn {
    width: 100%;
    padding: 1rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .start-btn:hover {
    background: #5568d3;
  }

  .empty-reflections {
    text-align: center;
    color: #94a3b8;
    padding: 2rem 1rem;
  }

  /* Selection toolbar */
  .selection-toolbar {
    position: absolute;
    background: #1f2937;
    color: white;
    border-radius: 10px;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    z-index: 10;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }
  .selection-toolbar button {
    background: #667eea;
    padding: 0.4rem 0.6rem;
    border-radius: 8px;
    font-size: 0.8rem;
  }
  .selection-toolbar button:hover {
    background: #5568d3;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal h3 {
    margin: 0 0 1rem 0;
    color: #1e293b;
  }

  .modal textarea {
    width: 100%;
    min-height: 150px;
    padding: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
  }

  .modal input[type="text"] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
  }

  .modal input[type="text"]:focus {
    border-color: #667eea;
  }

  .modal textarea:focus {
    border-color: #667eea;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .modal button {
    flex: 1;
  }

  .cancel-btn {
    background: #e5e7eb;
    color: #1e293b;
  }

  .cancel-btn:hover {
    background: #d1d5db;
  }

  .confirm-modal {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .confirm-modal p {
    color: #64748b;
    margin: 0.5rem 0 1.5rem 0;
    line-height: 1.5;
  }

  .delete-btn-confirm {
    background: #ef4444;
  }

  .delete-btn-confirm:hover {
    background: #dc2626;
  }

  @media (max-width: 1024px) {
    .app {
      grid-template-columns: 1fr !important;
      grid-template-rows: auto 1fr 300px;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
      max-height: 150px;
      width: 100% !important; /* Override fixed width if any issues */
    }

    .sidebar-content {
        width: 100%;
    }
    
    .reflection-content-wrapper {
        width: 100%;
    }

    .sessions-list {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .session-item {
      min-width: 200px;
    }

    .reflection-section {
      border-left: none;
      border-top: 1px solid #e5e7eb;
    }
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: white;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>

<div class="app" style="--left-w: {isLeftSidebarOpen ? '280px' : '0px'}; --right-w: {isRightSidebarOpen ? '350px' : '0px'};">
  <!-- Sidebar Section -->
  <div class="sidebar">
    <div class="sidebar-content">
      <div class="sidebar-header">
        <div class="sidebar-title">B-Me</div>
        <button class="new-chat-btn" on:click={() => conversations.createSession()}>
          + New Chat
        </button>
      </div>

      <div class="sessions-list">
        {#if sessionList.length === 0}
          <div class="empty-sessions">
            <p>No chats yet.</p>
            <p style="font-size: 0.8rem;">Start a conversation!</p>
          </div>
        {:else}
          {#each sessionList as session (session.id)}
            <div
              class="session-item {session.id === $conversations.currentSessionId ? 'active' : ''}"
              on:click={() => conversations.setCurrentSession(session.id)}
            >
              <div class="session-title">{session.title}</div>
              <div class="session-date">{formatDate(session.createdAt)}</div>
              <div class="session-actions">
                <button
                  class="session-rename"
                  on:click|stopPropagation={() => startRename(session.id, session.title)}
                >
                  Rename
                </button>
                <button
                  class="session-delete"
                  on:click|stopPropagation={() => confirmDelete(session.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- Chat Section -->
  <div class="chat-section">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="icon-btn" on:click={() => isLeftSidebarOpen = !isLeftSidebarOpen} title={isLeftSidebarOpen ? "Close Sidebar" : "Open Sidebar"}>
          {@html isLeftSidebarOpen ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>'}
        </button>
        <div class="logo">
          <span class="flower">✳</span>
          <span>B-Me</span>
        </div>
      </div>
      <div class="header-actions" style="display: flex; align-items: center; gap: 0.5rem;">
        <a class="about-btn" href="/about">About</a>
        <button class="icon-btn" on:click={() => isRightSidebarOpen = !isRightSidebarOpen} title={isRightSidebarOpen ? "Close Reflections" : "Open Reflections"}>
          {@html isRightSidebarOpen ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>'}
        </button>
      </div>
    </div>

    <div class="chat-container" bind:this={chatContainerEl} on:mouseup={onChatMouseUp} on:scroll={clearSelectionToolbar}>
      {#if selectionVisible}
        <div
          class="selection-toolbar"
          style="top:{selectionTop}px;left:{selectionLeft}px;"
        >
          <span>Add to reflections?</span>
          <button on:click={addSelectionToReflection}>Add</button>
        </div>
      {/if}
      {#if messages.length === 0}
        <div class="empty-state">
          <h2>Start a conversation</h2>
          <p>Share how you're feeling, and I'll adapt to support you.</p>
        </div>
      {/if}

      {#each messages as message}
        <div class="message-wrapper {message.role}">
          {#if message.role === 'assistant' && message.frame}
            <div class="frame-label">{getFrameName(message.frame)}</div>
          {/if}
          <div
            class="message {message.role}"
            style={message.role === 'assistant' && message.frame
              ? `background: ${getFrameColor(message.frame)}`
              : ''}
          >
            <div class="message-content">{message.content}</div>
            {#if message.timestamp}
              <div class="message-timestamp">{formatDate(message.timestamp)}</div>
            {/if}
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="message-wrapper assistant">
          <div class="message assistant">
            <div class="typing">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="input-container">
      <button on:click={toggleRecording} disabled={isLoading}>
        {#if isRecording}⏹ Stop{:else}🎙️ Record{/if}
      </button>
      <input
        type="text"
        placeholder={sttSupported ? (isRecording ? 'Listening...' : 'Press record and speak') : 'Voice not supported, type your message'}
        bind:value={input}
        on:keydown={(e) => !sttSupported && e.key === 'Enter' && send()}
        disabled={isLoading}
      />
      <button on:click={send} disabled={isLoading || !input.trim()}>Send</button>
    </div>
  </div>

  <!-- Reflection Log Section -->
  <div class="reflection-section">
    <div class="reflection-content-wrapper">
      <div class="reflection-header">
        <h2>Reflection Log</h2>
      </div>

      <div class="reflections-list">
        {#if $reflections.items.length === 0}
          <div class="empty-reflections">
            <p>No reflections yet.</p>
            <p style="font-size: 0.9rem;">Write down your thoughts and insights.</p>
          </div>
        {:else}
          {#each $reflections.items as reflection (reflection.id)}
            <div class="reflection-card">
              <div class="reflection-date">{formatDate(reflection.createdAt)}</div>
              <div class="reflection-content">{reflection.content}</div>
              <button class="delete-btn" on:click={() => reflections.deleteReflection(reflection.id)}>
                Delete
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <div class="reflection-footer">
        <button class="start-btn" on:click={() => (showReflectionModal = true)}>
          🖊 Start writing...
        </button>
        {#if showReflectionModal}
          <div style="margin-top: 1rem;">
            <textarea
              bind:value={reflectionInput}
              placeholder="What's on your mind? Write down your thoughts, insights, or feelings..."
              style="width: 100%; min-height: 120px; padding: 1rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; font-family: inherit; outline: none; box-sizing: border-box;"
            ></textarea>
            <div class="modal-actions" style="margin-top: 0.75rem;">
              <button class="cancel-btn" on:click={() => { showReflectionModal = false; reflectionInput = ''}}>Cancel</button>
              <button on:click={saveReflection}>Save Reflection</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Removed blocking Reflection Modal; editor is inline in the right panel -->

<!-- Delete Confirmation Modal -->
{#if deleteConfirmSessionId}
  <div class="modal-overlay" on:click={cancelDelete}>
    <div class="confirm-modal" on:click|stopPropagation>
      <h3>Delete Chat?</h3>
      <p>Are you sure you want to delete this chat? This action cannot be undone.</p>
      <div class="modal-actions">
        <button class="cancel-btn" on:click={cancelDelete}>Cancel</button>
        <button class="delete-btn-confirm" on:click={executeDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<!-- Rename Modal -->
{#if renameSessionId}
  <div class="modal-overlay" on:click={cancelRename}>
    <div class="modal" on:click|stopPropagation>
      <h3>Rename Chat</h3>
      <input
        type="text"
        bind:value={renameInput}
        placeholder="Enter new name..."
        autofocus
        on:keydown={(e) => e.key === 'Enter' && saveRename()}
      />
      <div class="modal-actions">
        <button class="cancel-btn" on:click={cancelRename}>Cancel</button>
        <button on:click={saveRename}>Save</button>
      </div>
    </div>
  </div>
{/if}