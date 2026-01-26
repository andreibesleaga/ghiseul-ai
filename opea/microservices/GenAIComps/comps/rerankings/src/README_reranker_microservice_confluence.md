# OPEA Reranking Microservice

## Overview

The OPEA Reranking Microservice provides a unified REST API for document reranking, acting as a wrapper around a Hugging Face TEI reranker backend (such as bge-reranker). 

It is designed for use in retrieval-augmented generation (RAG) and search pipelines, enabling users to rerank candidate documents or answers based on a query using state-of-the-art models.

This service is containerized, GPU-accelerated, and easily integrates with other services.

* Default Model: `BAAI/bge-reranker-base`
* Default Port: `6100`
* API endpoint: `/v1/reranking`

## Architecture & Flow

- **Containerized Service:** Runs as a Docker container.
- **REST API:** Exposes `/v1/reranking` endpoint for reranking requests.
- **TEI Reranker Backend:** Forwards reranking requests to a TEI reranker service (can be local or remote, CPU or GPU).
- **Model Selection:** Model is selected via environment variable or configuration.
- **Logging & Telemetry:** Logs requests and responses if enabled, and collects statistics.
- **Persistent Storage:** Optionally uses Docker volumes for data persistence.

**Workflow/Logic:**

1. **Startup:**  
   - Loads configuration and initializes the reranking component (`OpeaTEIReranking`).
   - Performs a health check on the TEI reranker backend.
   - Registers the microservice endpoint `/v1/reranking` on port 8000.

2. **Request Handling:**  
   - Receives a POST request at `/v1/reranking` with a query and candidate documents.
   - Logs the input if logging is enabled.
   - Uses the loader to invoke the reranking component, which:
     - Extracts the query and candidate texts.
     - Sends them to the TEI reranker backend via HTTP.
     - Receives reranked results (sorted by relevance/score).
   - Logs the output if logging is enabled.
   - Returns the most highly ranked document together with other parameters in a structured response.

## Usage

### 🐳 Run with Docker

```sh
docker run -d \
  --name opea-reranker \
  -p 6100:8000 \
  -e TEI_RERANKING_ENDPOINT=http://tei_reranker:80 \
  -e RERANKER_MODEL_ID=bge-reranker-base \
  -e HUGGING_FACE_HUB_TOKEN=your_hf_token \
  opea/reranker:latest
```

#### Key Elements Explained

- `-p 6100:8000`: Maps port 8000 in the container to port 6100 on your host. Access the API at `http://localhost:6100/v1/reranking`.
- `-e TEI_RERANKING_ENDPOINT=http://tei_reranker:80`: Sets the endpoint of the TEI reranker backend (replace `tei_reranker_host` with your TEI reranker container or server address).
- `-e RERANKER_MODEL_ID=bge-reranker-base`: Specifies the reranker model to use (should match the model used by TEI).
- `-e HUGGING_FACE_HUB_TOKEN=your_hf_token`: Sets your Hugging Face access token for model downloads (if needed).
- `opea/reranker:latest`: The Docker image for the OPEA reranking microservice.

**Request**

```sh
curl http://localhost:6100/v1/reranking \
  -X POST \
  -d '{
        "initial_query": "What is AI?",
        "retrieved_docs": [
          {"text": "Artificial intelligence is ..."},
          {"text": "Wow hahaha good!"},
          {"text": "AI is not ..."}
        ],
        "top_n": 1
      }' \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{"id":"56fb1c397b14f5767e810c8d296f7fd5",
 "model":null,
 "query":"What is AI?",
 "max_tokens":1024,
 "max_new_tokens":1024,
 "top_k":10,
 "top_p":0.95,
 "typical_p":0.95,
 "temperature":0.01,
 "frequency_penalty":0.0,
 "presence_penalty":0.0,
 "repetition_penalty":1.03,
 "stream":true,
 "language":"auto",
 "chat_template":null,
 "documents":["Artificial intelligence is ..."]}
```

## Notes

- **TEI Reranker Backend:**  
  The `TEI_RERANKING_ENDPOINT` must point to a running TEI reranker service (see [TEI Reranker Microservice README](../tei_reranker/README.md) for setup).
- **Model Consistency:**  
  The `RERANKER_MODEL_ID` should match the model used by your TEI reranker backend.
- **Environment Variables:**
  - `TEI_RERANKING_ENDPOINT`: (Required) URL of the TEI reranker backend.
  - `RERANKER_MODEL_ID`: (Optional) Model ID for reranking.
  - `HUGGING_FACE_HUB_TOKEN`: (Optional) Hugging Face token for model downloads.
- **Port Mapping:**  
  Ensure the ports are correctly mapped to avoid conflicts with other services.
- **Proxy Support:**  
  You can set `http_proxy` and `https_proxy` environment variables if needed.
- **Logging:**  
  Set `LOGFLAG=true` to enable detailed logging.

## Extending

- **Change Model:**  
  Modify the `RERANKER_MODEL_ID` environment variable to use a different reranker model.
- **Switch TEI Backend:**  
  Change the `TEI_RERANKING_ENDPOINT` to point to a different TEI reranker service (CPU or GPU, local or remote).
- **Integrate with Other Services:**  
  The REST API is compatible with OPEA and can be called from retrieval, search, or RAG pipelines for improved result ranking.
- **Custom Deployment:**  
  You can adapt the Docker run command or use Docker Compose for more complex setups.

## License

SPDX-License-Identifier: Apache-2.0

For more license information, see [OPEA License](https://github.com/opea-ai/opea/blob/main/LICENSE) and [Hugging Face TEI License](https://github.com/huggingface/text-embeddings-inference/blob/main/LICENSE).