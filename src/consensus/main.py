"""
Consensus - Multi-LLM Debate Tool
Backend API for orchestrating debates between AI models
"""

import asyncio
import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import json
import uvicorn

app = FastAPI(title="Consensus API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models configuration
MODELS = {
    "claude": {
        "name": "Claude",
        "color": "#D97706",
        "api_url": "https://api.anthropic.com/v1/messages",
        "model": "claude-sonnet-4-20250514"
    },
    "gpt": {
        "name": "GPT-4o",
        "color": "#10B981",
        "api_url": "https://api.openai.com/v1/chat/completions",
        "model": "gpt-4o"
    },
    "gemini": {
        "name": "Gemini",
        "color": "#3B82F6",
        "api_url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        "model": "gemini-1.5-flash"
    }
}


class DebateRequest(BaseModel):
    context: str
    question: str
    api_keys: dict  # {"anthropic": "...", "openai": "...", "google": "..."}
    models: list[str] = ["claude", "gpt"]  # Which models to use
    rounds: int = 2  # Number of debate rounds


class DebateResponse(BaseModel):
    round: int
    model: str
    model_name: str
    response: str
    is_revision: bool = False


async def call_claude(client: httpx.AsyncClient, api_key: str, messages: list[dict], system: str = None) -> str:
    """Call Claude API"""
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": MODELS["claude"]["model"],
        "max_tokens": 4000,
        "messages": messages
    }
    if system:
        payload["system"] = system
    
    try:
        response = await client.post(
            MODELS["claude"]["api_url"],
            headers=headers,
            json=payload,
            timeout=60.0
        )
        if response.status_code != 200:
            error_detail = response.text
            try:
                error_json = response.json()
                error_detail = error_json.get("error", {}).get("message", response.text)
            except:
                pass
            return f"Claude API Error ({response.status_code}): {error_detail}"
        data = response.json()
        return data["content"][0]["text"]
    except httpx.TimeoutException:
        return "Error: Claude API request timed out"
    except Exception as e:
        return f"Error calling Claude: {str(e)}"


async def call_gpt(client: httpx.AsyncClient, api_key: str, messages: list[dict], system: str = None) -> str:
    """Call OpenAI GPT API"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    full_messages = []
    if system:
        full_messages.append({"role": "system", "content": system})
    full_messages.extend(messages)
    
    payload = {
        "model": MODELS["gpt"]["model"],
        "max_tokens": 4000,
        "messages": full_messages
    }
    
    try:
        response = await client.post(
            MODELS["gpt"]["api_url"],
            headers=headers,
            json=payload,
            timeout=60.0
        )
        if response.status_code != 200:
            error_detail = response.text
            try:
                error_json = response.json()
                error_detail = error_json.get("error", {}).get("message", response.text)
            except:
                pass
            return f"GPT API Error ({response.status_code}): {error_detail}"
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except httpx.TimeoutException:
        return "Error: GPT API request timed out"
    except Exception as e:
        return f"Error calling GPT: {str(e)}"


async def call_gemini(client: httpx.AsyncClient, api_key: str, messages: list[dict], system: str = None) -> str:
    """Call Google Gemini API"""
    url = f"{MODELS['gemini']['api_url']}?key={api_key}"
    
    # Convert messages to Gemini format
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}]
        })
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 4000
        }
    }
    
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    
    try:
        response = await client.post(
            url,
            json=payload,
            timeout=60.0
        )
        if response.status_code != 200:
            error_detail = response.text
            try:
                error_json = response.json()
                error_detail = error_json.get("error", {}).get("message", response.text)
            except:
                pass
            return f"Gemini API Error ({response.status_code}): {error_detail}"
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except httpx.TimeoutException:
        return "Error: Gemini API request timed out"
    except Exception as e:
        return f"Error calling Gemini: {str(e)}"


async def call_model(client: httpx.AsyncClient, model_id: str, api_keys: dict, messages: list[dict], system: str = None) -> str:
    """Route to appropriate model API"""
    if model_id == "claude":
        return await call_claude(client, api_keys.get("anthropic", ""), messages, system)
    elif model_id == "gpt":
        return await call_gpt(client, api_keys.get("openai", ""), messages, system)
    elif model_id == "gemini":
        return await call_gemini(client, api_keys.get("google", ""), messages, system)
    else:
        return f"Unknown model: {model_id}"


def analyze_consensus(responses: dict[str, str]) -> dict:
    """Analyze responses to find areas of agreement and disagreement"""
    # This is a simple heuristic approach
    # In production, you might use an LLM to analyze consensus
    
    model_names = list(responses.keys())
    
    # Simple word overlap analysis
    response_words = {
        model: set(resp.lower().split())
        for model, resp in responses.items()
    }
    
    # Find common themes (words appearing in all responses)
    if len(response_words) > 1:
        common_words = set.intersection(*response_words.values())
        # Filter out common stop words
        stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
                      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
                      'can', 'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by',
                      'from', 'as', 'into', 'through', 'during', 'before', 'after',
                      'above', 'below', 'between', 'under', 'again', 'further',
                      'then', 'once', 'here', 'there', 'when', 'where', 'why',
                      'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
                      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
                      'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
                      'because', 'until', 'while', 'although', 'this', 'that',
                      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
                      'what', 'which', 'who', 'whom', 'its', 'his', 'her', 'their',
                      'our', 'your', 'my', '-', '–', '—', '.', ',', ':', ';', '!', '?'}
        meaningful_common = common_words - stop_words
        meaningful_common = {w for w in meaningful_common if len(w) > 3}
    else:
        meaningful_common = set()
    
    return {
        "models_compared": model_names,
        "common_themes": list(meaningful_common)[:10],  # Top 10 common words
        "response_lengths": {model: len(resp) for model, resp in responses.items()}
    }


async def run_debate_stream(request: DebateRequest):
    """Run a multi-round debate between models, streaming results"""
    async with httpx.AsyncClient() as client:
        all_responses = {}  # {model_id: [round1_response, round2_response, ...]}
        
        for model_id in request.models:
            all_responses[model_id] = []
        
        for round_num in range(1, request.rounds + 1):
            # Prepare prompts for this round
            tasks = []
            
            for model_id in request.models:
                if round_num == 1:
                    # First round: just answer the question
                    system = """You are participating in a multi-AI debate. 
