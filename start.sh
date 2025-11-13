#!/bin/bash

# B-Me Startup Script
# Starts both the Python metrics service and SvelteKit frontend

echo "🚀 Starting B-Me Services..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your GEMINI_API_KEY"
    echo "Example: echo 'GEMINI_API_KEY=your_key' > .env"
    exit 1
fi

# Check/Create Python venv
if [ ! -d "venv" ]; then
    echo "📦 Python virtual environment not found. Creating..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
    echo "✅ Virtual environment created"
fi

# Activate venv and install/update requirements
echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r metrics-service/requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    exit 1
fi
echo "✅ Python dependencies installed"

# Check/Install node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Node modules not found. Installing..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install node modules"
        exit 1
    fi
    echo "✅ Node modules installed"
else
    echo "✅ Node modules found"
fi

echo ""
echo "✅ All dependencies ready"
echo ""

# Start Python metrics service in background
echo "📊 Starting Python Metrics Service (port 8000)..."
source venv/bin/activate
cd metrics-service
python main.py &
PYTHON_PID=$!
cd ..

# Wait for Python service to start
sleep 2

# Check if Python service started
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "❌ Failed to start Python metrics service"
    kill $PYTHON_PID 2>/dev/null
    exit 1
fi

echo "✅ Python Metrics Service running on http://localhost:8000"
echo ""

# Start SvelteKit frontend
echo "🎨 Starting SvelteKit Frontend (port 5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ B-Me is running!"
echo ""
echo "📊 Metrics Service: http://localhost:8000"
echo "🎨 Frontend:        http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Handle Ctrl+C gracefully
trap "echo ''; echo '🛑 Stopping services...'; kill $PYTHON_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Wait for both processes
wait
