#!/bin/bash
# GENIE.AI Startup Script for 6GB GPU (TinyLlama Configuration)
# This script starts only the services that work on 6GB VRAM
# and includes proper timing to avoid ArangoDB connection issues

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "GENIE.AI 6GB GPU Startup Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} $1"
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install it first."
    exit 1
fi

# Check if running with proper permissions
if ! docker ps &> /dev/null; then
    print_error "Cannot connect to Docker. Please ensure:"
    echo "  1. Docker is running"
    echo "  2. Your user has Docker permissions (run: sudo usermod -aG docker \$USER)"
    exit 1
fi

# Check GPU availability
print_status "Checking GPU availability..."
if ! nvidia-smi &> /dev/null; then
    print_error "nvidia-smi not found or GPU not available."
    exit 1
fi

GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
print_status "Detected GPU with ${GPU_MEM}MB VRAM"

if [ "$GPU_MEM" -lt 6000 ]; then
    print_error "GPU has less than 6GB VRAM. This configuration requires at least 6GB."
    exit 1
fi

# Phase 1: Start infrastructure services
print_status "Phase 1: Starting infrastructure services..."
print_status "  - vLLM (TinyLlama)"
print_status "  - TEI Embeddings & Reranker"
print_status "  - ArangoDB"
print_status "  - Redis"
print_status "  - Embedding wrapper"

docker-compose up -d --no-deps \
    vllm \
    tei \
    tei_reranker \
    embedding \
    arango-vector-db \
    redis-cache

# Wait for ArangoDB to be truly ready by checking its API
print_status "Waiting for ArangoDB to be fully ready..."
MAX_WAIT=60
WAIT_COUNT=0
ARANGO_READY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s -f -u root:${ARANGO_PASSWORD:-test} http://localhost:8529/_api/version > /dev/null 2>&1; then
        ARANGO_READY=true
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo -ne "  Attempt $WAIT_COUNT/$MAX_WAIT...\r"
    sleep 1
done
echo ""

if [ "$ARANGO_READY" = false ]; then
    print_error "ArangoDB failed to become ready after ${MAX_WAIT} seconds"
    exit 1
fi

print_status "ArangoDB is ready!"

# Additional safety delay for internal initialization
print_status "Waiting additional 10 seconds for ArangoDB internal initialization..."
sleep 10

# Check infrastructure health
print_status "Checking infrastructure health..."
sleep 2

VLLM_STATUS=$(docker inspect vllm-vllm-2 --format='{{.State.Health.Status}}' 2>/dev/null || echo "not_found")
ARANGO_STATUS=$(docker inspect arango-vector-db --format='{{.State.Health.Status}}' 2>/dev/null || echo "not_found")
TEI_STATUS=$(docker inspect tei-embedding-serving --format='{{.State.Health.Status}}' 2>/dev/null || echo "not_found")

if [ "$VLLM_STATUS" != "healthy" ]; then
    print_warning "vLLM not yet healthy (status: $VLLM_STATUS). It may still be loading the model..."
fi

if [ "$ARANGO_STATUS" != "healthy" ]; then
    print_error "ArangoDB is not healthy. Cannot proceed."
    exit 1
fi

if [ "$TEI_STATUS" != "healthy" ]; then
    print_warning "TEI Embeddings not yet healthy (status: $TEI_STATUS)"
fi

# Phase 2: Start reranker (depends on TEI)
print_status "Phase 2: Starting reranker service..."
docker-compose up -d --no-deps reranker

print_status "Waiting for reranker to initialize (5 seconds)..."
sleep 5

# Phase 3: Start retriever and dataprep with retry logic
print_status "Phase 3: Starting retriever and dataprep services..."
print_status "  These services need ArangoDB to be fully ready."