Give your honest, well-reasoned response to the question. 
Be concise but thorough. Structure your response clearly."""
                    
                    messages = [{
                        "role": "user",
                        "content": f"""Context: {request.context}

Question: {request.question}

Please provide your analysis and answer."""
                    }]
                else:
                    # Later rounds: see others' responses and critique/revise
                    other_responses = []
                    for other_model in request.models:
                        if other_model != model_id and all_responses[other_model]:
                            other_responses.append(
                                f"**{MODELS[other_model]['name']}**: {all_responses[other_model][-1]}"
                            )
                    
                    system = """You are participating in a multi-AI debate. 
You've seen other AI models' responses. Now:
1. Note where you agree or disagree
2. Critique any flawed reasoning you see
3. Revise your position if warranted, or defend it if you stand by it
Be direct and substantive. Don't be sycophantic."""
                    
                    messages = [{
                        "role": "user",
                        "content": f"""Context: {request.context}

Question: {request.question}

Your previous response: {all_responses[model_id][-1] if all_responses[model_id] else 'N/A'}

Other models' responses:
{chr(10).join(other_responses)}

Please critique the other responses and revise your position if needed. What do you agree on? Where do you disagree?"""
                    }]
                
                tasks.append((model_id, call_model(client, model_id, request.api_keys, messages, system)))
            
            # Run all models in parallel for this round
            results = await asyncio.gather(*[task[1] for task in tasks])
            
            # Stream results for this round
            for (model_id, _), response in zip(tasks, results):
                all_responses[model_id].append(response)
                
                result = {
                    "type": "response",
                    "round": round_num,
                    "model": model_id,
                    "model_name": MODELS[model_id]["name"],
                    "color": MODELS[model_id]["color"],
                    "response": response,
                    "is_revision": round_num > 1
                }
                yield f"data: {json.dumps(result)}\n\n"
        
        # Final consensus analysis
        final_responses = {model_id: responses[-1] for model_id, responses in all_responses.items()}
        consensus = analyze_consensus(final_responses)
        
        # Use one of the models to generate a consensus summary
        summary_model = request.models[0]
        summary_prompt = f"""Analyze these AI responses to the question: "{request.question}"

"""
        for model_id, response in final_responses.items():
            summary_prompt += f"**{MODELS[model_id]['name']}**: {response}\n\n"
        
        summary_prompt += """
Provide a brief consensus summary:
1. **Areas of Agreement**: What do the models agree on?
2. **Areas of Disagreement**: Where do they differ?
3. **Key Insights**: What are the most valuable takeaways?

Be concise and specific."""

        summary = await call_model(
            client, 
            summary_model, 
            request.api_keys, 
            [{"role": "user", "content": summary_prompt}],
            "You are a neutral analyst summarizing a debate between AI models. Be objective and balanced."
        )
        
        consensus_result = {
            "type": "consensus",
            "summary": summary,
            "analysis": consensus
        }
        yield f"data: {json.dumps(consensus_result)}\n\n"
        
        yield "data: {\"type\": \"done\"}\n\n"


@app.post("/debate")
async def start_debate(request: DebateRequest):
    """Start a debate between AI models"""
    # Validate that we have API keys for requested models
    required_keys = {
        "claude": "anthropic",
        "gpt": "openai", 
        "gemini": "google"
    }
    
    for model in request.models:
        key_name = required_keys.get(model)
        if key_name and not request.api_keys.get(key_name):
            raise HTTPException(
                status_code=400, 
                detail=f"Missing API key for {model}: need '{key_name}' key"
            )
    
    return StreamingResponse(
        run_debate_stream(request),
        media_type="text/event-stream"
    )


@app.get("/models")
async def get_models():
    """Get available models"""
    return {
        model_id: {
            "name": config["name"],
            "color": config["color"]
        }
        for model_id, config in MODELS.items()
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "consensus-api"}


def run():
    """Entry point for the consensus CLI command."""
    uvicorn.run("consensus.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()