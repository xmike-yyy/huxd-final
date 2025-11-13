<script>
  let messages = [];
  let input = '';
  let isLoading = false;
  let currentMetrics = null;
  let currentFrame = null;
  let frameReason = '';
  let debugOpen = false;

  async function send() {
    if (!input.trim() || isLoading) return;

    // Add user message
    messages = [...messages, { role: 'user', content: input.trim() }];
    const userInput = input;
    input = '';
    isLoading = true;

    try {
      // Call API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: messages })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      // Add assistant message
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: data.assistantMessage,
          frame: data.frame
        }
      ];

      // Update state
      currentFrame = data.frame;
      frameReason = data.reason;
      currentMetrics = data.metrics;
    } catch (err) {
      console.error('Send error:', err);
      alert('Failed to send message: ' + err.message);
      // Remove the user message if failed
      messages = messages.slice(0, -1);
      input = userInput; // Restore input
    } finally {
      isLoading = false;
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

  function getFrameLabel(frame) {
    switch (frame) {
      case 'reflective-listener':
        return 'Reflective Listener';
      case 'clarity-coach':
        return 'Clarity Coach';
      case 'momentum-partner':
        return 'Momentum Partner';
      default:
        return frame;
    }
  }
</script>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    margin-bottom: 1rem;
  }

  h1 {
    color: white;
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.95rem;
  }

  .toolbar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .chat-container {
    flex: 1;
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  .message {
    max-width: 75%;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    line-height: 1.5;
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
    background: #E8F0FF;
    border: 1px solid #C7D2FE;
    color: #1e293b;
  }

  .message.assistant {
    align-self: flex-start;
    border: 1px solid #E5E7EB;
    color: #1e293b;
  }

  .meta {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.35rem;
    font-weight: 500;
  }

  .input-container {
    margin-top: 1rem;
    display: flex;
    gap: 0.75rem;
  }

  input {
    flex: 1;
    padding: 0.85rem 1rem;
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
    padding: 0.85rem 1.75rem;
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

  button.secondary {
    background: white;
    color: #1e293b;
    border: 2px solid white;
  }

  button.secondary:hover {
    background: rgba(255, 255, 255, 0.9);
  }

  .debug {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    margin-top: 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .debug-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .debug-item {
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .debug-item.warning {
    background: #fef2f2;
    border-color: #fca5a5;
  }

  .debug-label {
    font-weight: 600;
    color: #64748b;
    font-size: 0.7rem;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
    letter-spacing: 0.5px;
  }

  .debug-value {
    font-size: 1.25rem;
    color: #1e293b;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .debug-hint {
    font-size: 0.7rem;
    color: #64748b;
    margin-top: 0.25rem;
  }

  .debug-item.warning .debug-value {
    color: #dc2626;
  }

  @media (max-width: 768px) {
    .debug-grid {
      grid-template-columns: repeat(2, 1fr);
    }
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

  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 3rem 1rem;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: #64748b;
  }
</style>

<div class="container">
  <header>
    <h1>B-Me</h1>
    <p class="subtitle">Mental wellness support with adaptive conversational frames</p>
  </header>

  <div class="toolbar">
    <button class="secondary" on:click={() => (debugOpen = !debugOpen)}>
      {debugOpen ? 'Hide' : 'Show'} Metrics
    </button>
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
        <div class="meta">
          {#if message.role === 'user'}
            You
          {:else if message.frame}
            {getFrameLabel(message.frame)}
          {:else}
            Assistant
          {/if}
        </div>
        <div>{message.content}</div>
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

  {#if debugOpen}
    <div class="debug">
      <strong>Current Frame: {currentFrame ? getFrameLabel(currentFrame) : 'None'}</strong>
      {#if frameReason}
        <div style="margin-top: 0.5rem; color: #64748b;">{frameReason}</div>
      {/if}

      {#if currentMetrics}
        <div class="debug-grid">
          <div class="debug-item" class:warning={currentMetrics.sentimentAuthenticity < 40}>
            <div class="debug-label">Sentiment Authenticity</div>
            <div class="debug-value">{currentMetrics.sentimentAuthenticity}/100</div>
            <div class="debug-hint">
              {#if currentMetrics.sentimentAuthenticity < 40}
                ⚠️ Low - possible performative positivity
              {:else if currentMetrics.sentimentAuthenticity > 70}
                ✓ High - authentic expression
              {:else}
                Moderate
              {/if}
            </div>
          </div>
          <div class="debug-item" class:warning={currentMetrics.questionRatio < 70}>
            <div class="debug-label">Question Ratio</div>
            <div class="debug-value">{currentMetrics.questionRatio}%</div>
            <div class="debug-hint">
              {#if currentMetrics.questionRatio < 70}
                ⚠️ Too many statements
              {:else}
                ✓ Good balance
              {/if}
            </div>
          </div>
          <div class="debug-item" class:warning={currentMetrics.validationCompliance < 80}>
            <div class="debug-label">Validation Compliance</div>
            <div class="debug-value">{currentMetrics.validationCompliance}%</div>
            <div class="debug-hint">
              {#if currentMetrics.validationCompliance < 80}
                ⚠️ Not validating enough
              {:else}
                ✓ Validates before reframing
              {/if}
            </div>
          </div>
          <div class="debug-item" class:warning={currentMetrics.userPushback > 5}>
            <div class="debug-label">User Pushback</div>
            <div class="debug-value">{currentMetrics.userPushback}%</div>
            <div class="debug-hint">
              {#if currentMetrics.userPushback > 5}
                ⚠️ High resistance detected
              {:else}
                ✓ Low resistance
              {/if}
            </div>
          </div>
          <div class="debug-item">
            <div class="debug-label">User Solutions</div>
            <div class="debug-value">{currentMetrics.userSolutionsCount}</div>
            <div class="debug-hint">
              {#if currentMetrics.needsScaffolding}
                ⚠️ Needs more scaffolding
              {:else if currentMetrics.userSolutionsCount > 0}
                ✓ Generating solutions
              {:else}
                None yet
              {/if}
            </div>
          </div>
          <div class="debug-item">
            <div class="debug-label">Total Exchanges</div>
            <div class="debug-value">{currentMetrics.exchangeCount}</div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
