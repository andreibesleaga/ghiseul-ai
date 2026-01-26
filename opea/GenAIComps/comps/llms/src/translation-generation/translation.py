# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import time
from typing import Union

from comps import (
    CustomLogger,
    LLMParamsDoc,
    OpeaComponentLoader,
    SearchedDoc,
    ServiceType,
    opea_microservices,
    register_microservice,
    register_statistics,
    statistics_dict,
)
from comps.cores.proto.api_protocol import ChatCompletionRequest
from comps.cores.proto.api_protocol import TranslationRequest
from comps.cores.telemetry.opea_telemetry import opea_telemetry

logger = CustomLogger("llm")
logflag = os.getenv("LOGFLAG", False)

llm_component_name = os.getenv("LLM_COMPONENT_NAME", "OpeaTranslationService")
if logflag:
    logger.info(f"Get llm_component_name {llm_component_name}")


from integrations.service import OpeaTranslationService

# Initialize OpeaComponentLoader
loader = OpeaComponentLoader(llm_component_name, description=f"OPEA LLM Component: {llm_component_name}")


@register_microservice(
    name="opea_service@translation",
    service_type=ServiceType.LLM,
    endpoint="/v1/chat/completions", ###
    host="0.0.0.0",
    port=9030,
)
@opea_telemetry
@register_statistics(names=["opea_service@translation"])
async def llm_generate(input: TranslationRequest):
    start = time.time()

    # Log the input if logging is enabled
    if logflag:
        logger.info(input)

    try:
        # Use the loader to invoke the component
        response = await loader.invoke(input)
        # Record statistics
        statistics_dict["opea_service@translation"].append_latency(time.time() - start, None)
        return response

    except Exception as e:
        logger.error(f"Error during LLM invocation: {e}")
        raise


if __name__ == "__main__":
    logger.info("OPEA Translation Microservice is starting...")
    opea_microservices["opea_service@translation"].start()
