<script>
  const team = [
    { name: 'Michael Sun', role: 'Developer' },
    { name: 'Eric Noriega', role: 'Developer' },
    { name: 'Brios Olivares', role: 'Developer' }
  ];
</script>

<style>
  .about {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .header {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
  }
  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #667eea;
    color: white;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    transition: background 0.2s;
    margin-right: 1.5rem;
  }
  .back-btn:hover {
    background: #5568d3;
    text-decoration: none;
  }
  h1 {
    margin: 0;
  }
  .lead {
    color: #64748b;
    margin-bottom: 2rem;
  }
  .card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  a {
    color: #667eea;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>

<div class="about">
  <div class="header">
    <a href="/" class="back-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back to Chat
    </a>
    <h1>About Us</h1>
  </div>
  <p class="lead">B‑Me is a supportive, adaptive companion focused on clarity, validation, and momentum.</p>

  <div class="card">
    <h3>The Project</h3>
    <p>
      This project blends three conversational frames — Reflective Listener, Clarity Coach, and Momentum Partner — and
      dynamically adapts based on your input. We measure and adjust tone, empathy, and structure to meet you where you are.
    </p>
  </div>

  <div class="card">
    <h3>Our Goals</h3>
    <ul>
      <li>Offer emotionally aware support</li>
      <li>Ask more and tell less</li>
      <li>Help you build momentum through small steps</li>
    </ul>
  </div>

  <div class="card">
    <h3>Team</h3>
    {#each team as member}
      <div>{member.name} — {member.role}</div>
    {/each}
  </div>

  <div class="card">
    <h3>Contact</h3>
    <p>
      Questions or feedback? Reach out via the repository README links or open an issue.
    </p>
  </div>
</div>