MAX_RETRIES=3
RETRY_COUNT=0
SERVICES_STARTED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SERVICES_STARTED" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        print_warning "Retry attempt $RETRY_COUNT/$MAX_RETRIES..."
        # Remove failed containers
        docker rm -f genie-ai-retriever-arango genie-ai-dataprep-arango 2>/dev/null || true
        sleep 5
    fi
    
    docker-compose up -d --no-deps \
        retriever-arango-service \
        dataprep-arango-service

    print_status "Waiting for services to initialize (20 seconds)..."
    sleep 20

    # Check if services are still running
    RETRIEVER_RUNNING=$(docker ps --filter "name=genie-ai-retriever-arango" --format "{{.Names}}" 2>/dev/null)
    DATAPREP_RUNNING=$(docker ps --filter "name=genie-ai-dataprep-arango" --format "{{.Names}}" 2>/dev/null)

    if [ -n "$RETRIEVER_RUNNING" ] && [ -n "$DATAPREP_RUNNING" ]; then
        # Double-check they're actually healthy by waiting a bit more
        sleep 10
        RETRIEVER_STILL_RUNNING=$(docker ps --filter "name=genie-ai-retriever-arango" --format "{{.Names}}" 2>/dev/null)
        DATAPREP_STILL_RUNNING=$(docker ps --filter "name=genie-ai-dataprep-arango" --format "{{.Names}}" 2>/dev/null)
        
        if [ -n "$RETRIEVER_STILL_RUNNING" ] && [ -n "$DATAPREP_STILL_RUNNING" ]; then
            SERVICES_STARTED=true
            print_status "✓ Both services started successfully"
            RETRIEVER_STATUS=$(docker ps --filter "name=genie-ai-retriever-arango" --format "{{.Status}}")
            DATAPREP_STATUS=$(docker ps --filter "name=genie-ai-dataprep-arango" --format "{{.Status}}")
            print_status "Retriever: $RETRIEVER_STATUS"
            print_status "Dataprep: $DATAPREP_STATUS"
        else
            print_warning "Services started but crashed within 10 seconds"
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    else
        if [ -z "$RETRIEVER_RUNNING" ]; then
            print_warning "Retriever failed to start or crashed"
        fi
        if [ -z "$DATAPREP_RUNNING" ]; then
            print_warning "Dataprep failed to start or crashed"
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ "$SERVICES_STARTED" = false ]; then
    print_error "Failed to start retriever/dataprep after $MAX_RETRIES attempts"
    print_error "Check logs:"
    echo "  docker logs genie-ai-retriever-arango 2>&1 | tail -50"
    echo "  docker logs genie-ai-dataprep-arango 2>&1 | tail -50"
    print_error ""
    print_error "Common issues:"
    echo "  1. ArangoDB not fully initialized (increase wait time)"
    echo "  2. Incorrect database credentials in .env"
    echo "  3. Network connectivity issues"
    exit 1
fi

# Phase 4: Start ChatQnA backend
print_status "Phase 4: Starting ChatQnA backend..."
docker-compose up -d --no-deps chatqna-xeon-backend-server

print_status "Waiting for ChatQnA to initialize (10 seconds)..."
sleep 10

# Phase 5: Start frontend services
print_status "Phase 5: Starting frontend services..."
print_status "  - ChatQnA UI (port 5173)"
print_status "  - Nginx frontend (port 8090)"

docker-compose up -d --no-deps chatqna-xeon-ui-server
print_status "Waiting for UI to be healthy (15 seconds)..."
sleep 15

docker-compose up -d --no-deps chatqna-xeon-nginx-server
print_status "Waiting for nginx to initialize (5 seconds)..."
sleep 5

# Phase 6: Start application services (backend, frontend, Kong, document-repository)
print_status "Phase 6: Starting application services..."
print_status "  - Kong Database & API Gateway"
print_status "  - Backend API (port 3000)"
print_status "  - Frontend App (port 8091)"
print_status "  - Document Repository (port 3001)"
print_status "  - Supporting services (ClamAV, HTTP service, Nginx, Guardrail, Textgen)"

docker-compose up -d --no-deps \
    kong-database \
    kong \
    backend \
    frontend \
    document-repository \
    http-service \
    clamav \
    nginx \
    guardrail \
    textgen

print_status "Waiting for services to initialize (10 seconds)..."
sleep 10

# Apply Kong configuration
# Apply Kong configuration
print_status "Applying Kong API Gateway configuration..."

# 1. Bootstrap Kong Database (Idempotent)
print_status "  Bootstrapping Kong database..."
docker-compose run --rm kong kong migrations bootstrap >/dev/null 2>&1 || true

# 2. Apply Config via Python Script
if [ -f "api-gateway-solution/new-config/apply_kong_config.py" ]; then
    cd api-gateway-solution/new-config/
    if command -v python3 &> /dev/null; then
        python3 apply_kong_config.py
    else
        print_warning "  python3 not found, trying python..."
        python apply_kong_config.py
    fi
    cd "$SCRIPT_DIR"
    print_status "  ✓ Kong configuration applied"
else
    print_warning "  Kong configuration script (apply_kong_config.py) not found, skipping..."
fi

