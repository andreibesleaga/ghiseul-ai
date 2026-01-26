# GENIE.AI Working Configuration for 6GB GPU (Final)

**Date:** November 22, 2025  
**Hardware:** NVIDIA GeForce RTX 3060 Laptop GPU (6GB VRAM), AMD Ryzen 7 5800H  
**Status:** ✅ **WORKING** - Core RAG pipeline operational

---

## Executive Summary

Successfully configured GENIE.AI to run on 6GB GPU by:
1. Switching from granite-3.3-2b-instruct (2B params) to TinyLlama-1.1B-Chat-v1.0 (1.1B params)
2. Reducing max context length from 4096 to 1024 tokens
3. Fixing ChatCompletionRequest protocol default max_tokens=1024 to use CHATQNA_MAX_TOKENS=512
4. Optimizing GPU allocation (50% for main LLM, 25% for translation)
5. Disabling translation/guardrail services (insufficient GPU memory)

**Current GPU Usage:** 4.1GB / 6GB (68%)

---

## Working Services

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| vLLM (TinyLlama) | 8000 | ✅ Healthy | Main LLM inference |
| ChatQnA Backend | 8888 | ✅ Working | RAG orchestrator |
| TEI Embeddings | 7000 | ✅ Healthy | Text embeddings (BAAI/bge-base-en-v1.5) |
| TEI Reranker | 7100 | ✅ Healthy | Result reranking (ms-marco-MiniLM-L-6-v2) |
| OPEA Embedding | 6000 | ✅ Up | Embedding service wrapper |
| Retriever | 7025 | ✅ Up | Vector search in ArangoDB |
| Dataprep | 5000 | ✅ Up | Document ingestion |
| ArangoDB | 8529 | ✅ Healthy | Vector database |
| Redis | 6379 | ✅ Healthy | Cache |
| Kong Gateway | 8010 | ✅ Healthy | API gateway |
| ClamAV | 3310 | ✅ Healthy | Virus scanner |

### Disabled Services

| Service | Reason |
|---------|--------|
| vllm-translation-guardrail | Insufficient GPU memory (would need ~2GB) |
| llm-guardrail | Insufficient GPU memory |
| backend (Node.js) | Not critical for core RAG (restarting) |
| nginx | Not critical for core RAG (restarting) |

---

## Configuration Files

### 1. `.env` (Key Settings)

```bash
# LLM Model Configuration (Changed from granite-3.3-2b-instruct)
VLLM_LLM_MODEL_ID=TinyLlama/TinyLlama-1.1B-Chat-v1.0
VLLM_TRANSLATION_MODEL_ID=TinyLlama/TinyLlama-1.1B-Chat-v1.0
LLM_MODEL=TinyLlama/TinyLlama-1.1B-Chat-v1.0
LLM_TRANS_MODEL=TinyLlama/TinyLlama-1.1B-Chat-v1.0

# GPU Optimization
VLLM_GPU_UTIL=0.50                    # 50% GPU for main LLM (~3GB)
VLLM_TRANSLATION_GPU_UTIL=0.25         # 25% GPU for translation (disabled)
VLLM_MAX_MODEL_LEN=1024                # Reduced from 4096

# Token Limits for 6GB GPU
CHATQNA_MAX_TOKENS=512                 # Added to fix protocol default 1024

# Embeddings (Unchanged)
EMBEDDING_MODEL_ID=BAAI/bge-base-en-v1.5
RERANK_MODEL_ID=cross-encoder/ms-marco-MiniLM-L-6-v2
```

### 2. `docker-compose.yaml` (Key Changes)

```yaml
services:
  vllm:
    command:
      - --model
      - ${VLLM_LLM_MODEL_ID}
      - --port
      - "8000"
      - --served-model-name
      - ${VLLM_LLM_MODEL_ID}
      - --block-size
      - "128"
      - --max-model-len
      - ${VLLM_MAX_MODEL_LEN}
      - --gpu-memory-utilization
      - ${VLLM_GPU_UTIL}
      - --max_num_seqs
      - "12"                              # Reduced from 1024 → 16 → 12

  vllm-translation-guardrail:
    # Disabled in practice due to GPU memory
    command:
      - --max_num_seqs
      - "8"                               # Added to reduce memory

  chatqna-xeon-backend-server:
    environment:
      - CHATQNA_MAX_TOKENS=${CHATQNA_MAX_TOKENS}  # Pass to container
      - LLM_MODEL=${LLM_MODEL}
      - LLM_TRANS_MODEL=${LLM_TRANS_MODEL}
```

