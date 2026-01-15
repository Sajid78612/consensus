import React, { useState, useRef, useEffect } from 'react';

const MODELS = {
  claude: { name: 'Claude', color: '#D97706', icon: '🟠' },
  gpt: { name: 'GPT-4', color: '#10B981', icon: '🟢' },
  gemini: { name: 'Gemini', color: '#3B82F6', icon: '🔵' }
};

function App() {
  const [apiKeys, setApiKeys] = useState({
    anthropic: '',
    openai: '',
    google: ''
  });
  const [selectedModels, setSelectedModels] = useState(['claude', 'gpt']);
  const [context, setContext] = useState('');
  const [question, setQuestion] = useState('');
  const [rounds, setRounds] = useState(2);
  const [isDebating, setIsDebating] = useState(false);
  const [responses, setResponses] = useState({});
  const [consensus, setConsensus] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [showSettings, setShowSettings] = useState(true);
  
  const abortController = useRef(null);

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter(m => m !== modelId));
      }
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  const startDebate = async () => {
    setIsDebating(true);
    setResponses({});
    setConsensus(null);
    setCurrentRound(1);
    setShowSettings(false);

    // Initialize response containers for each model
    const initialResponses = {};
    selectedModels.forEach(m => {
      initialResponses[m] = [];
    });
    setResponses(initialResponses);

    try {
      abortController.current = new AbortController();
      
      const response = await fetch('http://localhost:8000/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          question,
          api_keys: apiKeys,
          models: selectedModels,
          rounds
        }),
        signal: abortController.current.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'response') {
                setCurrentRound(data.round);
                setResponses(prev => ({
                  ...prev,
                  [data.model]: [...(prev[data.model] || []), {
                    round: data.round,
                    content: data.response,
                    isRevision: data.is_revision
                  }]
                }));
              } else if (data.type === 'consensus') {
                setConsensus(data);
              } else if (data.type === 'done') {
                setIsDebating(false);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Debate error:', error);
        alert('Error running debate: ' + error.message);
      }
      setIsDebating(false);
    }
  };

  const stopDebate = () => {
    if (abortController.current) {
      abortController.current.abort();
    }
    setIsDebating(false);
  };

  const resetDebate = () => {
    setResponses({});
    setConsensus(null);
    setCurrentRound(0);
    setShowSettings(true);
  };

  const hasRequiredKeys = () => {
    const keyMap = { claude: 'anthropic', gpt: 'openai', gemini: 'google' };
    return selectedModels.every(m => apiKeys[keyMap[m]]?.trim());
  };

  return (
    <div className="app">
      <header>
        <div className="logo">
          <span className="logo-icon">⚔️</span>
          <h1>Consensus</h1>
        </div>
        <p className="tagline">Multi-LLM Debate Arena</p>
      </header>

      <main>
        {showSettings && (
          <section className="setup-panel">
            <div className="api-keys">
              <h3>🔑 API Keys</h3>
              <div className="key-inputs">
                <div className="key-input">
                  <label>Anthropic (Claude)</label>
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKeys.anthropic}
                    onChange={e => setApiKeys({...apiKeys, anthropic: e.target.value})}
                  />
                </div>
                <div className="key-input">
                  <label>OpenAI (GPT)</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKeys.openai}
                    onChange={e => setApiKeys({...apiKeys, openai: e.target.value})}
                  />
                </div>
                <div className="key-input">
                  <label>Google (Gemini)</label>
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={apiKeys.google}
                    onChange={e => setApiKeys({...apiKeys, google: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="model-selector">
              <h3>🤖 Select Models</h3>
              <div className="models">
                {Object.entries(MODELS).map(([id, model]) => (
                  <button
                    key={id}
                    className={`model-btn ${selectedModels.includes(id) ? 'selected' : ''}`}
                    onClick={() => toggleModel(id)}
                    style={{
                      '--model-color': model.color,
                      borderColor: selectedModels.includes(id) ? model.color : 'transparent'
                    }}
                  >
                    <span className="model-icon">{model.icon}</span>
                    <span className="model-name">{model.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounds-selector">
              <h3>🔄 Debate Rounds</h3>
              <div className="rounds-buttons">
                {[1, 2, 3].map(r => (
                  <button
                    key={r}
                    className={`round-btn ${rounds === r ? 'selected' : ''}`}
                    onClick={() => setRounds(r)}
                  >
                    {r} {r === 1 ? 'Round' : 'Rounds'}
                  </button>
                ))}
              </div>
              <p className="rounds-note">
                Round 1: Initial responses • Round 2+: Critique & revise
              </p>
            </div>
          </section>
        )}

        <section className="debate-input">
          <div className="input-group">
            <label>Context (optional)</label>
            <textarea
              placeholder="Paste any relevant context, code, documents, or background information..."
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={4}
            />
          </div>
          <div className="input-group">
            <label>Question</label>
            <textarea
              placeholder="What do you want the models to debate?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={2}
            />
          </div>
          <div className="actions">
            {!isDebating ? (
              <>
                <button
                  className="start-btn"
                  onClick={startDebate}
                  disabled={!question.trim() || !hasRequiredKeys()}
                >
                  ⚔️ Start Debate
                </button>
                {!showSettings && (
                  <button className="reset-btn" onClick={resetDebate}>
                    ↩️ Settings
                  </button>
                )}
              </>
            ) : (
              <button className="stop-btn" onClick={stopDebate}>
                ⏹️ Stop Debate
              </button>
            )}
          </div>
        </section>

        {Object.keys(responses).length > 0 && (
          <section className="debate-arena">
            <div className="round-indicator">
              <span className="pulse"></span>
              {isDebating ? `Round ${currentRound} in progress...` : `Debate Complete`}
            </div>
            
            <div className="responses-grid" style={{ 
              gridTemplateColumns: `repeat(${selectedModels.length}, 1fr)` 
            }}>
              {selectedModels.map(modelId => (
                <div 
                  key={modelId} 
                  className="model-column"
                  style={{ '--model-color': MODELS[modelId].color }}
                >
                  <div className="model-header">
                    <span className="model-icon">{MODELS[modelId].icon}</span>
                    <span>{MODELS[modelId].name}</span>
                  </div>
                  <div className="model-responses">
                    {(responses[modelId] || []).map((resp, idx) => (
                      <div key={idx} className={`response ${resp.isRevision ? 'revision' : ''}`}>
                        <div className="response-header">
                          Round {resp.round}
                          {resp.isRevision && <span className="revision-badge">Revised</span>}
                        </div>
                        <div className="response-content">
                          {resp.content}
                        </div>
                      </div>
                    ))}
                    {isDebating && (!responses[modelId] || responses[modelId].length < currentRound) && (
                      <div className="thinking">
                        <div className="thinking-dots">
                          <span></span><span></span><span></span>
                        </div>
                        Thinking...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {consensus && (
          <section className="consensus-panel">
            <h2>📊 Consensus Analysis</h2>
            <div className="consensus-content">
              {consensus.summary}
            </div>
            {consensus.analysis?.common_themes?.length > 0 && (
              <div className="common-themes">
                <h4>Common Themes</h4>
                <div className="theme-tags">
                  {consensus.analysis.common_themes.map((theme, i) => (
                    <span key={i} className="theme-tag">{theme}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer>
        <p>Built for rapid AI consensus • Costs ~$0.05-0.15 per debate</p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .app {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e4e4e7;
          font-family: 'Space Grotesk', system-ui, sans-serif;
        }

        header {
          padding: 2rem;
          text-align: center;
          background: linear-gradient(180deg, #18181b 0%, #0a0a0f 100%);
          border-bottom: 1px solid #27272a;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }

        .logo-icon {
          font-size: 2.5rem;
        }

        .logo h1 {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #fbbf24 0%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tagline {
          color: #71717a;
          margin-top: 0.5rem;
          font-size: 1.1rem;
        }

        main {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        section {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        h3 {
          font-size: 1rem;
          color: #a1a1aa;
          margin-bottom: 1rem;
          font-weight: 500;
        }

        .setup-panel {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 900px) {
          .setup-panel {
            grid-template-columns: 1fr;
          }
        }

        .key-inputs {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .key-input label {
          display: block;
          font-size: 0.85rem;
          color: #71717a;
          margin-bottom: 0.25rem;
        }

        .key-input input {
          width: 100%;
          padding: 0.75rem;
          background: #0a0a0f;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          color: #e4e4e7;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
        }

        .key-input input:focus {
          outline: none;
          border-color: #fbbf24;
        }

        .models {
          display: flex;
          gap: 0.75rem;
        }

        .model-btn {
          flex: 1;
          padding: 1rem;
          background: #0a0a0f;
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .model-btn:hover {
          background: #1f1f23;
        }

        .model-btn.selected {
          background: color-mix(in srgb, var(--model-color) 15%, #0a0a0f);
        }

        .model-icon {
          font-size: 1.5rem;
        }

        .model-name {
          color: #e4e4e7;
          font-weight: 500;
        }

        .rounds-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .round-btn {
          flex: 1;
          padding: 0.75rem;
          background: #0a0a0f;
          border: 2px solid #3f3f46;
          border-radius: 8px;
          color: #a1a1aa;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .round-btn.selected {
          border-color: #fbbf24;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
        }

        .rounds-note {
          font-size: 0.8rem;
          color: #52525b;
          margin-top: 0.75rem;
        }

        .debate-input {
          background: #18181b;
        }

        .input-group {
          margin-bottom: 1rem;
        }

        .input-group label {
          display: block;
          font-size: 0.9rem;
          color: #a1a1aa;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .input-group textarea {
          width: 100%;
          padding: 1rem;
          background: #0a0a0f;
          border: 1px solid #3f3f46;
          border-radius: 12px;
          color: #e4e4e7;
          font-family: inherit;
          font-size: 1rem;
          resize: vertical;
          line-height: 1.5;
        }

        .input-group textarea:focus {
          outline: none;
          border-color: #fbbf24;
        }

        .actions {
          display: flex;
          gap: 1rem;
        }

        .start-btn, .stop-btn, .reset-btn {
          padding: 1rem 2rem;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .start-btn {
          background: linear-gradient(135deg, #fbbf24 0%, #f97316 100%);
          color: #0a0a0f;
          flex: 1;
        }

        .start-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(251, 191, 36, 0.3);
        }

        .start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .stop-btn {
          background: #dc2626;
          color: white;
          flex: 1;
        }

        .reset-btn {
          background: #27272a;
          color: #a1a1aa;
        }

        .debate-arena {
          background: #0f0f13;
        }

        .round-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #18181b;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }

        .pulse {
          width: 10px;
          height: 10px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .responses-grid {
          display: grid;
          gap: 1.5rem;
        }

        .model-column {
          background: #18181b;
          border-radius: 12px;
          border: 1px solid #27272a;
          overflow: hidden;
        }

        .model-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: color-mix(in srgb, var(--model-color) 20%, #18181b);
          border-bottom: 1px solid var(--model-color);
          font-weight: 600;
        }

        .model-responses {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 600px;
          overflow-y: auto;
        }

        .response {
          background: #0a0a0f;
          border-radius: 8px;
          padding: 1rem;
          border-left: 3px solid var(--model-color);
        }

        .response.revision {
          border-left-style: dashed;
        }

        .response-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #71717a;
          margin-bottom: 0.75rem;
          font-weight: 500;
        }

        .revision-badge {
          background: #3f3f46;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .response-content {
          font-size: 0.95rem;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .thinking {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          color: #71717a;
          font-style: italic;
        }

        .thinking-dots {
          display: flex;
          gap: 4px;
        }

        .thinking-dots span {
          width: 8px;
          height: 8px;
          background: var(--model-color);
          border-radius: 50%;
          animation: bounce 1.4s infinite;
        }

        .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }

        .consensus-panel {
          background: linear-gradient(135deg, #1e1b4b 0%, #18181b 100%);
          border-color: #4338ca;
        }

        .consensus-panel h2 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          color: #a5b4fc;
        }

        .consensus-content {
          font-size: 1rem;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .common-themes {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #27272a;
        }

        .common-themes h4 {
          font-size: 0.9rem;
          color: #71717a;
          margin-bottom: 0.75rem;
        }

        .theme-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .theme-tag {
          background: #3f3f46;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.85rem;
        }

        footer {
          text-align: center;
          padding: 2rem;
          color: #52525b;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}

export default App;
