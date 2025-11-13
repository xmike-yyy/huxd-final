from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import re
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import nltk

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('brown', quiet=True)
except:
    pass

app = FastAPI(title="B-Me Metrics Service")

# CORS middleware to allow requests from SvelteKit
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sentiment analyzer
vader = SentimentIntensityAnalyzer()

# Pydantic models
class UserMessage(BaseModel):
    text: str
    role: str = "user"

class ConversationHistory(BaseModel):
    messages: List[UserMessage]

class ValidationRequest(BaseModel):
    user_message: str
    agent_response: str

# ============== SENTIMENT AUTHENTICITY ==============

def calculate_sentiment_authenticity(user_messages: List[str]) -> dict:
    """
    Analyze user messages for emotional authenticity using VADER and TextBlob.
    Uses sentiment analysis to detect genuine emotional expression vs performative positivity.
    """
    if not user_messages:
        return {"score": 50, "reasoning": "No messages to analyze"}

    # Take last 5 messages
    recent_messages = user_messages[-5:]

    # Start at baseline of 50
    base_score = 50

    details = {
        "sentiment_variation": 0,
        "emotional_intensity": 0,
        "subjectivity": 0,
        "performative_positivity_penalty": 0,
        "authenticity_bonus": 0
    }

    vader_scores = []
    polarities = []
    subjectivities = []
    intensities = []

    for msg in recent_messages:
        # Get VADER sentiment analysis
        vader_result = vader.polarity_scores(msg)
        vader_scores.append(vader_result)

        # Get TextBlob analysis
        blob = TextBlob(msg)
        polarities.append(blob.sentiment.polarity)
        subjectivities.append(blob.sentiment.subjectivity)

        # Track intensity (absolute value of compound score)
        intensities.append(abs(vader_result['compound']))

    # 1. Sentiment Variation (0-25 points)
    # Authentic conversations show emotional range
    if len(polarities) > 1:
        polarity_range = max(polarities) - min(polarities)
        if polarity_range > 0.6:  # High variation
            details["sentiment_variation"] = 25
        elif polarity_range > 0.3:  # Moderate variation
            details["sentiment_variation"] = 15
        elif polarity_range > 0.1:  # Some variation
            details["sentiment_variation"] = 8
        else:  # Flat sentiment (suspicious)
            details["sentiment_variation"] = -10

    # 2. Emotional Intensity (0-25 points)
    # Authentic emotions show up with intensity (not flat/neutral)
    avg_intensity = sum(intensities) / len(intensities) if intensities else 0
    if avg_intensity > 0.5:  # Strong emotions
        details["emotional_intensity"] = 25
    elif avg_intensity > 0.3:  # Moderate emotions
        details["emotional_intensity"] = 15
    elif avg_intensity > 0.1:  # Some emotion
        details["emotional_intensity"] = 5
    else:  # Very flat/neutral (lacks authenticity)
        details["emotional_intensity"] = -15

    # 3. Subjectivity (0-20 points)
    # Authentic sharing is subjective/personal, not just factual
    avg_subjectivity = sum(subjectivities) / len(subjectivities) if subjectivities else 0
    if avg_subjectivity > 0.5:  # Highly personal/emotional
        details["subjectivity"] = 20
    elif avg_subjectivity > 0.3:  # Somewhat personal
        details["subjectivity"] = 10
    else:  # Too factual/detached
        details["subjectivity"] = -5

    # 4. Performative Positivity Detection (-30 points)
    # High positive sentiment + low intensity/subjectivity = fake positivity
    avg_polarity = sum(polarities) / len(polarities) if polarities else 0

    if avg_polarity > 0.3 and avg_intensity < 0.3:
        # Positive but not intense = "I'm fine"
        details["performative_positivity_penalty"] = -30
    elif avg_polarity > 0.5 and avg_subjectivity < 0.3:
        # Very positive but not personal = generic cheerfulness
        details["performative_positivity_penalty"] = -25

    # Also check for toxic positivity phrases
    toxic_positivity = [
        "i'm fine", "everything's great", "just stay positive", "it's all good",
        "no worries", "it could be worse", "at least", "just gotta"
    ]
    for msg in recent_messages:
        if any(phrase in msg.lower() for phrase in toxic_positivity):
            details["performative_positivity_penalty"] = min(
                details["performative_positivity_penalty"] - 15, -30
            )
            break

    # 5. Authenticity Bonus (0-10 points)
    # Negative emotions with high intensity = vulnerable/authentic
    if avg_polarity < -0.1 and avg_intensity > 0.4:
        details["authenticity_bonus"] = 10

    # Calculate final score
    total_score = base_score + sum(details.values())

    # Clamp to 0-100
    total_score = max(0, min(100, total_score))

    # Generate reasoning
    reasoning = f"Analyzed {len(recent_messages)} messages. "
    if total_score < 40:
        reasoning += "Low authenticity - flat affect or performative positivity detected."
    elif total_score > 70:
        reasoning += "High authenticity - genuine emotional range and intensity."
    else:
        reasoning += "Moderate authenticity - some emotional expression."

    return {
        "score": round(total_score),
        "reasoning": reasoning,
        "details": details,
        "analysis": {
            "avg_sentiment": round(avg_polarity, 2),
            "avg_intensity": round(avg_intensity, 2),
            "avg_subjectivity": round(avg_subjectivity, 2)
        }
    }