### 3. `genieai_chatqna.py` (Critical Fix)

**Problem:** `ChatCompletionRequest` has hardcoded `max_tokens: Optional[int] = 1024` default, which exceeds TinyLlama's context window (1024 - input_tokens).

**Solution:** Override protocol default when it's 1024:

```python
# Line 748-753 (approximately)
# Override protocol's default max_tokens=1024 with our env var for 6GB GPU
max_tokens_to_use = int(os.getenv("CHATQNA_MAX_TOKENS", "512"))
if chat_request.max_tokens and chat_request.max_tokens != 1024:
    # Client explicitly set a non-default value
    max_tokens_to_use = chat_request.max_tokens

parameters = LLMParams(
    max_tokens=max_tokens_to_use,
    # ... rest of parameters
)
```

**Also changed default model references:**
```python
LLM_MODEL = os.getenv("LLM_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
LLM_TRANS_MODEL = os.getenv("LLM_TRANS_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
```

---

## Testing & Validation

### 1. Basic Query Test

```bash
curl -X POST http://localhost:8888/v1/chatqna \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

**Expected Response:**
```json
{
  "response": "...The answer to the question is 4.",
  "metadata": {"source_documents": [], ...}
}
```

### 2. Custom max_tokens Test

```bash
curl -X POST http://localhost:8888/v1/chatqna \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 256
  }'
```

### 3. GPU Memory Verification

```bash
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

**Expected Output:**
```
memory.used [MiB], memory.total [MiB]
4164 MiB, 6144 MiB
```

### 4. Service Health Check

```bash
docker-compose ps
```

All core services (vllm, chatqna, tei, embedding, retriever, dataprep, arango, redis, kong) should be **Up** or **Healthy**.

---

## Troubleshooting

### Issue: "KeyError: 'choices'" in ChatQnA logs

**Cause:** vLLM returned error response when max_tokens too large, but ChatQnA expected 'choices' key.

**Solution:** Already fixed in `genieai_chatqna.py` by overriding protocol default max_tokens=1024 to 512.

### Issue: "No available memory for the cache blocks"

**Cause:** TinyLlama needs more GPU memory than available with current settings.

**Solutions:**
1. Reduce `max_num_seqs` further (try 10, 8, or 6)
2. Reduce `VLLM_GPU_UTIL` (try 0.45 or 0.40)
3. Reduce `VLLM_MAX_MODEL_LEN` (try 512 or 768)

### Issue: Translation service crashes

**Expected:** Translation service requires ~2GB additional GPU memory. Not possible on 6GB GPU with main LLM running.

**Workaround:** Keep translation service disabled. Main RAG pipeline works without it.

### Issue: Model output quality poor

**Expected:** TinyLlama (1.1B params) has limited capabilities compared to larger models. You may see:
- Repetitive text
- Hallucinations
- Prompt template leaking into responses

**Solutions:**
1. **Recommended:** Use cloud GPU (e.g., RunPod RTX 4090 24GB) for better models like granite-3.3-2b-instruct
2. Upgrade hardware to 12GB+ GPU (RTX 3060 12GB, RTX 4070 12GB, etc.)
3. Accept limitations for local testing/development

---

## Performance Characteristics

### Token Processing

- **Max Context:** 1024 tokens total
- **Max Output:** 512 tokens (configurable via `max_tokens` in request or `CHATQNA_MAX_TOKENS`)
- **Practical Input Limit:** ~400-500 tokens to leave room for response
- **Throughput:** ~12 concurrent sequences (`max_num_seqs=12`)

### Memory Usage

| Component | GPU Memory | Description |
|-----------|-----------|-------------|
| Model weights | ~2.2GB | TinyLlama 1.1B FP16 |
| KV cache | ~1.5GB | 12 sequences × 1024 tokens |
| Overhead | ~0.5GB | CUDA context, activations |
| **Total** | **~4.1GB** | 68% of 6GB |

