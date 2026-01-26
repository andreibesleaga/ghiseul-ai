# vllm-vllm-2 Microservice

## Overview

The vllm-vllm-2 microservice provides a high-performance, OpenAI-compatible API endpoint for LLM inference using [vLLM](https://github.com/vllm-project/vllm). It is designed to serve as the backend for the textgen microservice, enabling fast and scalable text generation with state-of-the-art models.

* Default Model: `microsoft/Phi-4-mini-instruct`
* Default Port: `8000`
* API endpoint: /v1/chat/completions

## Architecture & Flow

1. **Container Startup**:

    The service is launched as a Docker container, exposing the OpenAI-compatible API on port `8000`.

2. **Model Serving**:

    The container loads the specified LLM (default: `microsoft/Phi-4-mini-instruct`) and serves requests via the vLLM engine.

3. **API**:

    Accepts POST requests at `/v1/chat/completions` with OpenAI-style payloads.

4. Integration:

    The textgen microservice and other components connect to this endpoint for text generation.

## Usage

1. Set Up Environment
    
    Obtain a Hugging Face Hub token and export it:

```bash
export HUGGINGFACEHUB_API_TOKEN=<your_huggingface_token>
```

2. Launch the Microservice

```bash
docker run -d --name vllm-vllm-2 \
  --network test_network \
  --gpus all \
  -p 8000:8000 \
  -e HUGGING_FACE_HUB_TOKEN=$HUGGING_FACE_HUB_TOKEN \
  -v /root/.cache/huggingface:/root/.cache/huggingface \
  --ipc=host \
  vllm/vllm-openai:latest \
  --model microsoft/Phi-4-mini-instruct \
  --gpu_memory_utilization 0.65 \
  --served-model-name Phi-4-mini-instruct \
  --max_model_len 2048 \
  --dtype=half
```

API Request

**Request**

```bash
curl http://localhost:8000/v1/chat/completions \
    -X POST \
    -d '{"messages": [{"role": "user", "content": "What is Deep Learning?"}], "max_tokens":17}' \
    -H 'Content-Type: application/json'
```

**Response**

```json
{"id":"chatcmpl-2594cd8ef5d04cf6a6dc0c2660e63c80","object":"chat.completion","created":1749238824,"model":"Phi-4-mini-instruct","choices":[{"index":0,"message":{"role":"assistant","reasoning_content":null,"content":"Deep Learning is a subfield of artificial intelligence (AI) that focuses on algorithms inspired","tool_calls":[]},"logprobs":null,"finish_reason":"length","stop_reason":null}],"usage":{"prompt_tokens":8,"total_tokens":25,"completion_tokens":17,"prompt_tokens_details":null},"prompt_logprobs":null,"kv_transfer_params":null}
```

## Notes

* The container requires access to a GPU.
* The Hugging Face Hub token must have permission to download the specified model.
* The service is intended to be used as a backend for the textgen microservice and other LLM consumers.
* You can change the model or port by modifying the `--model` and `--port` arguments.

## Extending

* **Change Model**:

    Replace `--model microsoft/Phi-4-mini-instruct` with any supported Hugging Face model.

* **Tune Performance**:

    Adjust `--gpu_memory_utilization`, `--max_model_len`, or other vLLM parameters as needed.

* **CPU or Other Hardware**:

    For CPU or Gaudi/HPU support, see the vLLM documentation and consider building a custom image.

## License

SPDX-License-Identifier: Apache-2.0

For more details, see the [vLLM documentation](https://docs.vllm.ai/en/latest/) or codes in the [third_parties/vllm](../vllm/) directory.