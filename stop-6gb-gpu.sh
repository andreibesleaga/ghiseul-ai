#!/bin/bash
# GENIE.AI Shutdown Script for 6GB GPU
# Cleanly stops all services and optionally removes containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

echo "========================================"
echo "GENIE.AI 6GB GPU Shutdown Script"
echo "========================================"
echo ""

# Parse command line arguments
REMOVE_CONTAINERS=false
REMOVE_VOLUMES=false
PRUNE_SYSTEM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --remove-containers|-r)
            REMOVE_CONTAINERS=true
            shift
            ;;
        --remove-volumes|-v)
            REMOVE_VOLUMES=true
            shift
            ;;
        --prune|-p)
            PRUNE_SYSTEM=true
            shift
            ;;
        --full-cleanup|-f)
            REMOVE_CONTAINERS=true
            REMOVE_VOLUMES=true
            PRUNE_SYSTEM=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --remove-containers, -r   Remove stopped containers"
            echo "  --remove-volumes, -v      Remove named volumes"
            echo "  --prune, -p               Prune unused Docker resources"
            echo "  --full-cleanup, -f        Do all of the above"
            echo "  --help, -h                Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                        # Just stop services"
            echo "  $0 -r                     # Stop and remove containers"
            echo "  $0 -f                     # Full cleanup"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install it first."
    exit 1
fi

# Show current GPU usage before shutdown
print_info "Current GPU usage before shutdown:"
if nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader
else
    print_warning "nvidia-smi not available"
fi

echo ""

# Stop services
print_status "Stopping GENIE.AI services..."
docker-compose stop 2>&1 | grep -v "^$" || true

print_status "All services stopped."

# Optional: Remove containers
if [ "$REMOVE_CONTAINERS" = true ]; then
    echo ""
    print_warning "Removing containers..."
    
    if [ "$REMOVE_VOLUMES" = true ]; then
        print_warning "Also removing volumes..."
        docker-compose down --remove-orphans --volumes
    else
        docker-compose down --remove-orphans
    fi
    
    print_status "Containers removed."
fi

# Optional: Docker system prune
if [ "$PRUNE_SYSTEM" = true ]; then
    echo ""
    print_warning "Pruning Docker system (removing unused images, containers, networks)..."
    
    # Show what will be removed
    print_info "Space that will be reclaimed:"
    docker system df
    
    echo ""
    read -p "Are you sure you want to prune? This will remove ALL unused Docker resources. (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker system prune -f
        print_status "Docker system pruned."
        
        # Show new disk usage
        echo ""
        print_info "New disk usage:"
        docker system df
    else
        print_info "Prune cancelled."
    fi
fi

# Final status
echo ""
print_status "========================================"
print_status "Shutdown Complete"
print_status "========================================"

# Check if any containers are still running
RUNNING=$(docker ps --filter "name=genie-ai\|vllm\|tei\|arango\|redis\|chatqna" --format "{{.Names}}" 2>/dev/null | wc -l)

if [ "$RUNNING" -eq 0 ]; then
    print_status "✓ No GENIE.AI containers are running"
else
    print_warning "⚠ Some containers are still running:"
    docker ps --filter "name=genie-ai\|vllm\|tei\|arango\|redis\|chatqna" --format "table {{.Names}}\t{{.Status}}"
fi

# Show GPU status after shutdown
echo ""
print_info "GPU status after shutdown:"
if nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader
else
    print_warning "nvidia-smi not available"
fi

echo ""
print_status "To start services again, run:"
echo "  ./start-6gb-gpu.sh"

if [ "$REMOVE_CONTAINERS" = false ]; then
    echo ""
    print_info "Tip: For complete cleanup, use:"
    echo "  $0 --full-cleanup"
fi
