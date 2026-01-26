# TEI Microservice

## Overview

The TEI Microservice runs the [Hugging Face Text Embeddings Inference (TEI)](https://github.com/huggingface/text-embeddings-inference) server for generating text embeddings using GPU acceleration.  
It is designed for high-performance embedding generation and can be integrated into larger AI platforms or used standalone.

* Default Model: BAAI/bge-base-en-v1.5
* Default Port: 7000
* API endpoint: /v1/embeddings

## Architecture & Flow

- **Containerized Service:** Runs as a Docker container with GPU support.
- **REST API:** Exposes endpoints for embedding generation and health checks.
- **Model Selection:** Specify the embedding model via command-line or environment variable.
- **Persistent Storage:** Uses a Docker volume for data persistence.
- **GPU Acceleration:** NVIDIA GPU, drivers, and libraries can be mapped into the container.

**Typical Flow:**
1. User/application sends a POST request with input text to the `/v1/embeddings` endpoint.
2. The TEI service processes the request using the specified model and GPU.
3. The service returns the embedding vector(s) in the response.

## Usage

### 🐳 Run with Docker (GPU Version)

```sh
docker run -d \
  --name tei-embedding-serving \
  --gpus all \
  -p 7000:80 \
  -v $(pwd)/data:/data \
  -v /usr/lib/x86_64-linux-gnu/libcuda.so.1:/usr/lib/x86_64-linux-gnu/libcuda.so.1 \
  -v /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1:/usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 \
  -v /usr/lib/x86_64-linux-gnu/libcudart.so.11.0:/usr/lib/x86_64-linux-gnu/libcudart.so.11.0 \
  -e HUGGING_FACE_HUB_TOKEN=your_hf_token \
  ghcr.io/huggingface/text-embeddings-inference:turing-1.7 \
  --model-id BAAI/bge-base-en-v1.5
```

#### Key Elements Explained

- `--gpus all`: Enables GPU access inside the container (requires NVIDIA Docker support).
- `-p 7000:80`: Maps port 80 in the container to port 7000 on your host. Access the API at `http://localhost:7000`.
- `-v $(pwd)/data:/data`: Mounts the local `data` directory for persistent storage.
- `-v ...libcuda.so.1...`, `libnvidia-ml.so.1`, `libcudart.so.11.0`: Maps required NVIDIA libraries from the host to the container for GPU functionality.
- `-e HUGGING_FACE_HUB_TOKEN=your_hf_token`: Sets your Hugging Face access token for downloading models.
- `ghcr.io/huggingface/text-embeddings-inference:turing-1.7`: The Docker image for TEI with GPU (Turing) support.
- `--model-id BAAI/bge-base-en-v1.5`: Specifies the embedding model to use. You can change this to any supported model.

**Request**

```sh
curl http://localhost:7000/v1/embeddings \
  -X POST \
  -d '{"input":"Hello world!"}' \
  -H 'Content-Type: application/json'
```

**Response**

```json
{"object":"list",
 "data":[{"object":"embedding",
          "embedding":[0.042191405,0.032216996,0.01358883,0.0048134346,0.032859944,0.031452406,0.03913305, ...],
          "index":0}],
 "model":"BAAI/bge-base-en-v1.5",
 "usage":{"prompt_tokens":5,"total_tokens":5}}
```

## Notes

- **Environment Variables:**
  - `HUGGING_FACE_HUB_TOKEN`: (Required) Your Hugging Face access token, which must have permission to download the specified model.
  - `EMBEDDING_MODEL_ID`: (Optional) Model ID to use for embeddings (can also be set via `--model-id`).
  - `DATA_PATH`: (Optional) Path for persistent data storage.
  - `NVIDIA_VISIBLE_DEVICES`: (Optional) Controls which GPUs are visible to the container (default: `all`).
- **Port Mapping:**  
  Ensure the ports are correctly mapped to avoid conflicts with other services.
- **Model Selection:**  
  Choose a model appropriate for your use case, e.g., `"BAAI/bge-large-en-v1.5"` or `"BAAI/bge-m3"`.

## Extending

- **Change Model:**  
  Modify the `--model-id` argument or set the `EMBEDDING_MODEL_ID` environment variable to use a different embedding model.
- **Integrate with Other Services:**  
  The REST API is compatible with the [OpenAI API](https://platform.openai.com/docs/api-reference/embeddings), making integration straightforward.
- **Custom Deployment:**  
  You can adapt the Docker run command or use Docker Compose for more complex setups.

## License

SPDX-License-Identifier: Apache-2.0

For more information, see [Hugging Face TEI License](https://github.com/huggingface/text-embeddings-inference/blob/main/LICENSE).