# OPEA Translation Microservice

This microservice provides a translation API between English and Swahili, leveraging a vLLM backend and following the OpenAI API format. It is designed for easy integration into larger AI workflows and can be deployed as a containerized service.

## Overview

* Service Port: `9030`
* API Endpoint: `/v1/chat/completions`
* Supported Languages: English ↔ Swahili (auto-detected per request)
* Model Backend: vLLM (e.g., gemm3-1b-it), served at a configurable endpoint (default: port 9031)
* Prompting: Prompts are generated based on detected language using langdetect and preset templates.
* Response Format: OpenAI-compatible
* Streaming Support: Yes, both streaming and non-streaming responses are supported.

## Architecture & Flow

1. **Startup**:

    The service is started via [`translation.py`](./translation.py), which initializes logging, loads the translation component, and registers the microservice endpoint.

2. **Component Loader**:

    The [`OpeaComponentLoader`](./translation.py#L34) loads the [`OpeaTranslationService`](./integrations/service.py#L52) class, which manages all LLM interactions.

3. **Environment Variables**:

    Configuration (model name, endpoint, API keys, etc.) is loaded from environment variables (via the [`.env`](../../../../../.env) file).

4. **LLM Endpoint**:

    The service connects to a vLLM backend (default: `http://localhost:9031`) to process translation requests.

5. **Prompt Generation**:

* The [`ChatTemplate.generate_translation_prompt`](./integrations/template.py#L8) function uses the [`langdetect`](./integrations/template.py#L3) package to determine the source language.
* If the text is detected as English, it prompts for translation to Swahili.
* If detected as Swahili (or not English), it prompts for translation to English.
* If detection fails, English is assumed as default input language.

6. **Request Handling**:

* The API expects a [`TranslationRequest`](../../../cores/proto/api_protocol.py#L1018) (see [`api_protocol.py`](../../../cores/proto/api_protocol.py)).
* The request is aligned and sent to the LLM backend.
* The LLM output is parsed and returned as a plain string.

7. **Logging & Telemetry**:

* Logging is handled via a custom logger.
* Telemetry and statistics are collected for each request.

## Usage

1. **Check the Dockerfile**:
    Ensure your [`Dockerfile`](./Dockerfile) for the translation microservice uses [`entrypoint.sh`](./entrypoint.sh) to launch the service via [`translation.py`](./translation.py).

2. **Start the vllm-translation-guardrail Microservice**:
    Ensure the vllm-translation-guardrail backend is running before starting this service. For setup and launch instructions, refer to the [`third_parties/vllm/README.md`](../../../../third_parties/vllm/README.md#L293) file.

3. **Build & Run**:

```bash
cd /root/opea_arangodb/1.3/GenAIComps/ # Change directory because the Dockerfile expects ./comps to be present in this location

docker build -f comps/llms/src/translation-generation/Dockerfile -t test-translation .

export LLM_ENDPOINT=http://vllm-translation-guardrail:9031
export LLM_MODEL_ID=gemma-3-1b-it

docker run -d --name llm-translation \
  --network test_network \
  -e LLM_ENDPOINT=$LLM_ENDPOINT \
  -e LLM_MODEL_ID=$LLM_MODEL_ID \
  -p 9030:9030 \
  --ipc=host \
  test-translation
```

API Example

**Request**:

```bash
curl http://localhost:9030/v1/chat/completions \
    -X POST \
    -d '{"text": "Who is larger? A capybara or a dog?", "stream":false}' \
    -H 'Content-Type: application/json'
```

**Response**:

```bash
"Mtu jina gani ni ngumu ladha? (A capybara au mbwa?)\n"
```

## Key Files

* [`translation.py`](./translation.py) — Microservice entrypoint and API registration
* [`service.py`](./integrations/service.py) — Main translation service logic, LLM client, health checks
* [`template.py`](./integrations/template.py) — Prompt generation using language detection
* [`api_protocol.py`](../../../cores/proto/api_protocol.py) — API request/response schema definitions

### Prompt Template

```python
if lang == "en":
    return [
        {
            "role": "user", 
            "content": f"Translate this English text to Swahili. Return ONLY the translation:\n{source_text}"
        }
    ] 
else:
    return [
        {
            "role": "user",
            "content": f"Tafsiri maandishi haya ya Kiswahili kwa Kiingereza. Toa tu tafsiri:\n{source_text}"
        }
    ]
```

## Notes

* **Language Detection**: Only English and Swahili are supported for MVP. If detection fails, English is assumed as the input language.
* **Model Parameters**: Temperature is set to 0, top_p to 1.0 for deterministic outputs.
* **Streaming**: The API supports both streaming and non-streaming responses.
* **Compatibility**: The API and responses are compatible with OpenAI's chat completion format.

## Extending

To support more languages or models, update the [`generate_translation_prompt`](./integrations/template.py#L8) logic in [`template.py`](./integrations/template.py) and adjust environment/model configs as needed.

## License
SPDX-License-Identifier: Apache-2.0

For more details, see the code and comments in each referenced file.