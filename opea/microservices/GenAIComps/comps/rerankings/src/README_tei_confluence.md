# TEI Reranker Microservice

## Overview

The TEI Reranker Microservice provides a high-performance, GPU-accelerated REST API for text reranking using Hugging Face's [Text Embeddings Inference (TEI)](https://github.com/huggingface/text-embeddings-inference) server.  
It is designed to serve reranking models (such as bge-reranker) and can be integrated into retrieval-augmented generation (RAG) pipelines or used as a standalone reranking service.

* Default Model: BAAI/bge-reranker-base
* Default Port: 7100
* API endpoint: /rerank

## Architecture & Flow

- **Containerized Service:** Runs as a Docker container with GPU support.
- **REST API:** Exposes endpoints for reranking requests and health checks.
- **Model Selection:** Specify the reranker model via environment variable or command-line argument.
- **Persistent Storage:** Uses a Docker volume for data persistence.
- **GPU Acceleration:** NVIDIA GPU, drivers, and libraries can be mapped into the container.

**Typical Flow:**
1. User/application sends a POST request with input pairs (query and candidates) to the reranker endpoint.
2. The TEI Reranker service processes the request using the specified reranker model and GPU.
3. The service returns a json array containing the reranking scores of each candidate as the response.

## Usage

### Run with Docker

```sh
docker run -d \
  --name tei-reranker-serving \
  --gpus all \
  -p 7100:80 \
  -v $(pwd)/data:/data \
  -v /usr/lib/x86_64-linux-gnu/libcuda.so.1:/usr/lib/x86_64-linux-gnu/libcuda.so.1 \
  -v /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1:/usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 \
  -v /usr/lib/x86_64-linux-gnu/libcudart.so.11.0:/usr/lib/x86_64-linux-gnu/libcudart.so.11.0 \
  -e HUGGING_FACE_HUB_TOKEN=your_hf_token \
  -e RERANKER_MODEL_ID=bge-reranker-base \
  ghcr.io/huggingface/text-embeddings-inference:turing-1.7 \
  --json-output --model-id bge-reranker-base
```

#### Key Elements Explained

- `--gpus all`: Enables GPU access inside the container (requires NVIDIA Docker support).
- `-p 7100:80`: Maps port 80 in the container to port 7100 on your host. Access the API at `http://localhost:7100`.
- `-v $(pwd)/data:/data`: Mounts the local `data` directory for persistent storage.
- `-v ...libcuda.so.1...`, `libnvidia-ml.so.1`, `libcudart.so.11.0`: Maps required NVIDIA libraries from the host to the container for GPU functionality.
- `-e HUGGING_FACE_HUB_TOKEN=your_hf_token`: Sets your Hugging Face access token for downloading models.
- `-e RERANKER_MODEL_ID=bge-reranker-base`: Specifies the reranker model to use.
- `ghcr.io/huggingface/text-embeddings-inference:turing-1.7`: The Docker image for TEI with GPU (Turing) support.
- `--json-output --model-id bge-reranker-base`: Runs the TEI server with JSON output and the specified reranker model.

**Request**

```sh
curl http://localhost:7100/rerank \
  -X POST \
  -d '{"query":"What is Deep Learning?", "texts": ["Deep Learning is not...", "Deep learning is..."]}' \
  -H 'Content-Type: application/json'
```

**Response**

```json
[{"index":1,"score":0.9432431},{"index":0,"score":0.12074952}]
```

## Notes

- **Environment Variables:**
  - `HUGGING_FACE_HUB_TOKEN`: (Required) Your Hugging Face access token, which must have permission to download the specified model
  - `RERANKER_MODEL_ID`: (Optional) Model ID for reranking (should match the model used in `--model-id`).
- **Port Mapping:**  
  Ensure the ports are correctly mapped to avoid conflicts with other services.
- **Model Selection:**  
  Choose a reranker model appropriate for your use case, e.g., `"bge-reranker-base"`.

## Extending

- **Change Model:**  
  Modify the `RERANKER_MODEL_ID` environment variable and the `--model-id` argument to use a different reranker model.
- **Integrate with Other Services:**  
  The REST API can be called from retrieval, search, or RAG pipelines for improved result ranking.
- **Custom Deployment:**  
  You can adapt the Docker run command or use Docker Compose for more complex setups.

## License

SPDX-License-Identifier: Apache-2.0

For more information, see [Hugging Face TEI License](https://github.com/huggingface/text-embeddings-inference/blob/main/LICENSE).