@app.post("/metrics/sentiment-authenticity")
async def analyze_sentiment_authenticity(history: ConversationHistory):
    """Analyze sentiment authenticity from user messages."""
    try:
        user_messages = [msg.text for msg in history.messages if msg.role == "user"]
        result = calculate_sentiment_authenticity(user_messages)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== VALIDATION COMPLIANCE ==============

def check_validation_compliance(user_message: str, agent_response: str) -> dict:
    """
    Check if agent validates emotions before offering reframes or advice.
    """
    text_lower = agent_response.lower()

    # Detect reframe/advice/solution patterns
    reframe_patterns = [
        r'another way to (see|think|look)',
        r'what if',
        r'you (might|could|should) (try|consider)',
        r'have you (tried|thought about|considered)',
        r'it (helps|might help) to',
        r'one (thing|way|approach)',
    ]

    has_reframe = any(re.search(pattern, text_lower) for pattern in reframe_patterns)

    if not has_reframe:
        return {
            "compliant": True,
            "has_reframe": False,
            "has_validation": False,
            "reasoning": "No reframe detected - no validation needed"
        }

    # Detect validation patterns (should appear BEFORE reframe)
    validation_patterns = [
        r'(that|it) (sounds|seems|feels) (like|really|so)',
        r'i (hear|understand|see) (that|you)',
        r'that makes sense',
        r'(it\'s|that\'s) (understandable|valid|reasonable)',
        r'anyone (in your situation |)would feel',
        r'i can (understand|imagine|see)',
    ]

    has_validation = any(re.search(pattern, text_lower) for pattern in validation_patterns)

    if not has_validation:
        return {
            "compliant": False,
            "has_reframe": True,
            "has_validation": False,
            "reasoning": "Reframe detected without emotional validation"
        }

    # Check if validation comes BEFORE reframe
    sentences = agent_response.split('.')
    validation_index = -1
    reframe_index = -1

    for i, sentence in enumerate(sentences):
        sentence_lower = sentence.lower()
        if validation_index == -1 and any(re.search(p, sentence_lower) for p in validation_patterns):
            validation_index = i
        if reframe_index == -1 and any(re.search(p, sentence_lower) for p in reframe_patterns):
            reframe_index = i

    if validation_index != -1 and reframe_index != -1:
        compliant = validation_index < reframe_index
        reasoning = "Validation before reframe" if compliant else "Reframe before validation"
    else:
        compliant = has_validation  # Has validation somewhere
        reasoning = "Validation and reframe both present"

    return {
        "compliant": compliant,
        "has_reframe": True,
        "has_validation": has_validation,
        "validation_first": validation_index < reframe_index if validation_index != -1 and reframe_index != -1 else None,
        "reasoning": reasoning
    }


@app.post("/metrics/validation-compliance")
async def analyze_validation_compliance(request: ValidationRequest):
    """Check if agent response validates emotions before reframing."""
    try:
        result = check_validation_compliance(request.user_message, request.agent_response)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== QUESTION RATIO ==============

def calculate_question_ratio(agent_messages: List[str]) -> dict:
    """Calculate ratio of questions to total sentences in agent responses."""
    if not agent_messages:
        return {"ratio": 100, "questions": 0, "total_sentences": 0}

    total_questions = 0
    total_sentences = 0

    for msg in agent_messages:
        # Split into sentences
        sentences = [s.strip() for s in re.split(r'[.!?]+', msg) if s.strip()]
        total_sentences += len(sentences)

        # Count questions (ends with ? or contains question words)
        questions = [s for s in sentences if '?' in s or
                    re.search(r'\b(what|how|why|when|where|who|which|could|would|do you)\b', s.lower())]
        total_questions += len(questions)

    if total_sentences == 0:
        return {"ratio": 100, "questions": 0, "total_sentences": 0}

    ratio = (total_questions / total_sentences) * 100

    return {
        "ratio": round(ratio, 1),
        "questions": total_questions,
        "total_sentences": total_sentences,
        "reasoning": f"{total_questions} questions out of {total_sentences} sentences"
    }


