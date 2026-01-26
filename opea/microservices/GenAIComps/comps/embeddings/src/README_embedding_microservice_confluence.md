# OPEA Embedding Microservice

## Overview

The Embedding Microservice is designed to efficiently convert textual strings into vectorized embeddings, facilitating seamless integration into various machine learning and data processing workflows. As a wrapper around the [Text Embeddings Inference](./README_tei_confluence.md), it utilizes advanced algorithms to generate high-quality embeddings that capture the semantic essence of the input text, making it ideal for applications in natural language processing, information retrieval, and similar fields.

It is designed for scalable, production-ready deployment and can be used as a standalone service or as part of a larger AI platform.

* Service port: 6000
* API endpoint: /v1/embeddings
* Model Backend: TEI (e.g., bge-base-en-v1.5), served at a configurable endpoint (default: port 7000)

## Architecture & Flow

- **Containerized Service:** Runs as a Docker container.
- **Flexible Backend:** Supports multiple embedding engines (TEI, OVMS, CLIP, etc.) via configuration.
- **REST API:** Exposes `/v1/embeddings` endpoint for embedding requests and `/v1/health_check` for health monitoring.
- **Component Loader:** Dynamically loads the embedding backend based on environment variables.
- **Telemetry & Statistics:** Built-in logging and statistics collection for monitoring and debugging.

**Typical Flow:**

1. User/application sends a POST request with input text(s) to `/v1/embeddings`.
2. The microservice routes the request to the configured embedding backend (e.g., TEI).
3. The backend generates embeddings and returns them in a standardized format.

## Usage

### Run with Docker

```sh
docker run -d \
  --name embedding-microservice \
  -p 6000:6000 \
  -e EMBEDDING_COMPONENT_NAME=OPEA_TEI_EMBEDDING \
  -e TEI_EMBEDDING_ENDPOINT=http://tei:80 \
  -e EMBEDDING_MODEL_ID=bge-base-en-v1.5 \
  -e HUGGINGFACEHUB_API_TOKEN=your_hf_token \
  opea/embedding:latest
```

#### Key Elements Explained

- `-p 6000:6000`: Maps port 6000 in the container to port 6000 on your host. Access the API at `http://localhost:6000`.
- `-e EMBEDDING_COMPONENT_NAME=OPEA_TEI_EMBEDDING`: Selects the embedding backend (TEI in this example).
- `-e TEI_EMBEDDING_ENDPOINT=http://tei:80`: Sets the endpoint for the TEI backend.
- `-e EMBEDDING_MODEL_ID=bge-base-en-v1.5`: Specifies the embedding model to use.
- `-e HUGGINGFACEHUB_API_TOKEN=your_hf_token`: Sets your Hugging Face access token for model downloads.
- `opea/embedding:latest`: The Docker image for the embedding microservice.

**Request**

```sh
curl http://localhost:6000/v1/embeddings \
  -X POST \
  -d '{"input":"Hello world!"}' \
  -H 'Content-Type: application/json'
```

**Response (Same as the TEI response)**

```json
{"object":"list",
 "model":"BAAI/bge-base-en-v1.5",
 "data":[{"index":0,"object":"embedding",
          "embedding":[0.042191405,0.032216996,0.01358883,0.0048134346,0.032859944,0.031452406,0.03913305, ...]}],
 "usage":{"prompt_tokens":5,
          "total_tokens":5,
          "completion_tokens":0}}
```

## Notes

- **Backend Selection:**  
  The backend is selected via the `EMBEDDING_COMPONENT_NAME` environment variable. Supported values include:
  - `OPEA_TEI_EMBEDDING` (Hugging Face TEI, default in the MVP)
  - `OPEA_OVMS_EMBEDDING` (OpenVINO Model Server)
  - `OPEA_CLIP_EMBEDDING` (CLIP)
  - `PREDICTIONGUARD_EMBEDDING` (PredictionGuard)
- **Model and Endpoint Configuration:**  
  Set the appropriate endpoint and model ID for your chosen backend.
- **Environment Variables:**  
  - `EMBEDDING_COMPONENT_NAME`: Backend selector.
  - `TEI_EMBEDDING_ENDPOINT`: TEI backend URL.
  - `EMBEDDING_MODEL_ID`: Model ID for embedding.
  - `HUGGINGFACEHUB_API_TOKEN`: Hugging Face token (if using TEI).
- **Port Mapping:**  
  Ensure the ports are correctly mapped to avoid conflicts with other services.

## Extending

- **Add New Backends:**  
  Implement a new component class and register it in the component loader.
- **Custom Models:**  
  Change the `EMBEDDING_MODEL_ID` to use different models as needed.
- **Integration:**  
  The REST API is compatible with the [OpenAI API](https://platform.openai.com/docs/api-reference/embeddings), making integration with other tools straightforward.

## License

SPDX-License-Identifier: Apache-2.0