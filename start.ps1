# Consensus - Start Script (Windows)
# Starts both backend and frontend

Write-Host "⚔️  Starting Consensus - Multi-LLM Debate Tool" -ForegroundColor Yellow
Write-Host ""

# Check for uv
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "❌ uv is required but not installed." -ForegroundColor Red
    Write-Host "   Install with: irm https://astral.sh/uv/install.ps1 | iex"
    exit 1
}

# Check for Node
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js/npm is required but not installed." -ForegroundColor Red
    exit 1
}

# Install backend dependencies
Write-Host "📦 Setting up Python environment with uv..." -ForegroundColor Cyan
uv sync

# Start backend in background
Write-Host "🚀 Starting backend on http://localhost:8000..." -ForegroundColor Green
$backend = Start-Process -FilePath "uv" -ArgumentList "run", "consensus" -PassThru -NoNewWindow

# Wait for backend to start
Start-Sleep -Seconds 2

# Install frontend dependencies and start
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Cyan
Push-Location frontend
npm install --silent

Write-Host "🚀 Starting frontend on http://localhost:3000..." -ForegroundColor Green
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -NoNewWindow
Pop-Location

Write-Host ""
Write-Host "✅ Consensus is running!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:3000"
Write-Host "   Backend:  http://localhost:8000"
Write-Host ""
Write-Host "Press Ctrl+C to stop, then run: " -NoNewline
Write-Host "Stop-Process -Id $($backend.Id), $($frontend.Id)" -ForegroundColor Yellow

# Wait for user interrupt
try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    # Cleanup on exit
    if (!$backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
    if (!$frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
}
