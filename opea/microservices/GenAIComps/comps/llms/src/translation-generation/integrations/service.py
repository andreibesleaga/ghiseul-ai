# Copyright (C) 2024 Prediction Guard, Inc.
# SPDX-License-Identified: Apache-2.0

import asyncio
import os

import httpx

from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from comps import CustomLogger, OpeaComponent, OpeaComponentRegistry, ServiceType
from comps.cores.mega.utils import ConfigError, get_access_token, load_model_configs
from comps.cores.proto.api_protocol import ChatCompletionRequest
from comps.cores.proto.api_protocol import TranslationRequest 

from .template import ChatTemplate

logger = CustomLogger("opea_llm")
logflag = os.getenv("LOGFLAG", False)

# Environment variables
MODEL_NAME = os.getenv("LLM_MODEL_ID")
MODEL_CONFIGS = os.getenv("MODEL_CONFIGS")
DEFAULT_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://localhost:8000")
TOKEN_URL = os.getenv("TOKEN_URL")
CLIENTID = os.getenv("CLIENTID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "EMPTY")

# Validate and Load the models config if MODEL_CONFIGS is not null
configs_map = {}
if MODEL_CONFIGS:
    try:
        configs_map = load_model_configs(MODEL_CONFIGS)
    except ConfigError as e:
        logger.error(f"Failed to load model configurations: {e}")
        raise ConfigError(f"Failed to load model configurations: {e}")


def get_llm_endpoint():
    if not MODEL_CONFIGS:
        return DEFAULT_ENDPOINT
    try:
        return configs_map.get(MODEL_NAME).get("endpoint")
    except ConfigError as e:
        logger.error(f"Input model {MODEL_NAME} not present in model_configs. Error {e}")
        raise ConfigError(f"Input model {MODEL_NAME} not present in model_configs")


@OpeaComponentRegistry.register("OpeaTranslationService")
class OpeaTranslationService(OpeaComponent):
    """A specialized OPEA LLM component derived from OpeaComponent for interacting with TGI/vLLM services based on OpenAI API.

    Attributes:
        client (TGI/vLLM): An instance of the TGI/vLLM client for text generation.
    """

    def __init__(self, name: str, description: str, config: dict = None):
        super().__init__(name, ServiceType.LLM.name.lower(), description, config)
        self.client = self._initialize_client()
        health_status = self.check_health()
        if not health_status:
            logger.error("OpeaTranslationService health check failed.")

    def _initialize_client(self) -> AsyncOpenAI:
        """Initializes the AsyncOpenAI."""
        access_token = (
            get_access_token(TOKEN_URL, CLIENTID, CLIENT_SECRET) if TOKEN_URL and CLIENTID and CLIENT_SECRET else None
        )
        headers = {}
        if access_token:
            headers = {"Authorization": f"Bearer {access_token}"}
        llm_endpoint = get_llm_endpoint()
        return AsyncOpenAI(api_key=OPENAI_API_KEY, base_url=llm_endpoint + "/v1", timeout=600, default_headers=headers)

    def check_health(self) -> bool:
        """Checks the health of the TGI/vLLM LLM service.

        Returns:
            bool: True if the service is reachable and healthy, False otherwise.
        """

        try:

            async def send_simple_request():
                response = await self.client.completions.create(model=MODEL_NAME, prompt="How are you?", max_tokens=4)
                return response

            response = asyncio.run(send_simple_request())
            return response is not None
        except Exception as e:
            logger.error(e)
            logger.error("Health check failed")
            return False

    def align_input(self, input: TranslationRequest):
        
        if logflag:
            logger.info("[ TranslationRequest ] plain string input for translation")
            
        # You could use a simple prompt template here
        prompt = ChatTemplate.generate_translation_prompt(input.text)

        return prompt


    async def invoke(self, input: TranslationRequest):
        """Invokes the TGI/vLLM LLM service to translate the input text.
        Args:
        input (TranslationRequest): The input text for translation.
        """

        prompt = self.align_input(input)

        # Request completion using endpoint
        try:
            chat_completion = await self.client.chat.completions.create(
                model=MODEL_NAME,
                messages=prompt,
                # max_tokens=max_tokens,
                temperature=0,
                top_p=1.0,
                stream=input.stream,
            )
        except Exception as e:
            logger.error(f"LLM invocation failed: {e}")
            raise


        if input.stream:
            async def stream_generator():
                async for c in chat_completion:
                    chunk = c.model_dump_json()
                    if logflag:
                        logger.info(chunk)
                    if chunk not in ["<|im_end|>", "<|endoftext|>"]:
                        yield f"data: {chunk}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(stream_generator(), media_type="text/event-stream")
        else:
            return chat_completion.choices[0].message.content
