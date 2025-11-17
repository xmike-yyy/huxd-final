# B-Me Next Steps

Roadmap for improving the current implementation to a production-ready mental wellness chatbot.

---

## Current State (Updated ✅)

### What's Working Now:

✅ **Core Features:**
- Three conversational frames (Reflective Listener, Clarity Coach, Momentum Partner)
- Dynamic frame routing based on emotional state
- Gemini API integration for LLM responses
- Three-column UI (Sidebar | Chat | Reflection Log)
- Frame-colored messages with timestamps
- Real-time timestamp updates ("Just now", "5m ago", etc.)

✅ **Advanced Metrics (Python Service):**
- **Sentiment authenticity scoring** using VADER + TextBlob
  - Detects performative positivity vs. genuine emotion
  - Scores emotional intensity, subjectivity, sentiment variation
  - Location: `metrics-service/main.py` (lines 45-173)
- **Validation compliance tracking**
  - Checks if agents validate before reframing
  - Tracks percentage across conversation
  - Location: `metrics-service/main.py` (lines 189-260)
- **Question ratio** calculation
  - Ensures Socratic approach
  - Location: `metrics-service/main.py` (lines 275-303)
- **User pushback** detection
  - Identifies resistance patterns
  - Location: `metrics-service/main.py` (lines 319-354)
- **User solutions** tracking
  - Monitors self-generated insights
  - Location: `metrics-service/main.py` (lines 370-405)

✅ **Response Evaluator:**
- Rejection/retry logic for low-quality responses (max 3 attempts)
- Behavioral modulations based on evaluation issues
- Fallback to Reflective Listener if all retries fail
- Location: `src/lib/evaluator/ResponseEvaluator.js`

✅ **Reflection Log:**
- Manual reflection entry via modal
- Delete reflections
- Timestamps with relative display
- localStorage persistence
- Location: `src/lib/stores/reflections.js`

✅ **Persistence:**
- localStorage for conversation history
- Multi-session management (unlimited sessions)
- Session create, read, update, delete operations
- Auto-generated session titles
- Rename sessions with confirmation
- Delete sessions with confirmation
- Export conversations (JSON and Markdown)
- Session recovery on page reload
- Location: `src/lib/stores/conversations.js`

### What's Still Needed:

❌ **Production Features:**
- No error handling/monitoring (Sentry)
- No rate limiting
- No multi-user support (authentication)
- No cloud database (Supabase)

❌ **Advanced Analytics & Insights (Phase 5):**
- No automated insights extraction from conversations (LLM-powered)
- No conversation summary generation
- No mood tracking over time
- No progress visualization

❌ **UX Improvements:**
- No voice input/output
- No conversation search
- No dark mode

---

## Current Architecture

```
b-me-wellness/
├── metrics-service/              ← Python FastAPI service (Port 8000)
│   ├── main.py                   ← All 5 metrics calculations
│   ├── requirements.txt
│   └── venv/
├── src/
│   ├── lib/
│   │   ├── agents/               ← Three conversational frames
│   │   │   ├── BaseAgent.js      ← Enhanced with modulations
│   │   │   ├── ReflectiveListener.js
│   │   │   ├── ClarityCoach.js
│   │   │   └── MomentumPartner.js
│   │   ├── orchestrator/         ← Frame routing logic
│   │   │   └── Orchestrator.js   ← Enhanced with retry loop
│   │   ├── evaluator/            ← NEW
│   │   │   └── ResponseEvaluator.js  ← Quality checks & retry logic
│   │   ├── stores/               ← NEW
│   │   │   ├── conversations.js  ← Multi-session management
│   │   │   └── reflections.js    ← Reflection log storage
│   │   ├── metrics/              ← Metrics client (calls Python service)
│   │   └── services/
│   └── routes/
│       ├── +page.svelte          ← Three-column UI (Sidebar | Chat | Reflection)
│       └── api/chat/+server.js   ← Enhanced with evaluation results
└── docs/
    ├── ARCHITECTURE.md            ← Updated with UI architecture
    └── NEXT_STEPS.md              ← This file
```

---

## Phase 1: Response Evaluator & Behavioral Modulation ✅ COMPLETED

~~Add feedback loop to reject poor responses and adjust agent behavior.~~

### Tasks (All Completed):

**1. Create ResponseEvaluator Class**

