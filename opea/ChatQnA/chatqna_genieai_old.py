# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import argparse
import json
import os
import re

from comps import MegaServiceEndpoint, MicroService, ServiceOrchestrator, ServiceRoleType, ServiceType
from comps.cores.mega.utils import handle_message
from comps.cores.proto.api_protocol import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatMessage,
    UsageInfo,
    TranslationRequest ###################################################################################################
)
from comps.cores.proto.docarray import LLMParams, RerankerParms, RetrieverParms
from fastapi import Request
from fastapi.responses import StreamingResponse
from langchain_core.prompts import PromptTemplate


class ChatTemplate:
    @staticmethod
    def generate_rag_prompt(question, documents):
        context_str = "\n".join(documents)
        if context_str and len(re.findall("[\u4e00-\u9fff]", context_str)) / len(context_str) >= 0.3:
            # chinese context
            template = """
### 你将扮演一个乐于助人、尊重他人并诚实的助手，你的目标是帮助用户解答问题。有效地利用来自本地知识库的搜索结果。确保你的回答中只包含相关信息。如果你不确定问题的答案，请避免分享不准确的信息。
### 搜索结果：{context}
### 问题：{question}
### 回答：
"""
        else:
            template = """
### You are a helpful, respectful and honest assistant to help the user with questions. \
Please refer to the search results obtained from the local knowledge base. \
But be careful to not incorporate the information that you think is not relevant to the question. \
If you don't know the answer to a question, please don't share false information. \n
### Search results: {context} \n
### Question: {question} \n
### Answer:
"""
        return template.format(context=context_str, question=question)


MEGA_SERVICE_PORT = int(os.getenv("MEGA_SERVICE_PORT", 8888))
GUARDRAIL_SERVICE_HOST_IP = os.getenv("GUARDRAIL_SERVICE_HOST_IP", "0.0.0.0")
GUARDRAIL_SERVICE_PORT = int(os.getenv("GUARDRAIL_SERVICE_PORT", 80))
TRANSLATION_SERVICE_HOST_IP = os.getenv("TRANSLATION_SERVICE_HOST_IP", "0.0.0.0") ########################################
TRANSLATION_SERVICE_PORT = int(os.getenv("TRANSLATION_SERVICE_PORT", 80)) ################################################
EMBEDDING_SERVER_HOST_IP = os.getenv("EMBEDDING_SERVER_HOST_IP", "0.0.0.0")
EMBEDDING_SERVER_PORT = int(os.getenv("EMBEDDING_SERVER_PORT", 80))
RETRIEVER_SERVICE_HOST_IP = os.getenv("RETRIEVER_SERVICE_HOST_IP", "0.0.0.0")
RETRIEVER_SERVICE_PORT = int(os.getenv("RETRIEVER_SERVICE_PORT", 7000))
RERANK_SERVER_HOST_IP = os.getenv("RERANK_SERVER_HOST_IP", "0.0.0.0")
RERANK_SERVER_PORT = int(os.getenv("RERANK_SERVER_PORT", 80))
LLM_SERVER_HOST_IP = os.getenv("LLM_SERVER_HOST_IP", "0.0.0.0")
LLM_SERVER_PORT = int(os.getenv("LLM_SERVER_PORT", 80))
LLM_MODEL = os.getenv("LLM_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", None)