# Final status check
echo ""
print_status "========================================"
print_status "Startup Complete!"
print_status "========================================"
echo ""

print_status "Checking GPU usage..."
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader

echo ""
print_status "Service Status:"
docker-compose ps | grep -E "vllm-vllm-2|chatqna|tei-embedding|tei-reranker|retriever|dataprep|arango|redis" | grep -v translation || true

echo ""
print_status "========================================"
print_status "Quick Health Check"
print_status "========================================"

# Test vLLM
print_status "Testing vLLM endpoint..."
VLLM_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
if [ "$VLLM_TEST" = "200" ]; then
    print_status "  ✓ vLLM: OK"
else
    print_warning "  ✗ vLLM: Not responding (HTTP $VLLM_TEST)"
fi

# Test TEI
print_status "Testing TEI Embeddings..."
TEI_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7000/health 2>/dev/null || echo "000")
if [ "$TEI_TEST" = "200" ]; then
    print_status "  ✓ TEI Embeddings: OK"
else
    print_warning "  ✗ TEI Embeddings: Not responding (HTTP $TEI_TEST)"
fi

# Test ChatQnA
print_status "Testing ChatQnA endpoint..."
CHATQNA_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/health 2>/dev/null || echo "000")
if [ "$CHATQNA_TEST" = "200" ]; then
    print_status "  ✓ ChatQnA: OK"
else
    print_warning "  ✗ ChatQnA: Not responding (HTTP $CHATQNA_TEST)"
    print_warning "    It may still be initializing. Wait 30 seconds and test manually:"
    echo "    curl -X POST http://localhost:8888/v1/chatqna -H 'Content-Type: application/json' -d '{\"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}]}'"
fi

# Test Frontend
print_status "Testing ChatQnA Frontend..."
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/ 2>/dev/null || echo "000")
if [ "$FRONTEND_TEST" = "200" ]; then
    print_status "  ✓ ChatQnA Frontend: OK (http://localhost:8090)"
else
    print_warning "  ✗ ChatQnA Frontend: Not responding (HTTP $FRONTEND_TEST)"
fi

# Test Main App Frontend
print_status "Testing Main App Frontend..."
MAIN_APP_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8091/ 2>/dev/null || echo "000")
if [ "$MAIN_APP_TEST" = "200" ]; then
    print_status "  ✓ Main App Frontend: OK (http://localhost:8091)"
else
    print_warning "  ✗ Main App Frontend: Not responding (HTTP $MAIN_APP_TEST)"
fi

# Test Kong API Gateway
print_status "Testing Kong API Gateway..."
KONG_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8010/api/auth/login 2>/dev/null || echo "000")
if [ "$KONG_TEST" = "400" ]; then
    print_status "  ✓ Kong API Gateway: OK (http://localhost:8010)"
else
    print_warning "  ✗ Kong API Gateway: Not responding (HTTP $KONG_TEST)"
fi

echo ""
print_status "========================================"
print_status "Services Not Started (6GB Limitation):"
print_status "========================================"
echo "  - vllm-translation-guardrail (requires ~2GB additional VRAM)"
echo "  - llm-guardrail (requires additional VRAM)"
echo ""
echo "These services are disabled because they exceed the 6GB VRAM capacity."
echo "The main RAG pipeline works without them."

echo ""
print_status "========================================"
print_status "Next Steps"
print_status "========================================"
echo "1. Access the applications:"
echo "   - Main App (with login & document management): http://localhost:8091"
echo "   - ChatQnA UI (direct RAG interface): http://localhost:8090"
echo ""
echo "2. Test ChatQnA API:"
echo "   curl -X POST http://localhost:8888/v1/chatqna \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"messages\": [{\"role\": \"user\", \"content\": \"What is 2+2?\"}]}'"
echo ""
echo "3. Test Kong API Gateway:"
echo "   curl -X POST http://localhost:8010/api/auth/login"
echo ""
echo "4. Monitor GPU usage:"
echo "   watch -n 1 nvidia-smi"
echo ""
echo "5. View logs:"
echo "   docker logs -f chatqna-xeon-backend-server"
echo "   docker logs -f vllm-vllm-2"
echo "   docker logs -f genie-ai-replica_backend_1"
echo "   docker logs -f genie-ai-replica_kong_1"
echo ""
echo "6. Shut down services:"
echo "   ./stop-6gb-gpu.sh"
echo ""

print_status "For troubleshooting, see: 6GB-GPU-FINAL-WORKING-CONFIG.md"