File: `src/lib/evaluator/ResponseEvaluator.js`
```javascript
export class ResponseEvaluator {
  async evaluate(agentResponse, userMessage, currentMetrics) {
    const issues = [];

    // Check if validation needed but missing
    if (userSentiment < 0 && !this.hasValidation(agentResponse)) {
      issues.push({
        type: 'MISSING_VALIDATION',
        severity: 'HIGH',
        fix: 'Add emotional validation before suggestions'
      });
    }

    // Check question ratio in response
    const qRatio = this.calculateQuestionRatio(agentResponse);
    if (qRatio < 0.5) {
      issues.push({
        type: 'TOO_DIRECTIVE',
        severity: 'MEDIUM',
        fix: 'Convert statements to questions'
      });
    }

    // Check for toxic positivity
    if (this.hasToxicPositivity(agentResponse)) {
      issues.push({
        type: 'TOXIC_POSITIVITY',
        severity: 'HIGH',
        fix: 'Remove dismissive phrases'
      });
    }

    return {
      accepted: issues.length === 0,
      issues,
      score: this.calculateScore(issues)
    };
  }
}
```

**2. Add Retry Logic to Orchestrator**

File: `src/lib/orchestrator/Orchestrator.js`
```javascript
async orchestrate(contents) {
  const MAX_RETRIES = 3;
  let attempts = 0;
  let response;
  let evaluation;

  while (attempts < MAX_RETRIES) {
    // Generate response
    response = await this.generateResponse(contents);

    // Evaluate response
    evaluation = await this.evaluator.evaluate(
      response.assistantMessage,
      lastUserMessage,
      currentMetrics
    );

    if (evaluation.accepted) break;

    // If rejected, add modulations and retry
    this.applyModulations(evaluation.issues);
    attempts++;
  }

  return {
    ...response,
    evaluation,
    attempts
  };
}
```

**3. Implement Behavioral Modulations**

Update agent prompts dynamically based on metrics:

```javascript
// In BaseAgent.js
getModulatedSystemPrompt(metrics, modulations) {
  let prompt = this.baseSystemPrompt;

  // Add metric-based instructions
  if (metrics.sentimentAuthenticity < 40) {
    prompt += "\n\nIMPORTANT: User may be showing performative positivity. Ask direct feeling questions.";
  }

  if (metrics.questionRatio < 70) {
    prompt += "\n\nIMPORTANT: Use 70%+ questions instead of statements. Be more Socratic.";
  }

  if (metrics.userPushback > 5) {
    prompt += "\n\nIMPORTANT: User has shown resistance. Use softer language, acknowledge difficulty.";
  }

  return prompt;
}
```

---

## Phase 2: Reflection Log & Manual Entry ✅ COMPLETED

~~Add conversation insights and manual reflection entry.~~

**Completed:**
- ✅ Manual reflection entry via modal
- ✅ Reflection storage with timestamps
- ✅ Delete reflections
- ✅ localStorage persistence
- ✅ Three-column UI with dedicated Reflection Log panel

### Tasks:

**1. Generate Conversation Insights**

File: `src/lib/services/reflectionGenerator.js`
```javascript
export async function generateInsights(conversation) {
  const prompt = `
    Analyze this mental wellness conversation and extract:
    1. Key emotions expressed
    2. Main concerns or challenges
    3. Solutions user generated themselves
    4. Progress indicators
    5. Patterns across messages

    Conversation:
    ${JSON.stringify(conversation, null, 2)}
  `;

  // Call Gemini to generate structured insights
  const insights = await gemini.generateContent(prompt);

  return {
    emotions: [...],
    concerns: [...],
    solutions: [...],
    progress: [...],
    patterns: [...]
  };
}
```

**2. Build Reflection Log UI**

File: `src/routes/+page.svelte` (add panel)
```svelte
<div class="reflection-panel">
  <h3>Insights</h3>

  {#if insights}
    <div class="insight-section">
      <h4>Key Emotions</h4>
      <ul>
        {#each insights.emotions as emotion}
          <li>{emotion}</li>
        {/each}
      </ul>
    </div>

    <div class="insight-section">
      <h4>Your Solutions</h4>
      <ul>
        {#each insights.solutions as solution}
          <li class="highlight">{solution}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <button on:click={generateInsights}>Generate Insights</button>
</div>
```

**3. Add Manual Reflection Entry**

```svelte
<div class="manual-reflection">
  <textarea
    placeholder="Add your own reflection..."
    bind:value={manualReflection}
  />
  <button on:click={saveReflection}>Save Reflection</button>
</div>
```

