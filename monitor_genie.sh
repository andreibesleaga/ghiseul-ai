#!/bin/bash
# =================================================================================
# GENIE.AI Platform Monitor Script
# =================================================================================
# Provides live monitoring for containers, GPU, and logs.
# =================================================================================

# Check limits
RESOURCE_FORMAT="table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

show_menu() {
    clear
    echo "================================================================="
    echo "   GENIE.AI MONITORING CONSOLE"
    echo "================================================================="
    echo "1. 📊 Live Container Resources (docker stats)"
    echo "2. 🎮 Live GPU Status (watch nvidia-smi)"
    echo "3. 🏥 Service Health Check (one-time)"
    echo ""
    echo "--- LOGS (Ctrl+C to exit logs) ---"
    echo "4. 📜 Tail vLLM Logs (LLM Engine)"
    echo "5. 📜 Tail ChatQnA Backend Logs (Orchestrator)"
    echo "6. 📜 Tail Dataprep Logs (Ingestion)"
    echo "7. 📜 Tail Retriever Logs"
    echo "8. 📜 Tail API Gateway Logs (Kong)"
    echo "9. 📜 Tail All Application Logs (Combined)"
    echo ""
    echo "0. Exit"
    echo "================================================================="
    echo -n "Select an option: "
}

monitor_resources() {
    echo "Starting docker stats... (Ctrl+C to return)"
    docker stats --format "$RESOURCE_FORMAT"
}

monitor_gpu() {
    if command -v nvidia-smi &> /dev/null; then
        watch -n 1 nvidia-smi
    else
        echo "nvidia-smi not found."
        read -p "Press Enter to continue..."
    fi
}

check_health() {
    echo "Checking endpoints..."
    echo "--------------------------------"
    printf "%-30s %-20s\n" "SERVICE" "STATUS"
    echo "--------------------------------"
    
    check_url() {
        local name=$1
        local url=$2
        local code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "ERR")
        if [ "$code" = "200" ]; then
            printf "%-30s \e[32mOK (200)\e[0m\n" "$name"
        else
            printf "%-30s \e[31mFAIL ($code)\e[0m\n" "$name"
        fi
    }

    check_url "vLLM" "http://localhost:8000/health"
    check_url "TEI Embeddings" "http://localhost:7000/health"
    check_url "TEI Reranker" "http://localhost:7100/health"
    check_url "ChatQnA Backend" "http://localhost:8888/health"
    check_url "ChatQnA UI" "http://localhost:5173"
    
    echo ""
    read -p "Press Enter to continue..."
}

tail_logs() {
    local container=$1
    echo "Tailing logs for $container... (Ctrl+C to return)"
    sleep 1
    docker logs -f --tail 100 "$container"
}

tail_all() {
    echo "Tailing all logs... (Ctrl+C to return)"
    docker-compose logs -f --tail 10
}

# Main Loop
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1) monitor_resources ;;
        2) monitor_gpu ;;
        3) check_health ;;
        4) tail_logs "vllm-vllm-2" ;;
        5) tail_logs "chatqna-xeon-backend-server" ;;
        6) tail_logs "genie-ai-dataprep-arango" ;;
        7) tail_logs "genie-ai-retriever-arango" ;;
        8) tail_logs "genie-ai-replica-kong-1" ;;
        9) tail_all ;;
        0) exit 0 ;;
        *) echo "Invalid option"; sleep 1 ;;
    esac
done
