# B-Me: Mental Wellness Multi-Agent Chatbot

A frame-sensitive conversational system for mental wellness, powered by three specialized agents that adapt based on emotional state and real-time humane metrics monitoring.

## Quick Start Guide

### Prerequisites
- **Node.js 20.x** - [Download here](https://nodejs.org/)
- **Python 3.9+** - [Download here](https://www.python.org/downloads/)
- **Google Gemini API Key** - [Get one here](https://makersuite.google.com/app/apikey)

### Installation & Setup

**1. Clone or navigate to the project:**
```bash
cd b-me-wellness
```

**2. Set up the Frontend (SvelteKit):**
```bash
# Install Node dependencies
npm install

# Create .env file with your Gemini API key
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
```

**3. Set up the Python Metrics Service:**
```bash
# Navigate to metrics service
cd metrics-service

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Return to project root
cd ..
```

### Running the Application

**Option 1: Easy Start (Recommended)**

Use the provided startup script:
```bash
./start.sh
```

This will start both services automatically!

**Option 2: Manual Start**

You need to run **TWO services** simultaneously:

**Terminal 1 - Python Metrics Service (Port 8000):**
```bash
cd metrics-service
source venv/bin/activate  # Activate venv if not already active
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Terminal 2 - SvelteKit Frontend (Port 5173):**
```bash
# From project root
npm run dev
```

You should see:
```
VITE v5.4.21  ready in 961 ms
➜  Local:   http://localhost:5173/
```

**3. Open the app:**
```
http://localhost:5173
```

## Project Overview

B-Me uses a multi-agent architecture with three specialized conversational frames that adapt based on user emotional state and conversation metrics:

### Three Conversational Frames

**Frame 1: Reflective Listener** 🔵
- Builds trust through empathetic validation
- Engages when user shows frustration or negative emotions
- Tone: Empathetic, patient, non-judgmental

**Frame 2: Clarity Coach** 🟡
- Helps structure thoughts through Socratic questioning
- Engages when user expresses confusion or ambivalence
- Tone: Thoughtful, curious, gently challenging

**Frame 3: Momentum Partner** 🔴
- Celebrates progress and reinforces action
- Engages when positive sentiment detected
- Tone: Encouraging, practical, realistic

### Five Humane Metrics

The system tracks these metrics in real-time to ensure authentic, balanced conversations:

1. **Sentiment Authenticity** (0-100) - Detects genuine emotion vs. performative positivity
2. **Question Ratio** (target: 70%+) - Ensures agent asks more than tells
3. **Validation Compliance** (target: 80%+) - Validates emotions before problem-solving
4. **User Pushback** (target: <5%) - Detects resistance to suggestions
5. **User Solutions** - Tracks user-generated insights

## Architecture

### System Flow
```
User Input → Input Analyzer → Orchestrator → [Selected Frame] → Response
                                    ↑                                ↓
                                    └──── Metrics Monitor ──────────┘
                                       (5 humane metrics)
```

### Tech Stack

**Frontend:**
- SvelteKit 2.5 (SSR + API routes)
- Google Gemini 2.5 Flash (via @google/genai)
- Custom CSS with frame-specific color coding

**Backend:**
- Python FastAPI (metrics service)
- VADER Sentiment Analysis
- TextBlob (for subjectivity/polarity)
- Real-time NLP metrics calculation

## Project Structure

```
b-me-wellness/
├── src/
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── BaseAgent.js              # Base agent with SPEAKING model
│   │   │   ├── ReflectiveListener.js     # Frame 1: Validation
│   │   │   ├── ClarityCoach.js           # Frame 2: Socratic questioning
│   │   │   └── MomentumPartner.js        # Frame 3: Action & celebration
│   │   ├── orchestrator/
│   │   │   ├── Orchestrator.js           # Main orchestration logic
│   │   │   └── InputAnalyzer.js          # Analyzes user input
│   │   ├── metrics/
│   │   │   ├── MetricsTracker.js         # Tracks metrics from Python service
│   │   │   └── metricsService.js         # Python service client
│   │   └── services/
│   │       └── gemini.js                 # Gemini API wrapper
│   └── routes/
│       ├── api/chat/+server.js           # Main chat endpoint
│       └── +page.svelte                  # Chat UI
├── metrics-service/                      # Python FastAPI service
│   ├── main.py                           # Metrics calculation endpoints
│   ├── requirements.txt                  # Python dependencies
│   └── venv/                             # Python virtual environment
├── docs/
│   ├── ARCHITECTURE.md                   # Detailed architecture
│   └── NEXT_STEPS.md                     # Future improvements
├── .env                                  # Environment variables
├── package.json                          # Node dependencies
└── README.md                             # This file
```

## Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Development

### Making Changes

**Frontend (SvelteKit):**
- Edit files in `src/`
- Changes hot-reload automatically
- Check browser console for errors

**Backend (Python):**
- Edit `metrics-service/main.py`
- Restart the Python service (Ctrl+C, then `python main.py`)
- Check terminal for errors

### Debugging

**Enable Metrics Panel:**
Click "Show Metrics" button in the UI to see real-time metrics.

**Check Backend Logs:**
- Frontend logs: Browser console (F12)
- Python logs: Terminal running `python main.py`

**Common Issues:**

1. **"Connection refused" error**
   - Make sure Python service is running on port 8000
   - Check: `curl http://localhost:8000/health`

2. **"API key not found"**
   - Verify `.env` file exists with `GEMINI_API_KEY`
   - Restart the dev server after adding .env

3. **Metrics showing 100/100**
   - Check Python service logs for errors
   - Ensure venv is activated before running

4. **Port already in use**
   - Kill existing processes:
   ```bash
   lsof -ti:8000 | xargs kill -9  # Python service
   lsof -ti:5173 | xargs kill -9  # Frontend
   ```

## Testing the System

### Test Scenarios

**Test Low Authenticity (Should score ~20-30):**
```
User: "I'm fine"
Expected: Sentiment Authenticity drops, Clarity Coach engages
```

**Test High Authenticity (Should score ~80-95):**
```
User: "I'm really struggling and feeling overwhelmed"
Expected: Sentiment Authenticity high, Reflective Listener engages
```

**Test Frame Switching:**
```
User: "I don't know what's wrong with my life"  → Reflective Listener
User: "What should I focus on first?"           → Clarity Coach
User: "I'm going to try that tomorrow"          → Momentum Partner
```

## Deployment

### Vercel (Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variable in Vercel dashboard:
# Settings → Environment Variables → GEMINI_API_KEY
```

### Python Service Deployment

The Python metrics service can be deployed to:
- **Render** - [Guide](https://render.com/docs/deploy-fastapi)
- **Railway** - [Guide](https://docs.railway.app/guides/python)
- **Fly.io** - [Guide](https://fly.io/docs/languages-and-frameworks/python/)

Update `src/lib/services/metricsService.js` line 3 with your deployed URL:
```javascript
const METRICS_SERVICE_URL = 'https://your-metrics-service.onrender.com';
```

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed system architecture and design decisions
- **[docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)** - Future improvements and features

## Key Features

✅ Real-time sentiment analysis with VADER + TextBlob
✅ Dynamic frame switching based on emotional state
✅ Metrics-driven conversation quality monitoring
✅ Performative positivity detection
✅ Validation-before-reframing enforcement
✅ User solution tracking and scaffolding

## License

MIT

---

**Need help?** Check the troubleshooting section above or review the architecture docs.
