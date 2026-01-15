# Consensus: Multi-LLM Debate Tool

A web app that lets you watch AI models debate each other to find consensus. Paste your question, and Claude, GPT-4, and Gemini will discuss, critique each other, and revise their positions.

## What It Does

```
You: "How should I structure this database schema?"
     ↓
┌─────────────────────────────────────┐
│  Claude, GPT, Gemini respond        │
│  Round 1: Initial answers           │
│           ↓                         │
│  Round 2: Each model sees others'   │
│           responses, critiques      │
│           ↓                         │
│  Final: Consensus summary           │
│         "Agree on X, differ on Y"   │
└─────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+
- API keys for at least 2 of: Anthropic, OpenAI, Google

### Install uv (if needed)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Option 1: Use the start script

```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual startup

```bash
# Terminal 1: Backend
uv sync
uv run consensus

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev
```

Then open **http://localhost:3000**, paste your API keys, and start debating!

## 🔧 API Keys Needed

| Model  | Get Key From |
|--------|--------------|
| Claude | https://console.anthropic.com/ |
| GPT-4  | https://platform.openai.com/api-keys |
| Gemini | https://aistudio.google.com/apikey |

## Cost Estimate

Per debate (2 rounds, 3 models):
- Claude: ~$0.02-0.05
- GPT-4: ~$0.02-0.05  
- Gemini: ~$0.01-0.02

**Total: ~$0.05-0.15 per debate**

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  FastAPI Backend │
│  (Port 3000)    │     │  (Port 8000)     │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌─────────┐
              │ Claude  │  │  GPT-4  │  │ Gemini  │
              │   API   │  │   API   │  │   API   │
              └─────────┘  └─────────┘  └─────────┘
```

## 📁 Project Structure

```
consensus/
├── src/
│   └── consensus/
│       ├── __init__.py
│       └── main.py         # FastAPI server + LLM orchestration
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── pyproject.toml          # uv/Python project config
├── start.sh                # One-command startup
└── README.md
```

## 🛠️ Development

```bash
# Sync dependencies
uv sync

# Run backend with auto-reload
uv run consensus

# Run tests
uv run pytest

# Lint/format
uv run ruff check .
uv run ruff format .
```

## 🎨 Features

- **Parallel API calls**: All models respond simultaneously per round
- **Streaming responses**: See answers as they come in
- **Multi-round debates**: Models critique and revise each other
- **Consensus analysis**: Summary of agreements/disagreements
- **Flexible model selection**: Use 2 or 3 models
- **No server-side key storage**: Keys stay in your browser

## Future Ideas

- [ ] Save debate history
- [ ] Export debates as markdown
- [ ] Add more models (Llama, Mistral via API)
- [ ] Custom system prompts per model
- [ ] Token/cost tracking
- [ ] Voting/rating system for responses

## 📄 License

MIT — do whatever you want with it!