def align_inputs(self, inputs, cur_node, runtime_graph, llm_parameters_dict, **kwargs):

    ### GENIE.AI ##########################################################################################################
    if self.services[cur_node].service_type == ServiceType.TRANSLATOR:
        
        # This logic handles both translator_in and translator_out
        original_text = inputs["text"]
        original_language = kwargs.get("original_language", "auto")
        target_language = "English" # The internal language of our RAG system

        # For the final translation step, we swap the target language
        if "out" in cur_node:
            target_language = original_language

        # Simple prompt template for translation
        prompt = f"Translate the following text to {target_language}. Only provide the translation, with no additional commentary or explanations. Text: \"{original_text}\""

        # Format the request for the LLM service (similar to the LLM block)
        next_inputs = {}
        next_inputs["model"] = LLM_MODEL
        next_inputs["messages"] = [{"role": "user", "content": prompt}]
        next_inputs["temperature"] = 0.1 # Use low temperature for deterministic translation
        next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
        # Use a non-streaming call for the translation steps
        next_inputs["stream"] = False
        return next_inputs
    ### 21/08/25 ###########################################################################################################


    elif self.services[cur_node].service_type == ServiceType.EMBEDDING:
        inputs["inputs"] = inputs["text"]
        del inputs["text"]


    elif self.services[cur_node].service_type == ServiceType.RETRIEVER:
        # prepare the retriever params
        retriever_parameters = kwargs.get("retriever_parameters", None)
        if retriever_parameters:
            inputs.update(retriever_parameters.dict())

        ### GENIE.AI ######################################################################################################
        # New logic for labels filtering
        # Will need to modify retriever service API (arangodb_genieai.py) to accept 'filter'
        retriever_context = kwargs.get('retrieval_context', {})
        if retrieval_context:
            inputs['filter'] = retrieval_context
        ### 21/08/25 ######################################################################################################


    elif self.services[cur_node].service_type == ServiceType.LLM:
        # convert TGI/vLLM to unified OpenAI /v1/chat/completions format
        next_inputs = {}
        next_inputs["model"] = LLM_MODEL

        ### GENIE.AI ######################################################################################################
        # New logic for full chat history
        augmented_prompt = inputs["inputs"]
        full_chat_history = kwargs.get("full_chat_history", [])
        if full_chat_history and isinstance(full_chat_history, list):
            messages_as_dicts = list(full_chat_history[:-1])
            messages_as_dicts.append({"role":"user", "content":augmented_prompt})
            next_inputs["messages"] = messages_as_dicts
        else:
            next_inputs["messages"] = [{"role": "user", "content":augmented_prompt}]
        ### 21/08/25 ######################################################################################################

        next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
        next_inputs["top_p"] = llm_parameters_dict["top_p"]
        next_inputs["stream"] = inputs["stream"]
        next_inputs["frequency_penalty"] = inputs["frequency_penalty"]
        # next_inputs["presence_penalty"] = inputs["presence_penalty"]
        # next_inputs["repetition_penalty"] = inputs["repetition_penalty"]
        next_inputs["temperature"] = inputs["temperature"]
        inputs = next_inputs

    return inputs


