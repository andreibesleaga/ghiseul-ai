# Copyright (C) 2024 Intel Corporation
# Copyright (C) 2025 International Telecommunication Union (ITU)
# SPDX-License-Identifier: Apache-2.0
# Developed by Intel. Adapted by ITU

import argparse
import httpx
import json
import os
import re
import aiohttp # for async http requests
import requests

from comps import MegaServiceEndpoint, MicroService, ServiceOrchestrator, ServiceRoleType, ServiceType, CustomLogger
from comps.cores.mega.utils import handle_message
from comps.cores.proto.genieai_api_protocol import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatMessage,
    UsageInfo,
    RequestContext,
)

from comps.cores.proto.docarray import LLMParams, RerankerParms, RetrieverParms
from fastapi import Request
from fastapi.responses import StreamingResponse
from langchain_core.prompts import PromptTemplate

from langdetect import detect
from transformers import AutoTokenizer


logger = CustomLogger("GENIE.AI_CHATQNA")
logflag = os.getenv("LOGFLAG", False)


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
TRANSLATION_SERVICE_HOST_IP = os.getenv("TRANSLATION_SERVICE_HOST_IP", "0.0.0.0") 
TRANSLATION_SERVICE_PORT = int(os.getenv("TRANSLATION_SERVICE_PORT", 80)) 
EMBEDDING_SERVER_HOST_IP = os.getenv("EMBEDDING_SERVER_HOST_IP", "0.0.0.0")
EMBEDDING_SERVER_PORT = int(os.getenv("EMBEDDING_SERVER_PORT", 80))
RETRIEVER_SERVICE_HOST_IP = os.getenv("RETRIEVER_SERVICE_HOST_IP", "0.0.0.0")
RETRIEVER_SERVICE_PORT = int(os.getenv("RETRIEVER_SERVICE_PORT", 7025))
RERANK_SERVER_HOST_IP = os.getenv("RERANK_SERVER_HOST_IP", "0.0.0.0")
RERANK_SERVER_PORT = int(os.getenv("RERANK_SERVER_PORT", 80))
LLM_SERVER_HOST_IP = os.getenv("LLM_SERVER_HOST_IP", "0.0.0.0")
LLM_SERVER_PORT = int(os.getenv("LLM_SERVER_PORT", 80))
LLM_MODEL = os.getenv("LLM_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
LLM_TRANS_MODEL = os.getenv("LLM_TRANS_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", None)

RETRIEVER_SEARCH_START = os.getenv("RETRIEVER_ARANGO_SEARCH_START", "")  # node | edge | chunk

DOC_REPO_URL = os.getenv("DOC_REPO_URL", "http://localhost:3001") # Document repository URL
GET_AUTH_TOKEN_URL = os.getenv("GET_AUTH_TOKEN_URL", "http://http-service:6666/get-token")
LANGUAGE_CODES_FILEPATH = os.getenv("LANGUAGE_CODES_FILEPATH", "language_codes.json")
MAX_MODEL_LEN_TEXTGEN = int(os.getenv("MAX_MODEL_LEN_TEXTGEN", 4096))  # max token length for text generation models

MAX_TRANSLATION_CHARS = int(os.getenv("MAX_TRANSLATION_CHARS", 2000))  # max characters for translation models




def align_inputs(self, inputs, cur_node, runtime_graph, llm_parameters_dict, **kwargs):

    if self.services[cur_node].service_type == ServiceType.TRANSLATOR:
        original_text = inputs["text"]
        original_language = kwargs.get("original_language", "auto")

        if original_language and original_language.strip().upper() == "EN":
            target_language = "English"
        else:
            target_language = original_language

        prompt = f"Translate the following text to {target_language}. Only provide the translation, with no additional commentary or explanations. Text: \"{original_text}\""

        # Format the request for the LLM service
        next_inputs = {}
        next_inputs["messages"] = [{"role": "user", "content": prompt}]
        next_inputs["temperature"] = 0 # Use low temperature for deterministic translation
        next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
        next_inputs["stream"] = False

        if logflag:
            logger.debug(f"Aligned input to the translator: {next_inputs}")
        
        return next_inputs


    elif self.services[cur_node].service_type == ServiceType.EMBEDDING:
        inputs["inputs"] = inputs["text"]
        del inputs["text"]


    elif self.services[cur_node].service_type == ServiceType.RETRIEVER:
        retriever_parameters = kwargs.get("retriever_parameters", None)
        if retriever_parameters:
            inputs.update(retriever_parameters.dict())

        retrieval_context = kwargs.get('retrieval_context', {})
        if retrieval_context:
            inputs['context'] = retrieval_context
    
    elif self.services[cur_node].service_type == ServiceType.RERANK:
        if logflag:
            logger.debug(f"Aligned input of the reranker: {inputs}")


    elif self.services[cur_node].service_type == ServiceType.LLM:
        # convert TGI/vLLM to unified OpenAI /v1/chat/completions format
        next_inputs = {}
        next_inputs["model"] = LLM_MODEL

        rag_augmented_prompt = inputs["inputs"]
        # Get the full translated history *string* from kwargs
        translated_history_string = kwargs.get("full_chat_history_string", "")
        
        ##################################
        ###### Token limit handling ######
        ##################################
        prompt_prefix = "Here is the conversation history so far:\n        ---\n"
        prompt_suffix = "\n        ---\n        Now, using the provided search results, please answer the user's latest question.\n        "
        final_llm_prompt = f"""{prompt_prefix}{translated_history_string}{prompt_suffix}{rag_augmented_prompt}"""
        tokenizer = AutoTokenizer.from_pretrained(LLM_MODEL, use_fast=True)
        max_model_tokens = MAX_MODEL_LEN_TEXTGEN
        max_answer_tokens = llm_parameters_dict["max_tokens"]  # Typically 1024
        # Count tokens in prompt
        prompt_tokens = len(tokenizer.encode(final_llm_prompt))
        # Check if the total token count exceeds the model's limit
        if prompt_tokens + max_answer_tokens > max_model_tokens - 200:  # Leave buffer
            # Calculate maximum tokens for history
            prompt_prefix_tokens = len(tokenizer.encode(prompt_prefix))
            prompt_suffix_tokens = len(tokenizer.encode(prompt_suffix + rag_augmented_prompt))
            max_history_tokens = max_model_tokens - max_answer_tokens - prompt_prefix_tokens - prompt_suffix_tokens - 200
            # Split the history into segments
            history_segments = translated_history_string.split(" |<-MSG->| ")
            truncated_history = []
            current_tokens = 0
            # Start from most recent messages
            for segment in reversed(history_segments):
                segment_tokens = len(tokenizer.encode(segment))
                if current_tokens + segment_tokens > max_history_tokens:
                    break
                truncated_history.insert(0, segment)  # Maintain order
                current_tokens += segment_tokens
            # Rebuild truncated history
            translated_history_string = " |<-MSG->| ".join(truncated_history)
            # Reconstruct final prompt
            final_llm_prompt = f"""{prompt_prefix}{translated_history_string}{prompt_suffix}{rag_augmented_prompt}"""
        

        next_inputs["messages"] = [{"role": "user", "content": final_llm_prompt}]
        next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
        next_inputs["top_p"] = llm_parameters_dict["top_p"]
        next_inputs["stream"] = inputs["stream"]
        next_inputs["frequency_penalty"] = inputs["frequency_penalty"]
        next_inputs["temperature"] = inputs["temperature"]
        inputs = next_inputs
        if logflag:
            logger.debug(f'Raw input of the llm\n {inputs}\n')

    return inputs


def align_outputs(self, data, cur_node, inputs, runtime_graph, llm_parameters_dict, **kwargs):
    next_data = {}

    if self.services[cur_node].service_type == ServiceType.TRANSLATOR:
        if logflag:
            logger.debug(f'Raw output of the translator\n {data}\n')
        translated_text = data["choices"][0]["message"]["content"]
        
        # Clean up potential LLM conversational artifacts
        translated_text = translated_text.strip().strip('"')

        return {"text": translated_text}

    if self.services[cur_node].service_type == ServiceType.EMBEDDING:
        if logflag:
            logger.debug(f'Raw output of the embedding\n {data}\n')
        assert isinstance(data, list)
        next_data = {"text": inputs["inputs"], "embedding": data[0]}

    elif self.services[cur_node].service_type == ServiceType.RETRIEVER:
        if logflag:
            logger.debug(f'Raw output of the retriever\n {data}\n')
        retrieved_docs = data.get("retrieved_docs", [])
        doc_texts = [doc["text"] for doc in retrieved_docs]
        
        # file_id pairs with retrieved doc id (generated by orchestrator)
        file_id_pairs = {}
        # Get the file ids (all ids in the metadata)
        file_id_list = []

        for item in data.get('metadata', []):
            if 'file_ids' in item:
                file_id_list.extend(item['file_ids'])

        if len(data.get('metadata')) > 0:
            if RETRIEVER_SEARCH_START == 'node' or RETRIEVER_SEARCH_START == 'edge':
                # Make sure the len(file_list_list) == the number of retrieved chunks that contains 'RELATED INFORMATION'
                related_info_count = sum(1 for doc in retrieved_docs if '\n------\nRELATED INFORMATION:\n------\n' in doc['text'])
                assert len(file_id_list) == related_info_count, f"Length of file_id_list {len(file_id_list)} is not equal to related_info_count {related_info_count}"
                for retrieved_doc in retrieved_docs:
                    doc_id = retrieved_doc['id']
                    doc_text = retrieved_doc['text']
                    if '\n------\nRELATED INFORMATION:\n------\n' in doc_text:
                        file_id_pairs[doc_id] = file_id_list.pop(0) if len(file_id_list) > 0 else ''
                    else:
                        file_id_pairs[doc_id] = ''
            elif RETRIEVER_SEARCH_START == 'chunk':
                # Make sure the len(file_list_list) == the number of retrieved chunks
                assert len(file_id_list) == len(retrieved_docs), f"Length of file_id_list {len(file_id_list)} is not equal to length of retrieved_docs {len(retrieved_docs)}"
                for retrieved_doc in retrieved_docs:
                    doc_id = retrieved_doc['id']
                    file_id_pairs[doc_id] = file_id_list.pop(0) if len(file_id_list) > 0 else ''
            else:
                logger.error(f"RETRIEVER_SEARCH_START is not set correctly: {RETRIEVER_SEARCH_START}. It should be one of 'node', 'edge', or 'chunk'.")

        if logflag:
            logger.debug(f'File ID Pairs: {file_id_pairs}')
      

        with_rerank = runtime_graph.downstream(cur_node)[0].startswith("rerank")
        if with_rerank and retrieved_docs:
            # forward to rerank
            # prepare inputs for rerank
            next_data["query"] = data["initial_query"]
            next_data["documents"] = retrieved_docs
            next_data["texts"] = doc_texts
            next_data["file_id_pairs"] = file_id_pairs
        else:
            # forward to llm
            if not retrieved_docs and with_rerank:
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
                    if logflag:
                        logger.debug(f"{prompt_template} not used, we only support 2 input variables ['question', 'context']")
                    prompt = ChatTemplate.generate_rag_prompt(data["initial_query"], docs)
            else:
                prompt = ChatTemplate.generate_rag_prompt(data["initial_query"], doc_texts)

            next_data["inputs"] = prompt
        
        next_data["retrieved_docs"] = retrieved_docs

    elif self.services[cur_node].service_type == ServiceType.RERANK:
        # rerank the inputs with the scores
        reranker_parameters = kwargs.get("reranker_parameters", None)
        top_n = reranker_parameters.top_n if reranker_parameters else 1
        original_docs = inputs["documents"]
        rerank_scores = data
        if logflag:
            logger.debug(f"\nTHESE ARE THE RERANK SCORES: {rerank_scores}")

        reranked_docs_with_scores = []
        for best_response in rerank_scores[:top_n]:
            doc_index = best_response['index']
            new_score = best_response['score']

            reranked_doc = original_docs[doc_index]
            reranked_doc["score"] = new_score
            reranked_docs_with_scores.append(reranked_doc)
        
        next_data["retrieved_docs"] = reranked_docs_with_scores

        # handle template
        # if user provides template, then format the prompt with it
        # otherwise, use the default template
        reranked_doc_texts = [doc["text"] for doc in reranked_docs_with_scores]
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
                logger.info(f"{prompt_template} not used, we only support 2 input variables ['question', 'context']")
                prompt = ChatTemplate.generate_rag_prompt(prompt, reranked_doc_texts)
        else:
            prompt = ChatTemplate.generate_rag_prompt(prompt, reranked_doc_texts)

        next_data["inputs"] = prompt

    elif self.services[cur_node].service_type == ServiceType.LLM and not llm_parameters_dict["stream"]:
        if "faqgen" in self.services[cur_node].endpoint:
            next_data = data
        else:
            if logflag:
                logger.debug(f'\nRaw output of the llm\n {data}\n')
            next_data["text"] = data["choices"][0]["message"]["content"]
        if logflag:
            logger.debug(f'\nAligned output of the llm\n {next_data}\n')
    else:
        next_data = data

    return next_data


def align_generator(self, gen, **kwargs):
    # OpenAI response format
    # data:{"id":"","object":"text_completion","created":1725530204,"model":"meta-llama/Meta-Llama-3-8B-Instruct","system_fingerprint":"2.0.1-native","choices":[{"index":0,"delta":{"role":"assistant","content":"?"},"logprobs":null,"finish_reason":null}]}\n\n'
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


    def _find_node_key(self, service_name: str, result_dict: dict) -> str | None:
        """Helper to find the full key for a service in the result_dict."""
        for key in result_dict.keys():
            if key.startswith(service_name):
                return key
        return None
    

    async def get_auth_token(self):
        """Get admin auth token"""
        response = requests.get(GET_AUTH_TOKEN_URL)
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("accessToken")
            if access_token:
                return access_token
            else:
                logger.error("Failed to retrieve access token")
        else:
            logger.error(f"Failed to call /get-token. Status code: {response.status_code}")


    async def fetch_file_metadata(self, file_id: str) -> dict:
        """
        Fetch metadata for a file by calling the relevant API.

        Args:
            file_id (str): The ID of the file to fetch metadata for.

        Returns:
            dict: A dictionary containing metadata, including labels.
        """
        if not file_id:
            return {"categoryLabel": None, "serviceLabels": []}

        auth_token = await self.get_auth_token()
        if not auth_token:
            logger.error("Failed to get admin auth token.")
            return ""

        file_get_metadata_url = f"{DOC_REPO_URL}/api/files/{file_id}"
        headers = {"Authorization": f"Bearer {auth_token}"}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(file_get_metadata_url, headers=headers) as response:
                    if response.status == 200:
                        file_metadata = await response.json()
                        if logflag:
                            logger.debug(f"Fetched metadata for file ID {file_id}: {file_metadata}")
                        if file_metadata['success']:
                            return file_metadata['data']
                        else:
                            logger.error(f"Failed to fetch metadata for file ID {file_id}. Response indicates failure.")
                    else:
                        logger.error(f"Failed to fetch metadata for file ID {file_id}. HTTP Status: {response.status}")
        except Exception as e:
            logger.error(f"An error occurred while fetching metadata for file ID {file_id}: {e}")

        return []


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

    def add_remote_service_without_translation(self):
        """
        Builds the full RAG pipeline wrapped with input and output translation.
        Flow: translator_in -> embedding -> retriever -> rerank -> llm -> translator_out
        """

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

    async def _get_translated_history_string(self, history: list, target_language: str) -> str:
        """
        A helper that:
        1. Truncates history to stay within a token limit.
        2. Flattens the history into a single string.
        3. Sends the string to the translation LLM.
        """
        
        max_translation_chars = MAX_TRANSLATION_CHARS
        current_chars = 0
        messages_to_process = []
        if logflag:
            logger.debug(f'Processing translation for history with {len(history)} messages.')

        for message in reversed(history):
            if logflag:
                logger.debug(f'Examining message: {message}')
            message_chars = len(message["content"])
            if current_chars + message_chars > max_translation_chars:
                break
            messages_to_process.append(message)
            current_chars += message_chars
        messages_to_process.reverse()

        
        flattened_history_parts = []
        for message in messages_to_process:
            role = message.get("role", "unknown").upper()
            content = message.get("content", "")
            flattened_history_parts.append(f"{role}: {content}")
        
        flattened_history_string = " |<-MSG->| ".join(flattened_history_parts)

        # --- Simple Translation API Call ---
        prompt = f"Translate the following chat history to {target_language}. Preserve the role markers (e.g., 'USER:', 'ASSISTANT:').\n\nHISTORY:\n{flattened_history_string}"

        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "stream": False
        }

        if logflag:
            logger.debug(f"Payload for translation service: {payload}")

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"http://{TRANSLATION_SERVICE_HOST_IP}:{TRANSLATION_SERVICE_PORT}/v1/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}
                )
                response.raise_for_status()
                response_data = response.json()
                translated_blob = response_data["choices"][0]["message"]["content"]
                if logflag:
                    logger.debug(f"Translated chat history: {translated_blob.strip()}")
                return translated_blob.strip()

        except Exception as e:
            logger.error(f"Translation error: {e}")
            return flattened_history_string


    def load_language_codes(self, filepath: str) -> dict:
        """Load language codes from a JSON file."""
        try:
            with open(filepath, 'r') as file:
                language_codes = json.load(file)
            return language_codes
        except Exception as e:
            logger.error(f"Error loading language codes from {filepath}: {e}")
            return {}

    async def handle_request(self, request: Request):
        data = await request.json()
        chat_request = ChatCompletionRequest.parse_obj(data)

        if logflag:
            logger.debug(f'Incoming Chat Request: {chat_request}')
        full_chat_history = chat_request.messages
        original_language = chat_request.context.language if chat_request.context else None
        
        # Alternative language detection using langdetect (however, seems to be less reliable in tests)
        # try:
        #     last_query = full_chat_history[-1].get("content", "") if full_chat_history else ""
        #     detected_language = detect(last_query) if last_query else ""
        #     if len(detected_language) >0 and detected_language != original_language.lower():
        #         original_language = detected_language.upper()
        #         logger.info(f"Detected language: {original_language}")
        # except Exception as e:
        #     logger.error(f"Language detection failed: {e}")
        #     original_language = original_language  # Default to English if detection fails

        translated_history_string = ""
        if original_language and original_language.strip() != "EN":
            if logflag:
                logger.debug(f"Original language detected: {original_language}. Proceeding with translation of chat history.")
            translated_history_string = await self._get_translated_history_string(full_chat_history, "English")
        else:
            # If already English, flatten without translation
            parts = [f"{msg.get('role', '').upper()}: {msg.get('content', '')}" for msg in full_chat_history]
            translated_history_string = " |<-MSG->| ".join(parts)

        if logflag:
            logger.debug(f'Translated History String: {translated_history_string}')

        # RegEx-based extraction for last user message in the array
        last_translated_message_content = ""
        user_messages = re.findall(r"USER:\s*(.*?)(?:\s*\|<-MSG->\||$)", translated_history_string, re.DOTALL)
        if user_messages:
            last_translated_message_content = user_messages[-1].strip()

        # If regex fails for some reason, we have a simple fallback
        if not last_translated_message_content:
            # Fallback to just using the whole blob (less accurate for retrieval but safe)
            last_translated_message_content = translated_history_string

        if logflag:
            logger.debug(f'Last_translated_message_content: {last_translated_message_content}')

        # Extract the retrieval context if it is provided in the request.
        # Set to empty dict as a default if it is missing.
        retrieval_context = {}
        if chat_request.context:
            try:
                # If Pydantic is v2+
                retrieval_context = chat_request.context.model_dump(exclude_unset=True)
            except:
                # Backup - can be removed later
                logger.warning(".model_dump method not supported")
                retrieval_context = chat_request.context.dict(exclude_unset=True)
        if logflag:
            logger.debug(f'Retrieval Context: {retrieval_context}')

        # Override protocol's default max_tokens=1024 with our env var for 6GB GPU
        max_tokens_to_use = int(os.getenv("CHATQNA_MAX_TOKENS", "512"))
        if chat_request.max_tokens and chat_request.max_tokens != 1024:
            # Client explicitly set a non-default value
            max_tokens_to_use = chat_request.max_tokens
        
        parameters = LLMParams(
            max_tokens=max_tokens_to_use,
            top_k=chat_request.top_k if chat_request.top_k else 10,
            top_p=chat_request.top_p if chat_request.top_p else 0.95,
            temperature=chat_request.temperature if chat_request.temperature else 0.01,
            frequency_penalty=chat_request.frequency_penalty if chat_request.frequency_penalty else 0.0,
            presence_penalty=chat_request.presence_penalty if chat_request.presence_penalty else 0.0,
            repetition_penalty=chat_request.repetition_penalty if chat_request.repetition_penalty else 1.03,
            stream=chat_request.stream if chat_request.stream else False,
            chat_template=chat_request.chat_template if chat_request.chat_template else None,
            model=chat_request.model if chat_request.model else None,
        )
        retriever_parameters = RetrieverParms(
            search_type=chat_request.search_type if chat_request.search_type else "similarity_score_threshold",
            k=chat_request.k if chat_request.k else 4,
            distance_threshold=chat_request.distance_threshold if chat_request.distance_threshold else None,
            fetch_k=chat_request.fetch_k if chat_request.fetch_k else 20,
            lambda_mult=chat_request.lambda_mult if chat_request.lambda_mult else 0.5,
            score_threshold=chat_request.score_threshold if chat_request.score_threshold else 0.01,
        )
        reranker_parameters = RerankerParms(
            top_n=chat_request.top_n if chat_request.top_n else 1,
        )

        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"text": last_translated_message_content},
            llm_parameters=parameters,
            retriever_parameters=retriever_parameters,
            reranker_parameters=reranker_parameters,
            full_chat_history_string=translated_history_string,
            retrieval_context=retrieval_context,
            original_language=original_language,
        )

        if logflag:
            logger.debug(f'\nResult Dict: {result_dict}')
            logger.debug(f'\nRuntime Graph: {runtime_graph}')

        for node, response in result_dict.items():
            if isinstance(response, StreamingResponse):
                return response
        
        llm_response = result_dict.get(self._find_node_key("llm", result_dict), {}).get("text", "Sorry, I could not generate a response.")
        
        if original_language and original_language.strip() != "EN":
            # Load Language Codes
            language_codes = self.load_language_codes(LANGUAGE_CODES_FILEPATH)
            if original_language.lower() not in language_codes:
                logger.warning(f"Warning: Language '{original_language}' not found in language codes. Defaulting to 'English' and omit translation")
            else:
                original_language = language_codes[original_language.lower()]
                if logflag:
                    logger.debug(f"LLM reponse translated into: {original_language}")
            
                prompt = f"Translate the following text to {original_language}. Please only output the translated text. No additional commentary.\n\nTEXT: {llm_response} \n\nTRANSLATION: "
                if logflag:
                    logger.debug(f'Prompt for translating the output: {prompt}')

                payload = {
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "stream": False 
                }

                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(
                            f"http://{TRANSLATION_SERVICE_HOST_IP}:{TRANSLATION_SERVICE_PORT}/v1/chat/completions",
                            json=payload,
                            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}
                        )
                        response.raise_for_status()
                        response_data = response.json()
                        translated_blob = response_data["choices"][0]["message"]["content"]
                        final_text_response = translated_blob.strip()

                except Exception as e:
                    logger.error(f"An error occurred during history translation: {e}")
                    final_text_response = llm_response
        else:
            final_text_response = llm_response
        
        if logflag:
            logger.debug(f'\nFinal Text Response: {final_text_response}')

        rerank_key = self._find_node_key("rerank", result_dict)
        retriever_key = self._find_node_key("retriever", result_dict)
        
        source_node_key = rerank_key if rerank_key else retriever_key

        source_node_output = result_dict.get(source_node_key, {}) # reranker microservice output or retriever microservice output
        retrieved_docs_with_scores = source_node_output.get("retrieved_docs", []) # downstream_black_list, id, text, score

        retriever_node_output = result_dict.get(retriever_key, {})
        file_id_pairs = retriever_node_output.get("file_id_pairs", {})

        # Format the source documents list
        source_documents_formatted = []
        scores = []
        source_documents_file_ids = []

        for item in retrieved_docs_with_scores:
            doc_id_by_orchestrator = item.get("id", "N/A")
            if doc_id_by_orchestrator not in file_id_pairs:
                logger.warning(f"Warning: Document ID {doc_id_by_orchestrator} not found in file_id_pairs mapping.")
                continue
            else:
                file_id = file_id_pairs[doc_id_by_orchestrator]
                if not file_id:
                    logger.warning(f"Warning: No File ID mapped for Document ID {doc_id_by_orchestrator}.")
                    continue
                else:
                    if file_id in source_documents_file_ids:
                        logger.warning(f"Warning: Duplicate File ID {file_id} found. Skipping duplicate.")
                        continue
                    else:
                        logger.info(f"Document ID {doc_id_by_orchestrator} mapped to File ID {file_id}.")
                        source_documents_file_ids.append(file_id)

                        score = item.get("score", 0.0)
                        # Construct the file read URL (assuming a standard pattern)
                        file_read_url = f"https://<HOST>/<PORT>/api/files/{file_id}/viewbrowser" if file_id else ""

                        labels = []
                        file_name = ''
                        if file_id:
                            file_metadata = await self.fetch_file_metadata(file_id)
                            if isinstance(file_metadata, dict):
                                labels = file_metadata.get('labels', [])
                                file_name = file_metadata.get('file_name', '')
                                logger.info(f"Labels for file ID {file_id}: {labels}")
                                logger.info(f"File name for file ID {file_id}: {file_name}")
                                author = file_metadata.get('author', '')
                            else:
                                logger.warning(f"Invalid metadata for file ID {file_id}: {file_metadata}")
                                labels = []
                                file_name = ''
                                author = ''
                            if author == 'crawler' and file_name.endswith('.html'):
                                # If the author is 'crawler' and the file is an HTML, we can assume it's a web page
                                file_read_url = file_metadata['source_url'] if 'source_url' in file_metadata else file_read_url
                                logger.info(f"Updated file read URL for crawled HTML: {file_read_url}")

                        source_documents_formatted.append({
                            "document_id": file_id,
                            "document_name": file_name,
                            "url": file_read_url,
                            "text": item.get("text", ""),
                            "categoryLabel": labels, 
                            "serviceLabels": [], 
                            "score": score,
                            })

                        scores.append(score)

        # Calculate overall confidence score (e.g., average of top documents)
        confidence_score = sum(scores) / len(scores) if scores else 0.0

        # Construct the final JSON payload
        final_response_payload = {
            "response": final_text_response,
            "metadata": {
                "source_documents": source_documents_formatted,
                "confidence_score": round(confidence_score, 2),
                }
            }

        # Return as a JSONResponse
        if logflag:
            logger.debug(f'Megaservice output payload: {final_response_payload}')
        return final_response_payload

    def start(self):

        self.service = MicroService(
            self.__class__.__name__,
            service_role=ServiceRoleType.MEGASERVICE,
            host=self.host,
            port=self.port,
            endpoint=self.endpoint,
            input_datatype=ChatCompletionRequest,
        )

        self.service.add_route(self.endpoint, self.handle_request, methods=["POST"])

        self.service.start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--without-rerank", action="store_true")
    parser.add_argument("--faqgen", action="store_true")
    parser.add_argument("--without-translation", action="store_true") 
    args = parser.parse_args()

    chatqna = ChatQnAService(port=MEGA_SERVICE_PORT)
    if args.without_rerank:
        chatqna.add_remote_service_without_rerank()
    elif args.faqgen:
        chatqna.add_remote_service_faqgen()
    elif args.without_translation: 
        chatqna.add_remote_service_without_translation()
    else:
        chatqna.add_remote_service()

    chatqna.start()