---

## Phase 3: Persistence & Export ✅ COMPLETED

~~Add localStorage and export functionality.~~

**Completed:**
- ✅ localStorage persistence for conversations
- ✅ localStorage persistence for reflections
- ✅ Multi-session management (unlimited sessions)
- ✅ Session CRUD operations
- ✅ Auto-generated session titles
- ✅ Rename sessions with confirmation
- ✅ Delete sessions with confirmation
- ✅ Export to JSON format
- ✅ Export to Markdown format
- ✅ Real-time timestamps with auto-updates

### Tasks (All Completed):

**1. Add localStorage Persistence**

File: `src/lib/stores/conversation.js`
```javascript
import { writable } from 'svelte/store';

function createConversationStore() {
  const STORAGE_KEY = 'bme_conversation';

  // Load from localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = stored ? JSON.parse(stored) : { messages: [], startedAt: null };

  const { subscribe, set, update } = writable(initial);

  // Save on every change
  subscribe(value => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });

  return {
    subscribe,
    set,
    update,
    clear: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ messages: [], startedAt: null });
    }
  };
}

export const conversation = createConversationStore();
```

**2. Add Export Functionality**

File: `src/lib/utils/export.js`
```javascript
export function exportConversation(conversation, format = 'json') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(conversation, null, 2)], {
      type: 'application/json'
    });
    downloadBlob(blob, 'bme-conversation.json');
  }

  if (format === 'markdown') {
    const md = conversationToMarkdown(conversation);
    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, 'bme-conversation.md');
  }
}

function conversationToMarkdown(conversation) {
  let md = `# B-Me Conversation\n\n`;
  md += `**Date:** ${new Date().toLocaleDateString()}\n\n`;

  conversation.messages.forEach(msg => {
    md += `## ${msg.role === 'user' ? 'You' : msg.frame || 'Assistant'}\n\n`;
    md += `${msg.content}\n\n`;
  });

  return md;
}
```

---

## Phase 4: Production Readiness

Prepare for deployment with error handling, monitoring, and rate limiting.

### Tasks:

**1. Add Error Handling**

```javascript
// In +server.js
try {
  const result = await orchestrator.orchestrate(contents);
  return json(result);
} catch (error) {
  console.error('Chat error:', error);

  // Log to monitoring service (Sentry, etc.)
  await logError(error, { userId, conversationId });

  // Return user-friendly error
  return json({
    error: 'Something went wrong. Please try again.',
    code: 'ORCHESTRATION_ERROR'
  }, { status: 500 });
}
```

**2. Add Rate Limiting**

```javascript
import { RateLimiter } from 'sveltekit-rate-limiter';

const limiter = new RateLimiter({
  rate: [10, '1m'], // 10 requests per minute
  preflight: true
});

export async function POST({ request, getClientAddress }) {
  const limited = await limiter.check(request, getClientAddress());

  if (limited) {
    return json({
      error: 'Too many requests. Please wait a moment.'
    }, { status: 429 });
  }

  // ... rest of handler
}
```

**3. Set Up Monitoring**

```bash
# Install Sentry
npm install @sentry/sveltekit

# Initialize in hooks.server.js
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

**4. Deploy Python Service**

Options for hosting `metrics-service/`:
- **Render**: Free tier, easy Python deployment
- **Railway**: $5/month, better performance
- **Fly.io**: Pay as you go, good for Python

Update `src/lib/services/metricsService.js`:
```javascript
const METRICS_SERVICE_URL =
  process.env.METRICS_SERVICE_URL ||
  'http://localhost:8000';
```

---

## Phase 5: Advanced Features (Post-MVP)

Consider adding after core functionality is solid:

**User Experience:**
- Voice input/output (text-to-speech)
- Mobile-optimized UI
- Conversation search
- Dark mode

**Analytics:**
- Mood tracking calendar
- Weekly/monthly insights
- Progress visualization
- Emotion timeline

**Safety:**
- Crisis language detection
- Resource suggestions (hotlines, etc.)
- Therapist export functionality
- Age verification

**Multi-User:**
- User authentication (Supabase Auth)
- Cloud sync (Supabase DB)
- User profiles and preferences
- Conversation sharing (optional)

---

## Recommended Priority

