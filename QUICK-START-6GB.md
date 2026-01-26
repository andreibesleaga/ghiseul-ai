# QUICK START: GENIE.AI on 6GB GPU

## One-Command Test

```bash
curl -X POST http://localhost:8888/v1/chatqna \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is 2+2?"}]}'
```

## Start Services

```bash
cd /home/andrei/work/genie-ai-replica
docker-compose up -d
```

## Check Status

```bash
# GPU usage
nvidia-smi

# Services
docker-compose ps

# Logs
docker logs chatqna-xeon-backend-server
docker logs vllm-vllm-2
```

## Stop Services

```bash
docker-compose down
```

## Key Settings

- **Model:** TinyLlama/TinyLlama-1.1B-Chat-v1.0
- **GPU Usage:** ~4GB / 6GB (68%)
- **Max Tokens:** 512 output, 1024 total context
- **Port:** http://localhost:8888

## Files Changed

1. `.env` - CHATQNA_MAX_TOKENS=512, TinyLlama model IDs
2. `docker-compose.yaml` - max_num_seqs=12, CHATQNA_MAX_TOKENS env var
3. `genie-ai-overlay/chatqna/genieai_chatqna.py` - Fixed protocol default max_tokens

## Troubleshooting

**Issue:** "KeyError: 'choices'"  
**Fix:** Rebuild ChatQnA: `docker-compose up -d --build --no-deps chatqna-xeon-backend-server`

**Issue:** OOM error  
**Fix:** Reduce max_num_seqs or VLLM_GPU_UTIL in `.env`

**Issue:** Poor response quality  
**Expected:** TinyLlama is a very small model (1.1B params). Upgrade to 12GB+ GPU for better models.

## Full Documentation

See: `6GB-GPU-FINAL-WORKING-CONFIG.md`