def align_outputs(self, data, cur_node, inputs, runtime_graph, llm_parameters_dict, **kwargs):
    next_data = {}

    ### GENIE.AI ######################################################################################################
    if self.services[cur_node].service_type == ServiceType.TRANSLATOR:
        # The translator service (which is an LLM) returns an OpenAI-like response.
        # We need to extract the translated text from it.
        translated_text = data["choices"][0]["message"]["content"]
        
        # Clean up potential LLM conversational artifacts
        translated_text = translated_text.strip().strip('"')

        # The output of this node becomes the input for the next.
        return {"text": translated_text}
    ### 21/08/25 ######################################################################################################


    if self.services[cur_node].service_type == ServiceType.EMBEDDING:
        assert isinstance(data, list)
        next_data = {"text": inputs["inputs"], "embedding": data[0]}

    elif self.services[cur_node].service_type == ServiceType.RETRIEVER:

        docs = [doc["text"] for doc in data["retrieved_docs"]]

        with_rerank = runtime_graph.downstream(cur_node)[0].startswith("rerank")
        if with_rerank and docs:
            # forward to rerank
            # prepare inputs for rerank
            next_data["query"] = data["initial_query"]
            next_data["texts"] = [doc["text"] for doc in data["retrieved_docs"]]
        else:
            # forward to llm
            if not docs and with_rerank:
                # delete the rerank from retriever -> rerank -> llm
                for ds in reversed(runtime_graph.downstream(cur_node)):
                    for nds in runtime_graph.downstream(ds):
                        runtime_graph.add_edge(cur_node, nds)
                    runtime_graph.delete_node_if_exists(ds)

            # handle template
            # if user provides template, then format the prompt with it
            # otherwise, use the default template
            prompt = data["initial_query"]
            chat_template = llm_parameters_dict["chat_template"]
            if chat_template:
                prompt_template = PromptTemplate.from_template(chat_template)
                input_variables = prompt_template.input_variables
                if sorted(input_variables) == ["context", "question"]:
                    prompt = prompt_template.format(question=data["initial_query"], context="\n".join(docs))
                elif input_variables == ["question"]:
                    prompt = prompt_template.format(question=data["initial_query"])
                else:
                    print(f"{prompt_template} not used, we only support 2 input variables ['question', 'context']")
                    prompt = ChatTemplate.generate_rag_prompt(data["initial_query"], docs)
            else:
                prompt = ChatTemplate.generate_rag_prompt(data["initial_query"], docs)

            next_data["inputs"] = prompt

    elif self.services[cur_node].service_type == ServiceType.RERANK:
        # rerank the inputs with the scores
        reranker_parameters = kwargs.get("reranker_parameters", None)
        top_n = reranker_parameters.top_n if reranker_parameters else 1
        docs = inputs["texts"]
        reranked_docs = []
        for best_response in data[:top_n]:
            reranked_docs.append(docs[best_response["index"]])

        # handle template
        # if user provides template, then format the prompt with it
        # otherwise, use the default template
        prompt = inputs["query"]
        chat_template = llm_parameters_dict["chat_template"]
        if chat_template:
            prompt_template = PromptTemplate.from_template(chat_template)
            input_variables = prompt_template.input_variables
            if sorted(input_variables) == ["context", "question"]:
                prompt = prompt_template.format(question=prompt, context="\n".join(reranked_docs))
            elif input_variables == ["question"]:
                prompt = prompt_template.format(question=prompt)
            else:
                print(f"{prompt_template} not used, we only support 2 input variables ['question', 'context']")
                prompt = ChatTemplate.generate_rag_prompt(prompt, reranked_docs)
        else:
            prompt = ChatTemplate.generate_rag_prompt(prompt, reranked_docs)

        next_data["inputs"] = prompt

    elif self.services[cur_node].service_type == ServiceType.LLM and not llm_parameters_dict["stream"]:
        if "faqgen" in self.services[cur_node].endpoint:
            next_data = data
        else:
            next_data["text"] = data["choices"][0]["message"]["content"]
    else:
        next_data = data

    return next_data


def align_generator(self, gen, **kwargs):
    # OpenAI response format
    # b'data:{"id":"","object":"text_completion","created":1725530204,"model":"meta-llama/Meta-Llama-3-8B-Instruct","system_fingerprint":"2.0.1-native","choices":[{"index":0,"delta":{"role":"assistant","content":"?"},"logprobs":null,"finish_reason":null}]}\n\n'
    for line in gen:
        line = line.decode("utf-8")
        chunks = [chunk.strip() for chunk in line.split("\n\n") if chunk.strip()]
        for line in chunks:
            start = line.find("{")
            end = line.rfind("}") + 1
            json_str = line[start:end]
            try:
                # sometimes yield empty chunk, do a fallback here
                json_data = json.loads(json_str)
                if "ops" in json_data and "op" in json_data["ops"][0]:
                    if "value" in json_data["ops"][0] and isinstance(json_data["ops"][0]["value"], str):
                        yield f"data: {repr(json_data['ops'][0]['value'].encode('utf-8'))}\n\n"
                    else:
                        pass
                elif "content" in json_data["choices"][0]["delta"]:
                    yield f"data: {repr(json_data['choices'][0]['delta']['content'].encode('utf-8'))}\n\n"
            except Exception as e:
                yield f"data: {repr(json_str.encode('utf-8'))}\n\n"
    yield "data: [DONE]\n\n"