### Limitations

1. **No translation/guardrail**: Services disabled due to GPU memory
2. **Short context**: 1024 tokens total (input + output)
3. **Model quality**: TinyLlama much weaker than larger models
4. **Retrieval only**: RAG works, but generation quality limited

---

## Deployment Steps (Quick Reference)

1. **Install NVIDIA Container Toolkit:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

2. **Configure environment:**
   ```bash
   cd /home/andrei/work/genie-ai-replica
   # Verify .env has TinyLlama settings and CHATQNA_MAX_TOKENS=512
   ```

3. **Start services:**
   ```bash
   docker-compose down --remove-orphans
   docker system prune -f  # Optional: clean up disk space
   docker-compose up -d
   ```

4. **Verify health:**
   ```bash
   docker-compose ps
   nvidia-smi
   curl http://localhost:8888/v1/chatqna -X POST \
     -H "Content-Type: application/json" \
     -d '{"messages": [{"role": "user", "content": "Hello"}]}'
   ```

---

## Upgrade Paths

### Option 1: Cloud GPU (Recommended)

**Best choice:** RunPod RTX 4090 (24GB) or A100 (40GB/80GB)

**Benefits:**
- Run original models (granite-3.3-2b, gemma-3-1b)
- Enable all services (translation, guardrail)
- Better context windows (4096+ tokens)
- High throughput

**Cost:** ~$0.30-1.00/hour depending on GPU

### Option 2: Upgrade Local GPU

**Minimum recommended:** 12GB VRAM
- NVIDIA RTX 3060 12GB (~$300 used)
- NVIDIA RTX 4060 Ti 16GB (~$500)
- NVIDIA RTX 4070 12GB (~$550)

**Benefits:**
- Run granite-3.3-2b-instruct with full context
- Enable translation service
- No cloud costs

### Option 3: Multi-GPU Setup

Split services across 2× 6GB GPUs:
- GPU 0: Main LLM (vllm)
- GPU 1: Translation + embeddings

Requires Docker GPU device mapping changes.

---

## Files Modified

1. ✅ `.env` - Added CHATQNA_MAX_TOKENS=512, changed all model IDs to TinyLlama
2. ✅ `docker-compose.yaml` - Added CHATQNA_MAX_TOKENS to environment, reduced max_num_seqs
3. ✅ `genie-ai-overlay/chatqna/genieai_chatqna.py` - Fixed protocol default max_tokens, updated model defaults

---

## Success Criteria Met

- [x] NVIDIA GPU recognized in WSL2 Docker containers
- [x] vLLM running on 6GB GPU with TinyLlama
- [x] TEI embeddings operational
- [x] ArangoDB vector database connected
- [x] Retriever service working
- [x] Dataprep service operational
- [x] ChatQnA backend responding to queries
- [x] End-to-end RAG pipeline functional
- [x] GPU memory usage stable (~4GB/6GB)
- [x] max_tokens configuration fixed

---

## Known Limitations

1. **Model quality:** TinyLlama (1.1B) produces low-quality responses with hallucinations
2. **Context window:** Limited to 1024 tokens total (vs 4096+ in production configs)
3. **Translation disabled:** No multilingual support due to GPU memory constraints
4. **Guardrails disabled:** No content filtering/safety checks
5. **Throughput:** Limited to 12 concurrent requests (vs 1024 in full config)

---

## Conclusion

**Status:** Successfully running GENIE.AI on 6GB GPU with TinyLlama model.

**Use cases:**
- ✅ Development and testing of RAG pipeline
- ✅ Code/architecture debugging
- ✅ Local experimentation
- ❌ Production use (quality too low)
- ❌ Demo/presentation (responses unreliable)

**Recommendation:** Use this configuration for development only. For production or demonstrations, upgrade to 12GB+ GPU or use cloud GPU services.

---

## Contact & Support

For issues or questions:
1. Check logs: `docker logs <service-name>`
2. Verify GPU: `nvidia-smi`
3. Review this document's Troubleshooting section
4. Consult GENIE.AI documentation: https://github.com/opea-project/GenAIExamples

**Last updated:** 2025-11-22
**Configuration tested:** WSL2 Ubuntu 24.04, NVIDIA Driver 581.80, Docker 27.x

