<script>
  const team = [
    { name: 'B‑Me Team', role: 'Creators' }
  ];
</script>

<style>
  .about {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    color: #1e293b;
  }
  h1 {
    margin: 0 0 0.5rem 0;
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
  <h1>About Us</h1>
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


