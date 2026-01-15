#!/bin/bash

# Consensus - Start Script
# Starts both backend and frontend

echo "⚔️  Starting Consensus - Multi-LLM Debate Tool"
echo ""

# Check for uv
if ! command -v uv &> /dev/null; then
    echo "❌ uv is required but not installed."
    echo "   Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check for Node
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm is required but not installed."
    exit 1
fi

# Install backend dependencies and start
echo "📦 Setting up Python environment with uv..."
uv sync

# Start backend in background
echo "🚀 Starting backend on http://localhost:8000..."
uv run consensus &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install --silent

# Start frontend
echo "🚀 Starting frontend on http://localhost:3000..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Consensus is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Handle cleanup
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
