# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import asyncio
import os
from typing import Union

from langchain_community.utilities.requests import JsonRequestsWrapper
from langchain_huggingface import ChatHuggingFace
from langchain_openai import ChatOpenAI

from comps import CustomLogger, GeneratedDoc, OpeaComponent, OpeaComponentRegistry, ServiceType, TextDoc

logger = CustomLogger("opea_gemma_guard")
logflag = os.getenv("LOGFLAG", False)

DEFAULT_MODEL = "gemma-3-1b-it"
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


@OpeaComponentRegistry.register("OPEA_GEMMA_GUARD")
class OpeaGuardrailsGemmaGuard(OpeaComponent):
    """A specialized guardrails component derived from OpeaComponent."""

    def __init__(self, name: str, description: str, config: dict = None):
        super().__init__(name, ServiceType.GUARDRAIL.name.lower(), description, config)
        safety_guard_endpoint = os.getenv("SAFETY_GUARD_ENDPOINT", "http://vllm-translation-guardrail:9031/v1")
        safety_guard_model = os.getenv("SAFETY_GUARD_MODEL_ID", DEFAULT_MODEL)
        self.llm_guard = ChatOpenAI(
            base_url=safety_guard_endpoint,  # Should be like http://vllm-translation-guardrail:9031/v1
            api_key="not-needed",            # vLLM ignores this unless configured otherwise
            model=safety_guard_model,
            temperature=0.01,
            max_tokens=100,
        )

        # chat engine for server-side prompt templating
        health_status = self.check_health()
        if not health_status:
            logger.error("OpeaGuardrailsGemmaGuard health check failed.")

    async def invoke(self, input: Union[GeneratedDoc, TextDoc]):
        """Asynchronously invokes guardrails checks for the input.

        This function sends the input to the LLM engine for guardrails validation
        to check if the content adheres to defined policies. If violations are
        detected, the function returns a `TextDoc` object with details of the violated
        policies; otherwise, it returns the original input.

        Args:
            input (Union[GeneratedDoc, TextDoc]):
                - `GeneratedDoc`: Contains both a `prompt` and `text` to be validated.
                - `TextDoc`: Contains a single `text` input to be validated.

        Returns:
            TextDoc:
                - If the input passes the policy checks, the original `text` is returned.
                - If the input violates policies, a message indicating the violated policies
                and a downstream blacklist (`downstream_black_list`) are included.
        """
        if isinstance(input, GeneratedDoc):
            messages = INSTRUCTION_FORMAT.format(prompt=input.prompt, response=input.text)
        else:
            messages = INSTRUCTION_FORMAT.format(prompt=input.text, response="")

        print('🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰')
        print(messages)
        print('🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰')

        response_input_guard = await asyncio.to_thread(self.llm_guard.invoke, messages)

        print('🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉')
        print(type(response_input_guard))
        print(response_input_guard)
        print('🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉🍉')

        if hasattr(response_input_guard, "content") and "reject" in response_input_guard.content:
            if logflag:
                logger.info("Violated policies: harmful")
            res = TextDoc(text="Violated policies: harmful, please check your input.", downstream_black_list=[".*"])
        else:
            res = TextDoc(text=input.text)
        if logflag:
            logger.info(res)
        return res

    def check_health(self) -> bool:
        """Checks the health of the Gemma Guard service.

        This function verifies if the Gemma Guard service is operational by
        sending a guardrails check request to the LLM engine. It evaluates the
        service's response to determine its health.

        Returns:
            bool:
                - True if the service is reachable and responds with a valid "safe" keyword.
                - False if the service is unreachable, the response is invalid, or an exception occurs.
        """
        try:
            if not self.llm_guard:
                return False

            # Send a request to do guardrails check
            response = self.llm_guard.invoke("The sky is blue.")

            if "safe" in response:
                return True
            else:
                return False

        except Exception as e:
            # Handle exceptions such as network errors or unexpected failures
            logger.error(f"Health check failed due to an exception: {e}")
            return False
