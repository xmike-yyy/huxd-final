<script>
  import { onMount } from 'svelte';
  import { conversations } from '$lib/stores/conversations.js';
  import { reflections } from '$lib/stores/reflections.js';

  let input = '';
  let isLoading = false;
  let showReflectionModal = false;
  let reflectionInput = '';
  let deleteConfirmSessionId = null;
  let renameSessionId = null;
  let renameInput = '';

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

    return () => clearInterval(interval);
  });

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

    try {
      // Call API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: messages.concat([userMessage]) })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      // Add assistant message with timestamp
      const assistantMessage = {
        role: 'assistant',
        content: data.assistantMessage,
        frame: data.frame,
        timestamp: new Date().toISOString()
      };
      conversations.addMessage(assistantMessage);
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
    grid-template-columns: 280px 1fr 350px;
    height: 100vh;
    gap: 0;
  }

  /* Sidebar Section */
  .sidebar {
    background: white;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e5e7eb;
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
  }

  .header {
    margin-bottom: 1.5rem;
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
  }

  .message {
    max-width: 75%;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    line-height: 1.6;
    animation: fadeIn 0.2s ease-in;
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
    align-self: flex-end;
    background: #e8f0ff;
    border: 1px solid #c7d2fe;
    color: #1e293b;
  }

  .message.assistant {
    align-self: flex-start;
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
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr 300px;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
      max-height: 150px;
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
</style>

<div class="app">
  <!-- Sidebar Section -->
  <div class="sidebar">
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

  <!-- Chat Section -->
  <div class="chat-section">
    <div class="header">
      <div class="logo">
        <span class="flower">✳</span>
        <span>B-Me</span>
      </div>
    </div>

    <div class="chat-container">
      {#if messages.length === 0}
        <div class="empty-state">
          <h2>Start a conversation</h2>
          <p>Share how you're feeling, and I'll adapt to support you.</p>
        </div>
      {/if}

      {#each messages as message}
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
      {/each}

      {#if isLoading}
        <div class="message assistant">
          <div class="typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      {/if}
    </div>

    <div class="input-container">
      <input
        type="text"
        placeholder="Type your thought..."
        bind:value={input}
        on:keydown={(e) => e.key === 'Enter' && send()}
        disabled={isLoading}
      />
      <button on:click={send} disabled={isLoading || !input.trim()}>Send</button>
    </div>
  </div>

  <!-- Reflection Log Section -->
  <div class="reflection-section">
    <div class="reflection-header">
      <h2>Reflection Log</h2>
    </div>

    <div class="reflections-list">
      {#if $reflections.length === 0}
        <div class="empty-reflections">
          <p>No reflections yet.</p>
          <p style="font-size: 0.9rem;">Write down your thoughts and insights.</p>
        </div>
      {:else}
        {#each $reflections as reflection (reflection.id)}
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
    </div>
  </div>
</div>

<!-- Reflection Modal -->
{#if showReflectionModal}
  <div class="modal-overlay" on:click={() => (showReflectionModal = false)}>
    <div class="modal" on:click|stopPropagation>
      <h3>Add Reflection</h3>
      <textarea
        bind:value={reflectionInput}
        placeholder="What's on your mind? Write down your thoughts, insights, or feelings..."
        autofocus
      ></textarea>
      <div class="modal-actions">
        <button class="cancel-btn" on:click={() => (showReflectionModal = false)}>Cancel</button>
        <button on:click={saveReflection}>Save Reflection</button>
      </div>
    </div>
  </div>
{/if}

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
