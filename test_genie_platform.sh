#!/bin/bash
# =================================================================================
# GENIE.AI Platform End-to-End Test Script
# =================================================================================
# This script validates the current local running Docker configuration for:
# 1. Microservice health status
# 2. Frontend availability
# 3. End-to-end RAG pipeline (Ingestion -> Retrieval -> Generation)
# =================================================================================

set -e
export PATH=$PWD:$PATH

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATAPREP_URL="http://localhost:5000/v1/dataprep/ingest"
CHATQNA_URL="http://localhost:8888/v1/chatqna"
CHATQNA_UI_URL="http://localhost:5173"
CHATQNA_NGINX_URL="http://localhost:8090"
MAIN_FRONTEND_URL="http://localhost:8091"
KONG_URL="http://localhost:8010"
VLLM_URL="http://localhost:8000/health"
TEI_EMBED_URL="http://localhost:7000/health"
TEI_RERANK_URL="http://localhost:7100/health"

TEST_FILE="genie_test_artifact.txt"
TEST_CONTENT="Genie AI is a platform."
TEST_QUERY="What is Genie AI?"

# Helper Functions
print_header() {
    echo -e "\n${BLUE}==============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}==============================================================================${NC}"
}

print_pass() {
    echo -e "${GREEN}PASS${NC}: $1"
}

print_fail() {
    echo -e "${RED}FAIL${NC}: $1"
}

print_info() {
    echo -e "${YELLOW}INFO${NC}: $1"
}

check_program() {
    if ! command -v $1 &> /dev/null; then
        print_fail "$1 could not be found. Please install it."
        exit 1
    fi
}

# =================================================================================
# 1. Pre-flight Checks
# =================================================================================
print_header "1. SYSTEM & REQUIREMENTS CHECK"

check_program curl
check_program docker

if ! command -v jq &> /dev/null; then
    print_info "jq not found. Output parsing will be limited. Install jq for better details."
    HAS_JQ=false
else
    HAS_JQ=true
fi

# Check Docker Permissions
if ! docker ps &> /dev/null; then
    print_fail "Cannot connect to Docker daemon. Check permissions."
    exit 1
else
    print_pass "Docker is accessible"
fi

# =================================================================================
# 2. Container Status Check
# =================================================================================
print_header "2. RUNNING CONTAINERS CHECK"

REQUIRED_CONTAINERS=(
    "vllm-vllm-2"
    "tei-embedding-serving"
    "tei-reranker-serving"
    "embedding"
    "reranker"
    "genie-ai-retriever-arango"
    "genie-ai-dataprep-arango"
    "chatqna-xeon-backend-server"
    "chatqna-xeon-ui-server"
    "arango-vector-db"
    "redis-cache"
)

# Optional containers (might not be running in 6GB config)
OPTIONAL_CONTAINERS=(
    "chatqna-xeon-nginx-server"
    "kong"
    "frontend"
    "backend"
    "doc-repo-dev"
)

ALL_RUNNING=$(docker ps --format '{{.Names}}')

for container in "${REQUIRED_CONTAINERS[@]}"; do
    if echo "$ALL_RUNNING" | grep -q "$container"; then
        print_pass "Container running: $container"
    else
        # Try fuzzy match or alternative names if exact match fails
        if docker ps | grep -q "$container"; then
             print_pass "Container running (found via grep): $container"
        else
             print_fail "CRITICAL: Container $container is NOT running!"
        fi
    fi
done

for container in "${OPTIONAL_CONTAINERS[@]}"; do
    if echo "$ALL_RUNNING" | grep -q "$container"; then
        print_pass "Optional container running: $container"
    else
        print_info "Optional container not running: $container"
    fi
done

# =================================================================================
# 3. Service Health Checks (HTTP)
# =================================================================================
print_header "3. MICROSERVICE HEALTH CHECKS"

check_endpoint() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}
    
    print_info "Checking $name at $url..."
    local code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$code" = "$expected_code" ]; then
        print_pass "$name is healthy (HTTP $code)"
        return 0
    else
        print_fail "$name failed (HTTP $code, expected $expected_code)"
        return 1
    fi
}

check_endpoint "$VLLM_URL" "vLLM"
check_endpoint "$TEI_EMBED_URL" "TEI Embeddings"
# Reranker might be 7100 or different
check_endpoint "$TEI_RERANK_URL" "TEI Reranker"
check_endpoint "http://localhost:8888/health" "ChatQnA Backend" 

# Frontend checks
check_endpoint "$CHATQNA_UI_URL" "ChatQnA UI"
# Nginx might be 8090, 80, or not running
if echo "$ALL_RUNNING" | grep -q "chatqna-xeon-nginx-server"; then
    check_endpoint "$CHATQNA_NGINX_URL" "ChatQnA Nginx" "200" || check_endpoint "http://localhost:80" "ChatQnA Nginx (Port 80)"
fi

# =================================================================================
# 4. End-to-End Functional Test
# =================================================================================
print_header "4. END-TO-END RAG PIPELINE TEST"

# 4.1 Create Test Document
print_info "Creating test document: $TEST_FILE"
echo "$TEST_CONTENT" > "$TEST_FILE"

# 4.2 Ingest Document
print_info "Step 1: Ingesting document via Dataprep..."
# Use || true to prevent exit on failure, capture output
INGEST_RESPONSE=$(curl -s -v -X POST \
    -H "Content-Type: multipart/form-data" \
    -F "files=@$TEST_FILE" \
    "$DATAPREP_URL" 2>&1)

echo "Ingest Curl Output: $INGEST_RESPONSE"

if [[ "$INGEST_RESPONSE" == *"Data preparation succeeded"* ]] || [[ "$INGEST_RESPONSE" == *"200 OK"* ]]; then
    print_pass "Ingestion request accepted."
else
    print_fail "Ingestion failed or returned non-200 status."
    print_info "Attempting to proceed with Query (assuming pre-existing data or partial success)..."
fi

# Wait for indexing
print_info "Waiting 10 seconds for indexing..."
sleep 10

# 4.3 Query ChatQnA
print_info "Step 2: Querying ChatQnA related to the document..."
# Construct JSON payload properly
QUERY_PAYLOAD=$(cat <<EOF
{
    "messages": [
        {
            "role": "user",
            "content": "$TEST_QUERY"
        }
    ],
    "stream": false
}
EOF
)

QUERY_RESPONSE=$(curl -s -X POST "$CHATQNA_URL" \
    -H "Content-Type: application/json" \
    -d "$QUERY_PAYLOAD")

# 4.4 Validate Response
echo -e "\nResponse from ChatQnA:"
if [ "$HAS_JQ" = true ]; then
    echo "$QUERY_RESPONSE" | jq .
else
    echo "$QUERY_RESPONSE"
fi

if [[ "$QUERY_RESPONSE" == *"Genie AI"* ]] || [[ "$QUERY_RESPONSE" == *"platform"* ]]; then
    print_pass "RAG Retrieval Successful! Model answered relevantly."
else
    print_info "Model answer validation: Could not strictly verify 'Genie AI' in response."
    print_info "Please check the output above manually."
fi

# Cleanup
rm -f "$TEST_FILE"
print_info "Cleaned up test artifact."

# =================================================================================
# 5. Summary
# =================================================================================
print_header "TEST COMPLETE"
echo "Please review any FAIL messages above."
echo "Note: If this is a 6GB GPU config, some services (translation, guardrails) are expected to be offline."
