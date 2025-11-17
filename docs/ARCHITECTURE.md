# B-Me Architecture Documentation

## System Architecture Overview

B-Me implements a **sequential routing multi-agent architecture** with dynamic frame switching based on user emotional state and real-time humane metrics monitoring.

## Core Components

### 1. Input Analyzer
**Purpose**: Analyzes user input to determine emotional state, sentiment, and intent

**Inputs**:
- User message text
- Conversation history (last 5-10 messages)

**Outputs**:
- Sentiment score (-1.0 to 1.0: negative to positive)
- Emotional state (frustrated, confused, positive, neutral, etc.)
- Intent classification (venting, seeking advice, celebrating, reflecting)
- Energy level (low, medium, high)

**Implementation**:
```javascript
{
  sentiment: 0.3,              // slightly positive
  emotionalState: "confused",  // detected state
  intent: "seeking_advice",    // user goal
  energyLevel: "low",          // engagement level
  keyPhrases: ["I don't know what to do", "feeling stuck"]
}
```

**LLM Prompt Strategy**:
Use Gemini with structured output (JSON mode) to analyze the last user message in context of recent conversation history.

---

### 2. Orchestrator/Router
**Purpose**: Selects which conversational frame to engage based on input analysis and current metrics

**Decision Logic**:

**Primary Sequential Flow**:
1. **Reflective Listener** (if negative/frustrated emotions detected)
2. **Clarity Coach** (if confusion/ambivalence or readiness to problem-solve)
3. **Momentum Partner** (if positive sentiment or action-oriented language)

**Metric-Based Overrides**:
- If `validation-before-reframe` compliance < 80% → Force Reflective Listener
- If `user-generated-solutions` count = 0 after 10+ exchanges → Use Clarity Coach with more directive scaffolding
- If `user-pushback` frequency > 5 per 100 messages → Use Reflective Listener, reduce Momentum Partner

**Frame Selection Output**:
```javascript
{
  selectedFrame: "reflective-listener",
  reason: "User expressed frustration and low energy",
  metricsContext: {
    currentSentimentAuth: 35,  // Below 40% threshold
    currentQIRatio: 68,         // Below 70% threshold
  },
  modulations: [
    "increase_emotional_vocabulary",
    "increase_question_ratio"
  ]
}
```

**Implementation Strategy**:
- Use Gemini to make frame selection decision
- Provide it with: current user state, conversation history summary, current metric values
- Return structured JSON with frame choice + reasoning

---

### 3. Conversational Frames (Agents)

Each agent is a specialized LLM instance with a distinct system prompt that defines:
- **Persona**: How the agent presents itself
- **Goals**: What the agent aims to achieve
- **Tone**: Communication style (empathetic, curious, encouraging)
- **SPEAKING model elements**: Scene, Participants, Ends, Act sequence, Key, Instrumentalities, Norms, Genre
- **Example responses**: Few-shot examples to guide behavior
- **Constraints**: What to avoid (toxic positivity, unsolicited advice, etc.)

#### Frame 1: Reflective Listener

**System Prompt Structure**:
```
You are the Reflective Listener, a mental wellness support agent.

ROLE: Build trust and emotional safety through validation and empathy.

TONE: Empathetic, patient, non-judgmental. Mirror the user's emotional intensity without amplifying it.

GOALS:
- Help users feel heard and understood
- Validate emotions without judgment
- Create psychological safety before problem-solving
- Use reflective listening techniques

SPEAKING MODEL:
- Setting: Safe emotional space, no pressure to solve problems
- Participants: You as compassionate listener, user as valued person processing emotions
- Ends: User feels validated and ready to explore solutions (if/when they choose)
- Act Sequence: Listen → Validate → Reflect back → Ask open-ended questions
- Key: Warm, patient, matching user's energy level
- Instrumentalities: Reflective statements, validation phrases, minimal advice
- Norms: User autonomy respected, emotions are valid, no rush to solutions
- Genre: Supportive conversation, emotional processing

TECHNIQUES:
- Reflection: "It sounds like you're feeling..."
- Validation: "That makes sense given..."
- Open questions: "What stood out to you most about that?"
- Avoid: Unsolicited advice, toxic positivity, minimizing feelings

CURRENT CONTEXT (provided with each request):
- User emotional state: [frustrated/sad/overwhelmed]
- Sentiment authenticity score: [0-100]
- Modulations needed: [list of adjustments based on metrics]

EXAMPLES:
User: "I feel like I wasted today."
Agent: "Days aren't wasted when they teach us. What do you think you needed most?"

User: "I'm so frustrated with everything."
Agent: "Sounds like this week's been heavy — what stood out to you most?"
```

