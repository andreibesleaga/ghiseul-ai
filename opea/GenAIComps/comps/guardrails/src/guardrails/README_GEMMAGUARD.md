# OPEA Guardrail Microservice

The OPEA Guardrail Microservice provides an automated safety and compliance layer for LLM (Large Language Model) applications. It analyzes user prompts and LLM responses to detect harmful requests or outputs, and can block or flag unsafe content. The service is designed to be modular, extensible, and easy to integrate into any LLM pipeline.

## Overview

* Service port: `9090`
* API endpoint: `/v1/guardrails`
* Model Backend: vLLM (e.g., gemm3-1b-it), served at a configurable endpoint (default: port 9031)
* Prompting: User input and LLM responses are systematically organized within a predefined prompt template to enhance direct toxicity classification.

## Architecture & Flow

1. **Container Startup**:

    The microservice is built from a Dockerfile and starts by running [`opea_guardrails_microservice.py`](./opea_guardrails_microservice.py).

2. **Logging**:

    Logging is handled by a custom logger named `opea_guardrail_microservice`.

3. **Component Loading**:

    The service uses OpeaComponentLoader to dynamically load the guardrail component, defaulting to `OPEA_GEMMA_GUARD`.

4. **Microservice Registration**:

    The guardrail endpoint is registered at `/v1/guardrails` on port `9090`.

5. **Guardrail Logic**:

* The core logic is implemented in [`gemmaguard.py`](./integrations/gemmaguard.py).
* The [`OpeaGuardrailsGemmaGuard`](./integrations/gemmaguard.py#39) class initializes a connection to the LLM guard endpoint (`vllm-translation-guardrail:9031`).
* The model used is configurable via the `SAFETY_GUARD_MODEL_ID` environment variable (default: `gemma-3-1b-it`).
* The LLM is accessed via the [`ChatOpenAI`](./integrations/gemmaguard.py#46) interface with a low temperature (0.01) for deterministic outputs.
* A prompt template is used to structure the safety check request.
* The LLM output is parsed to determine if the input or response is harmful, and a Boolean result is returned. If harmful content is detected, the model will return "reject", which is then processed to generate a response indicating the violation.

## Usage

1. **Start the vllm-translation-guardrail Microservice**:

    Ensure the `vllm-translation-guardrail` backend is running before starting this service. For setup and launch instructions, refer to the [`third_parties/vllm/README.md`](../../../third_parties/vllm/README.md) file.

2. Build the Docker Image

```bash
cd /root/opea_arangodb/1.3/GenAIComps/ # Change directory because the Dockerfile expects ./comps to be present in this location

docker build -t test-guardrail -f comps/guardrails/src/guardrails/Dockerfile .
```

3. Run the Guardrail Microservice

```bash
docker run -d --name llm-guardrail \
  --network test_network \
  -p 9090:9090 \
  -e SAFETY_GUARD_MODEL_ID=gemma-3-1b-it \
  -e GUARDRAILS_COMPONENT_NAME=OPEA_GEMMA_GUARD \
  -e LLM_ENDPOINT=http://vllm-translation-guardrail:9031 \
  -e LLM_MODEL_ID=gemma-3-1b-it \
  --ipc=host \
  test-guardrail
```

**Environment Variables**:

* `SAFETY_GUARD_MODEL_ID`: Model to use for guardrails (default: gemma-3-1b-it)
* `GUARDRAILS_COMPONENT_NAME`: Guardrail component name (default: OPEA_GEMMA_GUARD)
* `LLM_ENDPOINT`: Endpoint for the LLM guard service (default: http://vllm-translation-guardrail:9031)

3. Make a Request

**Request**

```bash
curl http://localhost:9090/v1/guardrails\
  -X POST \
  -d '{"prompt":"How do you buy a tiger in the US?", "text":"Yes you can definitely buy a tiger in the US.", "parameters":{"max_new_tokens":32}}' \
  -H 'Content-Type: application/json'
```

**Response**

```bash
{"downstream_black_list":[".*"],"id":"d88a849f224f24a9fd057f9507e6197c","text":"Violated policies: harmful, please check your input."}
```

## Key Files

* [`opea_guardrails_microservice.py`](./opea_guardrails_microservice.py)
    
    Main entrypoint. Registers the microservice, sets up logging, loads the guardrail component, and exposes the /v1/guardrails endpoint.

* [`gemmaguard.py`](./integrations/gemmaguard.py)

    Implements the OpeaGuardrailsGemmaGuard class. Defines the prompt template, initializes the LLM guard, and contains the logic for invoking the safety check.

### Prompt Template

```python
INSTRUCTION_FORMAT = """<s><|user|>
[INST] You are a classifier for analyzing interactions between humans and LLMs. 
Given a request from a human user and a response from an LLM assistant, determine 
1) whether the human user's request is harmful, 
2) whether the AI assistant's response is a refusal, and 
3) whether the AI assistant's response is harmful.

If any of these conditions are true (harmful or refusal), return "reject" for the corresponding item; otherwise, return "pass".

Human user:
{prompt}

AI assistant:
{response}

---

Answers: [/INST]
<|assistant|>
"""
```

## Notes

* The microservice expects a running LLM guard endpoint at `http://vllm-translation-guardrail:9031/v1`.
* The guardrail logic is model-agnostic but defaults to gemma-3-1b-it.
* The service uses a deterministic LLM configuration ([`temperature=0.01`](./integrations/gemmaguard.py#L52)) for consistent safety checks.

## Extending

* **Add New Guard Models**:

Currently, both the translation microservice and the guardrail microservice utilize the same large language model due to GPU RAM constraints. For improved performance and specialization, it is recommended to use a separate, fine-tuned open source guardrail model if available.

* **Custom Prompt Templates**:

Modify the [`INSTRUCTION_FORMAT`](./integrations/gemmaguard.py#L18) in [`gemmaguard.py`](./integrations/gemmaguard.py) to change the safety check logic or output format.

## License

SPDX-License-Identifier: Apache-2.0

For more details, see the code in the guardrails directory.