#!/bin/bash

# Copyright (c) 2024 Intel Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at:#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "Script directory: $SCRIPT_DIR"
cd $SCRIPT_DIR

# Set default values
default_hw_mode="cpu"
default_max_jobs=4  # Default to 4 jobs if not specified

# Assign arguments to variables
hw_mode=${1:-$default_hw_mode}
MAX_JOBS=${2:-$default_max_jobs}  # If MAX_JOBS is not provided, fall back to default

# Check if all required arguments are provided
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "Usage: $0 [hw_mode] [MAX_JOBS]"
    echo "Please customize the arguments you want to use."
    echo "  - hw_mode: The hardware mode for the vLLM endpoint. Options: 'cpu', 'gpu', 'hpu'."
    echo "  - MAX_JOBS: Number of parallel jobs (default: 4)."
    exit 1
fi

# Build the docker image for vLLM based on the hardware mode
echo "Building with $MAX_JOBS parallel jobs."

if [ "$hw_mode" = "hpu" ]; then
    git clone https://github.com/HabanaAI/vllm-fork.git
    cd ./vllm-fork/
    git checkout v0.6.4.post2+Gaudi-1.19.0
    docker build -f Dockerfile.hpu -t opea/vllm-gaudi:latest --shm-size=128g \
      --build-arg MAX_JOBS=$MAX_JOBS \
      --build-arg https_proxy=$https_proxy --build-arg http_proxy=$http_proxy .
    cd ..
    rm -rf vllm-fork

elif [ "$hw_mode" = "gpu" ]; then
    git clone https://github.com/vllm-project/vllm.git
    cd ./vllm/
    VLLM_VER="$(git describe --tags "$(git rev-list --tags --max-count=1)" )"
    echo "Check out vLLM tag ${VLLM_VER}"
    git checkout ${VLLM_VER} &> /dev/null
    docker pull -f Dockerfile -t opea/vllm-gpu:latest --shm-size=128g \
      --build-arg MAX_JOBS=$MAX_JOBS \
      --build-arg https_proxy=$https_proxy --build-arg http_proxy=$http_proxy .
    cd ..
    rm -rf vllm

else
    git clone https://github.com/vllm-project/vllm.git
    cd ./vllm/
    VLLM_VER="$(git describe --tags "$(git rev-list --tags --max-count=1)" )"
    echo "Check out vLLM tag ${VLLM_VER}"
    git checkout ${VLLM_VER} &> /dev/null
    docker build -f Dockerfile.cpu -t opea/vllm-cpu:latest --shm-size=128g \
      --build-arg MAX_JOBS=$MAX_JOBS \
      --build-arg https_proxy=$https_proxy --build-arg http_proxy=$http_proxy .
    cd ..
    rm -rf vllm
fi