**Metric-Based Modulations**:
- If sentiment authenticity < 40%: Use more specific emotional vocabulary ("frustrated" vs. "upset"), ask direct feeling questions
- If question-to-imperative ratio < 70%: Convert more statements to questions

#### Frame 2: Clarity Coach

**System Prompt Structure**:
```
You are the Clarity Coach, a mental wellness support agent.

ROLE: Help structure thoughts into goals through guided self-reflection.

TONE: Thoughtful, curious, Socratic. Gently challenging but supportive.

GOALS:
- Guide users to discover their own insights
- Help structure ambiguous feelings into actionable understanding
- Ask questions that promote self-reflection
- Develop coping strategies through co-discovery

SPEAKING MODEL:
- Setting: Collaborative thinking space
- Participants: You as thinking partner, user as capable problem-solver
- Ends: User gains clarity and generates their own solutions
- Act Sequence: Socratic questioning → Co-discovery → Gentle challenges
- Key: Curious, thoughtful, intellectually engaged
- Instrumentalities: Questions, reframes, pattern identification
- Norms: User autonomy paramount, you facilitate rather than solve
- Genre: Collaborative inquiry, guided self-discovery

TECHNIQUES:
- Socratic questions: "What would it look like if...?"
- Pattern spotting: "I notice you mentioned X twice..."
- Gentle challenges: "What would you tell a friend in this situation?"
- Avoid: Giving answers, being prescriptive, rushing to solutions

CURRENT CONTEXT:
- User emotional state: [confused/ambivalent/ready]
- Question-to-imperative ratio: [0-100]
- Validation-before-reframe compliance: [0-100]
- Modulations needed: [list]

EXAMPLES:
User: "I don't know what to do about my routine."
Agent: "If you could change one small thing about your routine tomorrow, what would it be?"

User: "I keep saying I'll do things but don't."
Agent: "What gets in the way between the intention and the action?"
```

**Metric-Based Modulations**:
- If question-to-imperative ratio < 70%: Increase proportion of questions, convert statements to questions
- If validation-before-reframe < 80%: Must start every response with explicit validation before reframing
- If user-generated-solutions = 0 after 10+ exchanges: Become more directive with scaffolding questions

#### Frame 3: Momentum Partner

**System Prompt Structure**:
```
You are the Momentum Partner, a mental wellness support agent.

ROLE: Celebrate wins and reinforce balance with realistic action steps.

TONE: Encouraging, practical, realistic. Celebratory but grounded (no toxic positivity).

GOALS:
- Acknowledge and celebrate user progress
- Suggest small, manageable action steps
- Reinforce what's working
- Maintain realistic optimism

SPEAKING MODEL:
- Setting: Progress review and forward planning
- Participants: You as encouraging partner, user as capable actor
- Ends: Celebrate progress, identify small next steps
- Act Sequence: Celebrate → Identify what worked → Suggest manageable actions
- Key: Energetic but realistic, warm and encouraging
- Instrumentalities: Affirmations (non-toxic), small action suggestions
- Norms: Progress over perfection, small steps are valued
- Genre: Supportive coaching, positive but grounded

TECHNIQUES:
- Specific celebration: "You showed consistency with X..."
- Pattern reinforcement: "What made that work for you?"
- Small steps: "One small thing you could try..."
- Avoid: Toxic positivity, unrealistic goals, pressure to be happy

CURRENT CONTEXT:
- User emotional state: [positive/motivated/action-oriented]
- User pushback frequency: [per 100 messages]
- Modulations needed: [list]

EXAMPLES:
User: "I actually went for a walk today."
Agent: "You showed consistency this week — want to review what made that work?"

User: "I'm ready to try something new."
Agent: "That's great. What's one small step you could take in the next 24 hours?"
```

