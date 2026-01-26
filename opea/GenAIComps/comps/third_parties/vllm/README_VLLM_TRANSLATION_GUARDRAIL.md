# vllm-translation-guardrail Microservice

## Overview

The vllm-translation-guardrail microservice provides a fast, scalable OpenAI-compatible API endpoint for LLM inference, specifically designed to serve as the backend for guardrail and translation tasks. It leverages vLLM for high-throughput, low-latency model serving, and is typically used as the LLM backend for safety guardrails in GenAI pipelines.

* Default Model: google/gemma-3-1b-it
* Default Port: 9031
* API endpoint:  /v1/chat/completions

## Architecture & Flow

1. **Container Startup**:

The service is launched as a Docker container, exposing the OpenAI-compatible API on port `9031`.

2. **Model Serving**:

The container loads the specified LLM (default: `google/gemma-3-1b-it`) and serves requests via the vLLM engine.

3. **API**:

Accepts POST requests at `/v1/chat/completions` with OpenAI-style payloads.

4. **Integration**:

Other microservices (e.g., guardrail) connect to this endpoint for prompt evaluation and safety checks.

## Usage

1. Set Up Environment

    Obtain a Hugging Face Hub token and export it:
```bash
export HUGGINGFACEHUB_API_TOKEN=<your_huggingface_token>
```

2. Launch the Microservice

```bash
docker run -d --name vllm-translation-guardrail \
  --network test_network \
  -p 9031:9031 \
  -e HUGGING_FACE_HUB_TOKEN=$HUGGING_FACE_HUB_TOKEN \
  -v /root/.cache/huggingface:/root/.cache/huggingface \
  --gpus all \
  --ipc=host \
  vllm/vllm-openai:latest \
  --model google/gemma-3-1b-it \
  --gpu_memory_utilization 0.35 \
  --served-model-name gemma-3-1b-it \
  --max_model_len 1024 \
  --dtype=half \
  --port 9031
```

API Example

**Request**

```bash
curl http://localhost:9031/v1/chat/completions \
    -X POST \
    -d '{"messages": [{"role": "user", "content": "What is Deep Learning?"}], "max_tokens":17}' \
    -H 'Content-Type: application/json'
```

**Response**

```json
{"id":"chatcmpl-7a1edf5589fb4cb1abec14b76bbfcf8d","object":"chat.completion","created":1749230195,"model":"gemma-3-1b-it","choices":[{"index":0,"message":{"role":"assistant","reasoning_content":null,"content":"Okay, let's break down what Deep Learning is. It's a fascinating","tool_calls":[]},"logprobs":null,"finish_reason":"length","stop_reason":null}],"usage":{"prompt_tokens":14,"total_tokens":31,"completion_tokens":17,"prompt_tokens_details":null},"prompt_logprobs":null,"kv_transfer_params":null}
```

## Notes

* The container requires access to a GPU.
* The Hugging Face Hub token must have permission to download the specified model.
* The service is intended to be used as a backend for other microservices (e.g., guardrail, translation).
* You can change the model or port by modifying the `--model` and `--port arguments`.

## Extending

* Change Model:

    Replace --model google/gemma-3-1b-it with any supported Hugging Face model.

* Tune Performance:
    
    Adjust `--gpu_memory_utilization`, `--max_model_len`, or other vLLM parameters as needed.

* CPU or Other Hardware:

    Use [`build_docker_vllm_v2.sh`](./src/build_docker_vllm_v2.sh) if you need a custom build for your hardware or want to modify the vLLM source.

## License

SPDX-License-Identifier: Apache-2.0

For more details, see the [vLLM documentation](https://docs.vllm.ai/en/latest/) or codes in the [third_parties/vllm](../vllm/) directory.