### Completed (Phases 1-3):
1. ✅ Sentiment authenticity
2. ✅ Validation compliance
3. ✅ Python metrics service
4. ✅ Response evaluator with retry loop
5. ✅ Behavioral modulations
6. ✅ Reflection log UI
7. ✅ localStorage persistence for conversations & reflections
8. ✅ Multi-session management
9. ✅ Export functionality (JSON & Markdown)
10. ✅ Real-time timestamps

### Next Priorities (Phase 4):
1. ⏳ Error handling & monitoring (Sentry)
2. ⏳ Rate limiting
3. ⏳ Better error messages to users
4. ⏳ Production deployment (Vercel + Python service)
5. ⏳ User testing & feedback

### Future Enhancements (Phase 5):
6. ⏳ Automated conversation insights extraction
7. ⏳ Conversation summary generation
8. ⏳ Mood tracking over time
9. ⏳ Voice input/output
10. ⏳ Conversation search
11. ⏳ Dark mode
12. ⏳ Multi-user support (authentication + cloud sync)

---

## Success Metrics

### Quantitative:
- **Frame accuracy**: >80% correct frame selection
- **Response quality**: >80% accepted on first try
- **Response time**: <3 seconds average
- **Engagement**: >5 exchanges per conversation

### Qualitative:
- Users feel heard and validated
- Natural conversation flow
- Users generate own solutions
- No toxic positivity detected

---

## Resources

### Current Stack:
- [SvelteKit](https://kit.svelte.dev/) - Frontend framework
- [Gemini API](https://ai.google.dev/docs) - LLM for agents
- [FastAPI](https://fastapi.tiangolo.com/) - Python metrics service
- [VADER Sentiment](https://github.com/cjhutto/vaderSentiment) - Sentiment analysis
- [TextBlob](https://textblob.readthedocs.io/) - Subjectivity analysis

### Deployment:
- Frontend: Vercel (free tier)
- Python Service: Render/Railway ($5-10/month)
- Monitoring: Sentry (free tier)

---

## Questions to Address

1. **Target Users**: Who is this primarily for? (College students, general adults, specific needs?)
2. **Use Cases**: Daily check-ins? Crisis support? Goal setting? All of the above?
3. **Ethics**: How do we handle crisis situations? Data privacy? Age restrictions?
4. **Scaling**: How many concurrent users do we expect? Budget for APIs?
5. **Success**: How do we measure if this is actually helping people?

---

## Current File Structure

```
b-me-wellness/
├── metrics-service/              # Python FastAPI service (Port 8000)
│   ├── main.py                   # All 5 metrics calculations
│   ├── requirements.txt
│   ├── README.md
│   └── venv/
├── src/
│   ├── lib/
│   │   ├── agents/               # Three conversational frames
│   │   │   ├── BaseAgent.js      # ✅ Enhanced with modulations
│   │   │   ├── ReflectiveListener.js
│   │   │   ├── ClarityCoach.js
│   │   │   └── MomentumPartner.js
│   │   ├── orchestrator/         # Frame routing logic
│   │   │   └── Orchestrator.js   # ✅ Enhanced with retry loop
│   │   ├── evaluator/            # ✅ NEW - Response quality checks
│   │   │   └── ResponseEvaluator.js
│   │   ├── stores/               # ✅ NEW - State management
│   │   │   ├── conversations.js  # ✅ Multi-session management
│   │   │   └── reflections.js    # ✅ Reflection log storage
│   │   ├── metrics/              # Metrics client
│   │   │   ├── MetricsTracker.js
│   │   │   └── metricsService.js
│   │   └── services/
│   │       ├── gemini.js
│   │       └── inputAnalyzer.js
│   └── routes/
│       ├── +page.svelte          # ✅ Three-column UI
│       └── api/chat/+server.js   # ✅ Enhanced with evaluation
├── docs/
│   ├── ARCHITECTURE.md            # ✅ Updated
│   └── NEXT_STEPS.md              # ✅ Updated (this file)
├── package.json
├── README.md
└── start.sh                       # Easy startup script
```

**Key Files:**
- `src/lib/evaluator/ResponseEvaluator.js`: Quality checks, retry logic, modulations
- `src/lib/stores/conversations.js`: Multi-session management with localStorage
- `src/lib/stores/reflections.js`: Reflection log with localStorage
- `src/routes/+page.svelte`: Three-column UI (Sidebar | Chat | Reflection Log)
- `src/lib/orchestrator/Orchestrator.js`: Enhanced with evaluation loop
- `src/lib/agents/BaseAgent.js`: Enhanced with behavioral modulations

---

Good luck with the next phase! 🚀