**Metric-Based Modulations**:
- If user pushback > 5 per 100 messages: Reduce enthusiasm level, add more acknowledgment of difficulty, use softer language
- If validation-before-reframe < 80%: Start with validation even in positive contexts

---

### 4. Response Evaluator
**Purpose**: Validates that agent responses meet humane metric standards before sending to user

**Evaluation Criteria**:

1. **Validation Check**: Does response include emotional validation?
2. **Question Ratio**: For Clarity Coach, are 70%+ of sentences questions?
3. **Authenticity Check**: Does response avoid toxic positivity phrases?
4. **Pushback Detector**: Does response risk user resistance?
5. **Length Check**: Is response appropriately concise (not overwhelming)?

**Rejection Logic**:
```javascript
if (validationScore < threshold && userEmotionalState !== "positive") {
  return {
    accepted: false,
    reason: "Missing emotional validation",
    action: "retry_with_reflective_listener"
  }
}

if (questionRatio < 0.7 && selectedFrame === "clarity-coach") {
  return {
    accepted: false,
    reason: "Too many imperatives, not enough questions",
    action: "retry_with_modulation"
  }
}
```

**Output**:
```javascript
{
  accepted: true/false,
  reason: "string explanation",
  action: "send_to_user" | "retry_with_modulation" | "switch_frame",
  metrics: {
    validationPresent: true/false,
    questionRatio: 0.0-1.0,
    authenticityScore: 0-100,
    toxicPositivityDetected: true/false
  }
}
```

---

### 5. Metrics Monitor
**Purpose**: Continuously tracks the five humane metrics and provides feedback to orchestrator

**Metrics Tracked**:

#### 1. Sentiment Authenticity Score (0-100)
**Calculation**:
- Analyze user messages for genuine emotional expression vs. performative positivity
- Look for: specific emotions, vulnerability, authentic language patterns
- Red flags: Excessive "I'm fine", generic positivity, dismissive self-talk

**Threshold**: < 40% triggers increased emotional vocabulary

**Implementation**:
```javascript
// Analyze last 5 user messages
function calculateSentimentAuthenticity(userMessages) {
  // Use Gemini to score each message for:
  // - Emotional specificity (0-100)
  // - Vulnerability indicators (0-100)
  // - Performative positivity markers (-50 penalty)

  return averageScore; // 0-100
}
```

#### 2. Question-to-Imperative Ratio (0-100%)
**Calculation**:
- Count questions vs. imperative statements in agent responses
- Target: 70%+ questions (especially for Clarity Coach)

**Threshold**: < 70% triggers more Socratic questioning

**Implementation**:
```javascript
function calculateQIRatio(agentResponses) {
  const sentences = agentResponses.flatMap(r => r.split(/[.!?]+/));
  const questions = sentences.filter(s => s.includes('?')).length;
  const total = sentences.length;

  return (questions / total) * 100;
}
```

#### 3. Validation-Before-Reframe Compliance (0-100%)
**Calculation**:
- For each agent response that includes a reframe/advice, check if it starts with validation
- Count compliant vs. total reframes

**Threshold**: < 80% enforces Reflective Listener first

**Implementation**:
```javascript
function checkValidationCompliance(agentResponse, userMessage) {
  // Use Gemini to detect:
  // 1. Does response include reframe or advice?
  // 2. Does it start with emotional validation?

  return { compliant: true/false };
}
```

#### 4. User Pushback Frequency (per 100 messages)
**Calculation**:
- Detect user messages that resist, disagree, or pushback against agent suggestions
- Phrases like: "but...", "I can't", "that won't work", "you don't understand"

**Threshold**: > 5 per 100 messages triggers softer language

**Implementation**:
```javascript
function detectPushback(userMessage) {
  // Use Gemini + regex to detect:
  // - Resistance phrases
  // - Disagreement markers
  // - Frustration with suggestions

  return { isPushback: true/false, confidence: 0-100 };
}
```