@app.post("/metrics/question-ratio")
async def analyze_question_ratio(history: ConversationHistory):
    """Calculate question-to-imperative ratio in agent messages."""
    try:
        agent_messages = [msg.text for msg in history.messages if msg.role == "model" or msg.role == "assistant"]
        result = calculate_question_ratio(agent_messages)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== USER PUSHBACK ==============

def detect_pushback(user_messages: List[str]) -> dict:
    """Detect user resistance/pushback in messages."""
    if not user_messages:
        return {"frequency": 0, "count": 0, "total": 0, "pushback_messages": []}

    resistance_patterns = [
        r'\b(but|however|though)\b',
        r"\bi can't\b",
        r"\bthat (won't|doesn't|wouldn't) work\b",
        r"\byou don't understand\b",
        r"\beasi(er|ly) said than done\b",
        r"\bnot that simple\b",
        r"\bwish it were that easy\b",
        r"\bi've tried that\b",
        r"\bthat doesn't help\b",
        r"\bi already (tried|know)\b",
    ]

    pushback_count = 0
    pushback_messages = []

    for msg in user_messages:
        has_pushback = any(re.search(pattern, msg.lower()) for pattern in resistance_patterns)
        if has_pushback:
            pushback_count += 1
            pushback_messages.append(msg[:100])  # Store first 100 chars

    frequency = (pushback_count / len(user_messages)) * 100

    return {
        "frequency": round(frequency, 1),
        "count": pushback_count,
        "total": len(user_messages),
        "pushback_messages": pushback_messages[:3],  # Return first 3
        "reasoning": f"{pushback_count} pushback instances in {len(user_messages)} messages"
    }


@app.post("/metrics/user-pushback")
async def analyze_user_pushback(history: ConversationHistory):
    """Detect user pushback/resistance in conversation."""
    try:
        user_messages = [msg.text for msg in history.messages if msg.role == "user"]
        result = detect_pushback(user_messages)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== USER SOLUTIONS ==============

def detect_user_solutions(user_messages: List[str]) -> dict:
    """Detect when users generate their own solutions."""
    if not user_messages:
        return {"count": 0, "solutions": [], "reasoning": "No messages"}

    solution_patterns = [
        r"\bi think i'?ll\b",
        r"\bmaybe i (could|can|should)\b",
        r"\bi'?m going to\b",
        r"\bi might try\b",
        r"\bi realize\b",
        r"\bi see now\b",
        r"\bit makes sense to\b",
        r"\bmy plan is\b",
        r"\bi'?ll start by\b",
        r"\bwhat if i\b",
        r"\bi could probably\b",
        r"\bi need to\b",
        r"\bi should\b",
    ]

    solution_count = 0
    solutions = []

    for msg in user_messages:
        has_solution = any(re.search(pattern, msg.lower()) for pattern in solution_patterns)
        if has_solution:
            solution_count += 1
            solutions.append(msg[:150])  # Store first 150 chars

    return {
        "count": solution_count,
        "solutions": solutions,
        "needs_scaffolding": len(user_messages) >= 10 and solution_count == 0,
        "reasoning": f"Found {solution_count} user-generated solutions"
    }


@app.post("/metrics/user-solutions")
async def analyze_user_solutions(history: ConversationHistory):
    """Detect user-generated solutions in conversation."""
    try:
        user_messages = [msg.text for msg in history.messages if msg.role == "user"]
        result = detect_user_solutions(user_messages)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== COMBINED METRICS ==============

@app.post("/metrics/all")
async def analyze_all_metrics(history: ConversationHistory):
    """Analyze all metrics at once."""
    try:
        user_messages = [msg.text for msg in history.messages if msg.role == "user"]
        agent_messages = [msg.text for msg in history.messages if msg.role == "model" or msg.role == "assistant"]

        return {
            "sentiment_authenticity": calculate_sentiment_authenticity(user_messages),
            "question_ratio": calculate_question_ratio(agent_messages),
            "user_pushback": detect_pushback(user_messages),
            "user_solutions": detect_user_solutions(user_messages),
            "exchange_count": min(len(user_messages), len(agent_messages))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== HEALTH CHECK ==============

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "B-Me Metrics Service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
