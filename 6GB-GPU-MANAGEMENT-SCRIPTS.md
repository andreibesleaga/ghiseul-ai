# 6GB GPU Management Scripts

## Quick Start

### Start All Services
```bash
./start-6gb-gpu.sh
```

This script will:
1. Start infrastructure (vLLM, TEI, ArangoDB, Redis)
2. Wait 30 seconds for ArangoDB to be fully ready
3. Start retriever and dataprep services
4. Start ChatQnA backend
5. Start optional frontend services
6. Run health checks on all services

**Expected runtime:** ~60 seconds

### Stop Services

**Option 1: Just stop (containers preserved)**
```bash
./stop-6gb-gpu.sh
```

**Option 2: Stop and remove containers**
```bash
./stop-6gb-gpu.sh --remove-containers
# or
./stop-6gb-gpu.sh -r
```

**Option 3: Full cleanup (removes containers, volumes, and prunes system)**
```bash
./stop-6gb-gpu.sh --full-cleanup
# or
./stop-6gb-gpu.sh -f
```

**Option 4: Custom cleanup**
```bash
# Stop and remove containers + volumes
./stop-6gb-gpu.sh -r -v

# Stop, remove containers, and prune
./stop-6gb-gpu.sh -r -p
```

## Stop Script Options

| Option | Short | Description |
|--------|-------|-------------|
| `--remove-containers` | `-r` | Remove stopped containers after shutdown |
| `--remove-volumes` | `-v` | Remove named volumes (⚠️ deletes data) |
| `--prune` | `-p` | Prune unused Docker resources (images, networks) |
| `--full-cleanup` | `-f` | All of the above |
| `--help` | `-h` | Show help message |

## Troubleshooting

### If services fail to start:

1. **Check the logs:**
```bash
docker logs vllm-vllm-2
docker logs genie-ai-retriever-arango
docker logs chatqna-xeon-backend-server
```

2. **Try a full restart:**
```bash
./stop-6gb-gpu.sh -f
sleep 5
./start-6gb-gpu.sh
```

3. **Check GPU availability:**
```bash
nvidia-smi
```

### If retriever/dataprep keep crashing:

The most common issue is ArangoDB not being fully ready. The script waits 30 seconds, but some systems may need longer.

**Manual workaround:**
```bash
### Common Issues

**1. Retriever or Dataprep Exit Immediately (FIXED)**

The script now includes retry logic and ArangoDB readiness checks. If services still fail:

```bash
# Check ArangoDB is ready
curl -u root:test http://localhost:8529/_api/version

# Check service logs for errors
docker logs genie-ai-retriever-arango 2>&1 | grep -i error
docker logs genie-ai-dataprep-arango 2>&1 | grep -i error

# Manually restart after fixing issues
docker-compose up -d --no-deps retriever-arango-service dataprep-arango-service
```
```

### If ChatQnA returns "Internal Server Error":

1. Verify retriever is running:
```bash
docker ps | grep retriever
```

2. If not running, check why it crashed:
```bash
docker logs genie-ai-retriever-arango 2>&1 | tail -50
```

3. Restart the retriever after ensuring ArangoDB is ready:
```bash
sleep 30  # Extra wait
docker-compose up -d --no-deps retriever-arango-service dataprep-arango-service
```

## Services Started by start-6gb-gpu.sh

✅ **Started Services:**
- vllm-vllm-2 (TinyLlama 1.1B)
- tei-embedding-serving (BAAI/bge-base-en-v1.5)
- tei-reranker-serving (ms-marco-MiniLM-L-6-v2)
- embedding (OPEA wrapper)
- reranker (OPEA wrapper)
- arango-vector-db
- redis-cache
- genie-ai-retriever-arango
- genie-ai-dataprep-arango
- chatqna-xeon-backend-server
- backend, frontend, kong, etc. (optional)

❌ **NOT Started (6GB Limitation):**
- vllm-translation-guardrail (needs ~2GB extra VRAM)
- llm-guardrail (needs extra VRAM)

## Testing After Startup

### 1. Quick health check (automatic)
The script runs automatic health checks. Look for:
```
✓ vLLM: OK
✓ TEI Embeddings: OK
✓ ChatQnA: OK
```

### 2. Manual API test
```bash
curl -X POST http://localhost:8888/v1/chatqna \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is 2+2?"}]}'
```

Expected: JSON response with the answer

### 3. Check GPU usage
```bash
nvidia-smi
# or watch continuously:
watch -n 1 nvidia-smi
```

Expected: ~4GB/6GB used

## Daily Usage Workflow

### Morning startup:
```bash
cd /home/andrei/work/genie-ai-replica
./start-6gb-gpu.sh
# Wait for "Startup Complete!" message
# Test with: curl http://localhost:8888/v1/chatqna ...
```

### Evening shutdown:
```bash
./stop-6gb-gpu.sh
# or for cleanup:
./stop-6gb-gpu.sh -r
```

### Weekly maintenance:
```bash
# Full cleanup to reclaim disk space
./stop-6gb-gpu.sh --full-cleanup

# Wait a moment
sleep 10

# Fresh start
./start-6gb-gpu.sh
```

## Files Created

- `start-6gb-gpu.sh` - Automated startup with proper timing
- `stop-6gb-gpu.sh` - Shutdown with cleanup options
- `6GB-GPU-MANAGEMENT-SCRIPTS.md` - This file
- `6GB-GPU-FINAL-WORKING-CONFIG.md` - Complete configuration reference
- `QUICK-START-6GB.md` - Quick reference

## Important Notes

⚠️ **Always use these scripts instead of `docker-compose up -d`**

The raw `docker-compose up -d` command tries to start ALL services including the broken translation/guardrail services, which causes dependency errors.

⚠️ **Timing is critical**

The 30-second wait for ArangoDB is necessary. If you manually start services, always wait at least 30 seconds after starting ArangoDB before starting retriever/dataprep.

⚠️ **Model quality limitations**

TinyLlama (1.1B parameters) is a very small model. Expect:
- Basic responses
- Some hallucinations
- Repetitive text
- Prompt template leaking

For production use, upgrade to a 12GB+ GPU to run better models like granite-3.3-2b-instruct.

## Logs and Monitoring

**View real-time logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker logs -f chatqna-xeon-backend-server
docker logs -f vllm-vllm-2
docker logs -f genie-ai-retriever-arango
```

**Check service status:**
```bash
docker-compose ps
```

**Monitor GPU:**
```bash
watch -n 1 nvidia-smi
```

## Support

For detailed configuration information, see:
- `6GB-GPU-FINAL-WORKING-CONFIG.md` - Complete setup guide
- `QUICK-START-6GB.md` - Quick reference
- Main documentation: `GENIE.AI-Installation-Configuration-Guide.md`