#### 5. User-Generated Solutions Count
**Calculation**:
- Count instances where user generates their own solutions or insights
- Look for: "I think I'll...", "Maybe I could...", "What if I..."

**Threshold**: 0 after 10+ exchanges triggers more directive scaffolding

**Implementation**:
```javascript
function detectUserSolution(userMessage) {
  // Use Gemini to detect:
  // - Solution-oriented language
  // - Self-generated action plans
  // - Insight statements

  return { isSolution: true/false };
}
```

---

## Data Flow

### Single Message Flow

```
1. User types message
   ↓
2. Frontend sends: { history: [...messages], message: "new message" }
   ↓
3. API Route: /api/chat
   ↓
4. InputAnalyzer analyzes message + history
   → Returns: { sentiment, emotionalState, intent, energyLevel }
   ↓
5. MetricsMonitor calculates current metrics from history
   → Returns: { sentimentAuth: 45, qiRatio: 68, ... }
   ↓
6. Orchestrator selects frame based on:
   - Input analysis
   - Current metrics
   - Conversation history
   → Returns: { frame: "reflective-listener", modulations: [...] }
   ↓
7. Selected Agent generates response with modulations applied
   → Returns: { text: "agent response" }
   ↓
8. ResponseEvaluator validates response against metrics
   → If rejected: goto step 7 (retry with adjustments)
   → If accepted: continue
   ↓
9. MetricsMonitor updates metrics with new exchange
   ↓
10. API returns: { message, frame, metrics, reflection }
   ↓
11. Frontend updates:
    - Conversation store (add message)
    - Metrics store (update metrics)
    - Reflection store (add insights)
```

### State Management

**Conversation Store** (Svelte writable + localStorage):
```javascript
{
  sessions: {
    "session_123": {
      id: "session_123",
      title: "Feeling overwhelmed with work",
      messages: [
        {
          role: "user",
          content: "...",
          timestamp: "2025-11-16T20:30:00Z"
        },
        {
          role: "assistant",
          content: "...",
          frame: "reflective-listener",
          timestamp: "2025-11-16T20:30:05Z"
        }
      ],
      createdAt: "2025-11-16T20:30:00Z",
      updatedAt: "2025-11-16T20:35:00Z"
    }
  },
  currentSessionId: "session_123"
}
```

**Features:**
- Multi-session management (unlimited sessions)
- Auto-save to localStorage on every change
- Session CRUD operations (create, read, update, delete)
- Auto-generated titles from first user message
- Rename functionality with confirmation
- Delete confirmation dialogs
- Export to JSON/Markdown
- Real-time timestamps with relative display ("Just now", "5m ago")

**Metrics Store** (Svelte writable):
```javascript
{
  sentimentAuthenticity: 45,
  questionImperativeRatio: 68,
  validationCompliance: 82,
  pushbackFrequency: 3,
  userSolutionsCount: 2,
  lastUpdated: timestamp
}
```

**Reflection Store** (Svelte writable + localStorage):
```javascript
{
  reflections: [
    {
      id: "reflection_abc123",
      content: "Noticed I'm more stressed on Mondays",
      mood: "frustrated",
      createdAt: "2025-11-16T20:30:00Z"
    }
  ]
}
```

**Features:**
- Manual reflection entry via modal
- Auto-save to localStorage
- Delete reflections with hover action
- Real-time timestamp updates ("Just now", "5m ago")
- Chronological ordering (newest first)

---

## Deployment Architecture (Vercel)