class ChatQnAService:
    def __init__(self, host="0.0.0.0", port=8888):
        self.host = host
        self.port = port
        ServiceOrchestrator.align_inputs = align_inputs
        ServiceOrchestrator.align_outputs = align_outputs
        ServiceOrchestrator.align_generator = align_generator
        self.megaservice = ServiceOrchestrator()
        self.endpoint = str(MegaServiceEndpoint.CHAT_QNA)

    def add_remote_service(self):

        embedding = MicroService(
            name="embedding",
            host=EMBEDDING_SERVER_HOST_IP,
            port=EMBEDDING_SERVER_PORT,
            endpoint="/embed",
            use_remote_service=True,
            service_type=ServiceType.EMBEDDING,
        )

        retriever = MicroService(
            name="retriever",
            host=RETRIEVER_SERVICE_HOST_IP,
            port=RETRIEVER_SERVICE_PORT,
            endpoint="/v1/retrieval",
            use_remote_service=True,
            service_type=ServiceType.RETRIEVER,
        )

        rerank = MicroService(
            name="rerank",
            host=RERANK_SERVER_HOST_IP,
            port=RERANK_SERVER_PORT,
            endpoint="/rerank",
            use_remote_service=True,
            service_type=ServiceType.RERANK,
        )

        llm = MicroService(
            name="llm",
            host=LLM_SERVER_HOST_IP,
            port=LLM_SERVER_PORT,
            api_key=OPENAI_API_KEY,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.LLM,
        )
        self.megaservice.add(embedding).add(retriever).add(rerank).add(llm)
        self.megaservice.flow_to(embedding, retriever)
        self.megaservice.flow_to(retriever, rerank)
        self.megaservice.flow_to(rerank, llm)

    def add_remote_service_without_rerank(self):

        embedding = MicroService(
            name="embedding",
            host=EMBEDDING_SERVER_HOST_IP,
            port=EMBEDDING_SERVER_PORT,
            endpoint="/embed",
            use_remote_service=True,
            service_type=ServiceType.EMBEDDING,
        )

        retriever = MicroService(
            name="retriever",
            host=RETRIEVER_SERVICE_HOST_IP,
            port=RETRIEVER_SERVICE_PORT,
            endpoint="/v1/retrieval",
            use_remote_service=True,
            service_type=ServiceType.RETRIEVER,
        )

        llm = MicroService(
            name="llm",
            host=LLM_SERVER_HOST_IP,
            port=LLM_SERVER_PORT,
            api_key=OPENAI_API_KEY,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.LLM,
        )
        self.megaservice.add(embedding).add(retriever).add(llm)
        self.megaservice.flow_to(embedding, retriever)
        self.megaservice.flow_to(retriever, llm)

    def add_remote_service_with_guardrails(self):
        guardrail_in = MicroService(
            name="guardrail_in",
            host=GUARDRAIL_SERVICE_HOST_IP,
            port=GUARDRAIL_SERVICE_PORT,
            endpoint="/v1/guardrails",
            use_remote_service=True,
            service_type=ServiceType.GUARDRAIL,
        )
        embedding = MicroService(
            name="embedding",
            host=EMBEDDING_SERVER_HOST_IP,
            port=EMBEDDING_SERVER_PORT,
            endpoint="/embed",
            use_remote_service=True,
            service_type=ServiceType.EMBEDDING,
        )
        retriever = MicroService(
            name="retriever",
            host=RETRIEVER_SERVICE_HOST_IP,
            port=RETRIEVER_SERVICE_PORT,
            endpoint="/v1/retrieval",
            use_remote_service=True,
            service_type=ServiceType.RETRIEVER,
        )
        rerank = MicroService(
            name="rerank",
            host=RERANK_SERVER_HOST_IP,
            port=RERANK_SERVER_PORT,
            endpoint="/rerank",
            use_remote_service=True,
            service_type=ServiceType.RERANK,
        )
        llm = MicroService(
            name="llm",
            host=LLM_SERVER_HOST_IP,
            port=LLM_SERVER_PORT,
            api_key=OPENAI_API_KEY,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.LLM,
        )
        # guardrail_out = MicroService(
        #     name="guardrail_out",
        #     host=GUARDRAIL_SERVICE_HOST_IP,
        #     port=GUARDRAIL_SERVICE_PORT,
        #     endpoint="/v1/guardrails",
        #     use_remote_service=True,
        #     service_type=ServiceType.GUARDRAIL,
        # )
        # self.megaservice.add(guardrail_in).add(embedding).add(retriever).add(rerank).add(llm).add(guardrail_out)
        self.megaservice.add(guardrail_in).add(embedding).add(retriever).add(rerank).add(llm)
        self.megaservice.flow_to(guardrail_in, embedding)
        self.megaservice.flow_to(embedding, retriever)
        self.megaservice.flow_to(retriever, rerank)
        self.megaservice.flow_to(rerank, llm)
        # self.megaservice.flow_to(llm, guardrail_out)

    def add_remote_service_faqgen(self):

        embedding = MicroService(
            name="embedding",
            host=EMBEDDING_SERVER_HOST_IP,
            port=EMBEDDING_SERVER_PORT,
            endpoint="/embed",
            use_remote_service=True,
            service_type=ServiceType.EMBEDDING,
        )

        retriever = MicroService(
            name="retriever",
            host=RETRIEVER_SERVICE_HOST_IP,
            port=RETRIEVER_SERVICE_PORT,
            endpoint="/v1/retrieval",
            use_remote_service=True,
            service_type=ServiceType.RETRIEVER,
        )

        rerank = MicroService(
            name="rerank",
            host=RERANK_SERVER_HOST_IP,
            port=RERANK_SERVER_PORT,
            endpoint="/rerank",
            use_remote_service=True,
            service_type=ServiceType.RERANK,
        )

        llm = MicroService(
            name="llm",
            host=LLM_SERVER_HOST_IP,
            port=LLM_SERVER_PORT,
            endpoint="/v1/faqgen",
            use_remote_service=True,
            service_type=ServiceType.LLM,
        )
        self.megaservice.add(embedding).add(retriever).add(rerank).add(llm)
        self.megaservice.flow_to(embedding, retriever)
        self.megaservice.flow_to(retriever, rerank)
        self.megaservice.flow_to(rerank, llm)

    # def add_remote_service_genie_ai(self):

    #     embedding = MicroService(
    #         name="embedding",
    #         host=EMBEDDING_SERVER_HOST_IP,
    #         port=EMBEDDING_SERVER_PORT,
    #         endpoint="/embed",
    #         use_remote_service=True,
    #         service_type=ServiceType.EMBEDDING,
    #     )

    #     retriever = MicroService(
    #         name="retriever",
    #         host=RETRIEVER_SERVICE_HOST_IP,
    #         port=RETRIEVER_SERVICE_PORT,
    #         endpoint="/v1/retrieval",
    #         use_remote_service=True,
    #         service_type=ServiceType.RETRIEVER,
    #     )

    #     rerank = MicroService(
    #         name="rerank",
    #         host=RERANK_SERVER_HOST_IP,
    #         port=RERANK_SERVER_PORT,
    #         endpoint="v1/reranking",
    #         use_remote_service=True,
    #         service_type=ServiceType.RERANK,
    #     )

    #     llm = MicroService(
    #         name="llm",
    #         host=LLM_SERVER_HOST_IP,
    #         port=LLM_SERVER_PORT,
    #         api_key=OPENAI_API_KEY,
    #         endpoint="/v1/chat/completions",
    #         use_remote_service=True,
    #         service_type=ServiceType.LLM,
    #     )

    #     guardrail = MicroService(
    #         name="guardrail",
    #         host=GUARDRAIL_SERVICE_HOST_IP,
    #         port=GUARDRAIL_SERVICE_PORT,
    #         endpoint="/v1/guardrails",
    #         use_remote_service=True,
    #         service_type=ServiceType.GUARDRAIL,
    #     )

    #     translation = MicroService(
    #         name="translation",
    #         host=TRANSLATION_SERVICE_HOST_IP,
    #         port=TRANSLATION_SERVICE_PORT,
    #         endpoint="v1/chat/completions",
    #         use_remote_service=True,
    #         service_type=ServiceType.TRANSLATION,
    #     )

    #     self.megaservice.add(embedding).add(retriever).add(llm).add(guardrail).add(translation)
    #     self.megaservice.flow_to(translation, guardrail)
    #     self.megaservice.flow_to(guardrail, embedding)
    #     self.megaservice.flow_to(embedding, retriever)
    #     self.megaservice.flow_to(retriever, rerank)
    #     self.megaservice.flow_to(rerank, llm)
    #     self.megaservice.flow_to(llm, guardrail)
    #     self.megaservice.flow_to(guardrail, translation)

    def add_remote_service_with_translation(self):
        """
        Builds the full RAG pipeline wrapped with input and output translation.
        Flow: translator_in -> embedding -> retriever -> rerank -> llm -> translator_out
        """
        translator_in = MicroService(
            name="translator_in",
            host=TRANSLATION_SERVICE_HOST_IP,
            port=TRANSLATION_SERVICE_PORT,
            api_key=OPENAI_API_KEY,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.TRANSLATOR,
        )

        translator_out = MicroService(
            name="translator_out",
            host=TRANSLATION_SERVICE_HOST_IP,
            port=TRANSLATION_SERVICE_PORT,
            api_key = OPENAI_API_KEY,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.TRANSLATOR,
        )

        embedding = MicroService(
            name="embedding",
            host=EMBEDDING_SERVER_HOST_IP,
            port=EMBEDDING_SERVER_PORT,
            endpoint="/embed",
            use_remote_service=True,
            service_type=ServiceType.EMBEDDING,
        )

        retriever = MicroService(
            name="retriever",
            host=RETRIEVER_SERVICE_HOST_IP,
            port=RETRIEVER_SERVICE_PORT,
            endpoint="/v1/retrieval",
            use_remote_service=True,
            service_type=ServiceType.RETRIEVER,
        )

        rerank = MicroService(
            name="rerank",
            host=RERANK_SERVER_HOST_IP,
            port=RERANK_SERVER_PORT,
            endpoint="/rerank",
            use_remote_service=True,
            service_type=ServiceType.RERANK,
        )

        llm = MicroService(
            name="llm",
            host=LLM_SERVER_HOST_IP,
            port=LLM_SERVER_PORT,
            api_key=OPENAI_API_KEY,
            endpoint="/v1/chat/completions",
            use_remote_service=True,
            service_type=ServiceType.LLM,
        )

        self.megaservice.add(translator_in).add(embedding).add(retriever).add(rerank).add(llm).add(translator_out)
        self.megaservice.flow_to(translator_in, embedding)
        self.megaservice.flow_to(embedding, retriever)
        self.megaservice.flow_to(retriever, rerank)
        self.megaservice.flow_to(rerank, llm)
        self.megaservice.flow_to(llm, translator_out)

    async def handle_request(self, request: Request):
        data = await request.json()
        chat_request = ChatCompletionRequest.parse_obj(data)

        ### GENIE.AI #################################################################################################################
        stream_opt = chat_request.stream if chat_request.stream is not None else False # Default to false if not present

        # 1. EXTRACT THE DIFFERENT PIECES OF DATA FROM THE REQUEST
        full_chat_history = chat_request.messages
        prompt = ""

        # Get the content of the last message from the 'user' for the embedding service.
        if full_chat_history and isinstance(full_chat_history, list) and full_chat_history[-1].get("role") == "user":
            prompt = full_chat_history[-1].get("content", "")
        else:
            logger.info("Chat history is empty or does not end with a user message.")
            prompt = handle_message(full_chat_history) # As a fallback, using the original behavior which flattens the whole history.

        # Extract the retrieval context if it is provided in the request.
        # Set to empty dict as a default if it is missing.
        retrieval_context = {}
        if chat_request.context:
            try:
                # If Pydantic is v2+ Not sure if this is the case for OPEA
                retrieval_context = chat_request.context.model_dump(exclude_unset=True)
            except:
                # Backup - can be removed later
                logger.info(".model_dump method not supported")
                retrieval_context = chat_request.context.dict(exclude_unset=True)

        ### 20/08/25 ##################################################################################################################


        parameters = LLMParams(
            max_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            frequency_penalty=chat_request.frequency_penalty if chat_request.frequency_penalty else 0.0,
            presence_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 0.0,
            repetition_penalty=chat_request.repetition_penalty if chat_request.repetition_penalty else 1.03,
            stream=stream_opt,
            chat_template=chat_request.chat_template if chat_request.chat_template else None,
            model=chat_request.model if chat_request.model else None,
        )
        retriever_parameters = RetrieverParms(
            search_type=chat_request.search_type if chat_request.search_type else "similarity",
            k=chat_request.k if chat_request.k else 4,
            distance_threshold=chat_request.distance_threshold if chat_request.distance_threshold else None,
            fetch_k=chat_request.fetch_k if chat_request.fetch_k else 20,
            lambda_mult=chat_request.lambda_mult if chat_request.lambda_mult else 0.5,
            score_threshold=chat_request.score_threshold if chat_request.score_threshold else 0.2,
        )
        reranker_parameters = RerankerParms(
            top_n=chat_request.top_n if chat_request.top_n else 1,
        )


        ### GENIE.AI #################################################################################################################
        # 2. UPDATE THE SCHEDULE CALL TO PASS THE NEW DATA
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"text": prompt},
            llm_parameters=parameters,
            retriever_parameters=retriever_parameters,
            reranker_parameters=reranker_parameters,
            # New separated data params for the alignment functions.
            full_chat_history=full_chat_history,
            retrieval_context=retrieval_context,
            original_language=chat_request.language,
            )
        ### 20/08/25 ##################################################################################################################

        for node, response in result_dict.items():
            if isinstance(response, StreamingResponse):
                return response

        last_node = runtime_graph.all_leaves()[-1]
        response = result_dict[last_node]["text"]
        choices = []
        usage = UsageInfo()
        choices.append(
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=response),
                finish_reason="stop",
            )
        )
        return ChatCompletionResponse(model="chatqna", choices=choices, usage=usage)

    def start(self):

        self.service = MicroService(
            self.__class__.__name__,
            service_role=ServiceRoleType.MEGASERVICE,
            host=self.host,
            port=self.port,
            endpoint=self.endpoint,
            input_datatype=ChatCompletionRequest,
            output_datatype=ChatCompletionResponse,
        )

        self.service.add_route(self.endpoint, self.handle_request, methods=["POST"])

        self.service.start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--without-rerank", action="store_true")
    parser.add_argument("--with-guardrails", action="store_true")
    parser.add_argument("--faqgen", action="store_true")
    parser.add_argument("--genie-ai", action="store_true", help="For Genie AI prototype")
    parser.add_argument("--with-translation", action="store_true") # <-- ADD THIS
    args = parser.parse_args()

    chatqna = ChatQnAService(port=MEGA_SERVICE_PORT)
    if args.without_rerank:
        chatqna.add_remote_service_without_rerank()
    elif args.with_guardrails:
        chatqna.add_remote_service_with_guardrails()
    elif args.faqgen:
        chatqna.add_remote_service_faqgen()
    elif args.genie_ai:
        chatqna.add_remote_service_genie_ai()
    elif args.with_translation: 
        chatqna.add_remote_service_with_translation()
    else:
        chatqna.add_remote_service()

    chatqna.start()