```
┌─────────────────────────────────────────┐
│         User Browser                     │
│  ┌────────────────────────────────────┐ │
│  │   SvelteKit Frontend                │ │
│  │   - Chat UI                         │ │
│  │   - Reflection Log                  │ │
│  │   - Svelte Stores (state)           │ │
│  │   - localStorage (persistence)      │ │
│  └────────────────────────────────────┘ │
└─────────────┬───────────────────────────┘
              │ HTTPS
              ↓
┌─────────────────────────────────────────┐
│      Vercel Edge Network                 │
│  ┌────────────────────────────────────┐ │
│  │  Static Assets (HTML, CSS, JS)     │ │
│  └────────────────────────────────────┘ │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│   Vercel Serverless Functions            │
│  ┌────────────────────────────────────┐ │
│  │  /api/chat                          │ │
│  │  - InputAnalyzer                    │ │
│  │  - Orchestrator                     │ │
│  │  - Agents (3 frames)                │ │
│  │  - ResponseEvaluator                │ │
│  │  - MetricsMonitor                   │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  /api/metrics                       │ │
│  │  /api/reflection                    │ │
│  └────────────────────────────────────┘ │
└─────────────┬───────────────────────────┘
              │ API Calls
              ↓
┌─────────────────────────────────────────┐
│     Google Gemini API                    │
│     (gemini-2.5-flash)                   │
└─────────────────────────────────────────┘
```

**Benefits**:
- Auto-scaling serverless functions
- Global edge network for fast static delivery
- Environment variable management
- Zero configuration deployment
- No server maintenance

---

## UI Architecture

### Three-Column Layout

```
┌──────────────┬─────────────────────────┬────────────────┐
│   Sidebar    │      Chat Section       │  Reflection    │
│   (280px)    │      (flexible)         │  Log (350px)   │
├──────────────┼─────────────────────────┼────────────────┤
│              │                         │                │
│ B-Me         │  ✳ B-Me                 │ Reflection Log │
│              │                         │                │
│ + New Chat   │  [Chat Container]       │ [Reflections]  │
│              │  - User messages        │ - Timestamps   │
│ Sessions:    │  - Assistant messages   │ - Content      │
│ • Session 1  │  - Frame colors         │ - Delete btns  │
│ • Session 2  │  - Timestamps           │                │
│ • Session 3  │                         │                │
│              │  [Input Box]            │ 🖊 Start       │
│              │  Type your thought...   │   writing...   │
│              │  [Send]                 │                │
└──────────────┴─────────────────────────┴────────────────┘
```

**Features:**
- **Sidebar**: Session management with create, switch, rename, delete
- **Chat**: Conversation display with frame-colored messages and timestamps
- **Reflection Log**: Manual reflection entry and display
- **Responsive**: Stacks vertically on mobile (< 1024px)
- **Modals**: Confirmation dialogs for delete, rename input, reflection entry

**Color Coding:**
- Reflective Listener: `#E8F0FF` (light blue)
- Clarity Coach: `#FFF4E6` (light orange)
- Momentum Partner: `#FFE8EC` (light pink)
- User messages: `#E8F0FF` (light blue)

---

## Security Considerations

### API Key Protection
- Store Gemini API key in environment variables (never in code)
- Access only from serverless functions (never exposed to client)
- Rotate keys periodically

### Input Validation
- Sanitize user input before processing
- Limit message length (max 2000 characters)
- Rate limiting: Max 60 requests per minute per session

### Data Privacy
- All conversation data stored client-side (localStorage)
- No server-side logging of conversation content
- User can clear data at any time

### XSS Prevention
- Sanitize all user input before displaying
- Use Svelte's built-in XSS protection
- Content Security Policy headers

---

## Performance Optimizations

### Response Streaming
- Stream LLM responses token-by-token for faster perceived performance
- Show typing indicator immediately

### Caching
- Cache system prompts (don't regenerate)
- Memoize metric calculations for unchanged history

### Lazy Loading
- Load reflection log on demand
- Paginate long conversation histories

### Request Optimization
- Send minimal conversation history to API (last 20 messages)
- Compress large payloads

---

## Future Enhancements (Post-MVP)

### Multi-User Support
- Add authentication (Supabase Auth)
- Add database (Supabase PostgreSQL)
- Migrate localStorage to server storage

### Advanced Metrics
- Track progress over time (weekly trends)
- Visualize metric improvements
- Export conversation insights

### Additional Features
- Voice input/output
- Mood tracking calendar
- Integration with wellness apps
- Therapist handoff (emergency support)
