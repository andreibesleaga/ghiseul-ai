# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import argparse
import json
import os
import re

from comps import MegaServiceEndpoint, MicroService, ServiceOrchestrator, ServiceRoleType, ServiceType
from comps.cores.mega.utils import handle_message
from comps.cores.proto.api_protocol_genieai import (
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

print('🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽')
print('🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽')
print('🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽')

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
LLM_MODEL = os.getenv("LLM_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
LLM_TRANS_MODEL = os.getenv("LLM_TRANS_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", None)


def align_inputs(self, inputs, cur_node, runtime_graph, llm_parameters_dict, **kwargs):

    ### GENIE.AI ##########################################################################################################
    if self.services[cur_node].service_type == ServiceType.TRANSLATOR:
        
        # This logic handles the translator_out node
        original_text = inputs["text"]
        original_language = kwargs.get("original_language", "auto")

        if original_language and original_language.strip().upper() == "EN":
            target_language = "English"
        else:
            target_language = original_language

        # Simple prompt template for translation
        prompt = f"Translate the following text to {target_language}. Only provide the translation, with no additional commentary or explanations. Text: \"{original_text}\""

        # Format the request for the LLM service (similar to the LLM block)
        next_inputs = {}
        # next_inputs["model"] = LLM_TRANS_MODEL
        next_inputs["messages"] = [{"role": "user", "content": prompt}]
        next_inputs["temperature"] = 0 # Use low temperature for deterministic translation
        next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
        # Use a non-streaming call for the translation steps
        next_inputs["stream"] = False

        print(f"💠💠💠This is the aligned input of translator: {next_inputs}💠💠💠")
        
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
        retrieval_context = kwargs.get('retrieval_context', {})
        if retrieval_context:
            inputs['context'] = retrieval_context
            print(f'🐽🐽🐽 Here are the retriever inputs: {inputs} 🐽🐽🐽')
        ### 21/08/25 ######################################################################################################


    elif self.services[cur_node].service_type == ServiceType.LLM:
        # convert TGI/vLLM to unified OpenAI /v1/chat/completions format
        next_inputs = {}
        next_inputs["model"] = LLM_MODEL

        ### GENIE.AI ######################################################################################################
        # New logic for full chat history
        # `inputs["inputs"]` is the RAG-augmented prompt (Context + Last Question)
        rag_augmented_prompt = inputs["inputs"]
        # Get the full translated history *string* from kwargs
        translated_history_string = kwargs.get("full_chat_history_string", "")
        
        # We will now construct a single, comprehensive user message for the main LLM.
        # This is a very clear and effective prompting strategy.
        final_llm_prompt = f"""Here is the conversation history so far:
        ---
        {translated_history_string}
        ---
        Now, using the provided search results, please answer the user's latest question.
        {rag_augmented_prompt}
        """
        
        next_inputs["messages"] = [{"role": "user", "content": final_llm_prompt}]
        ### 21/08/25 ######################################################################################################

        next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
        next_inputs["top_p"] = llm_parameters_dict["top_p"]
        next_inputs["stream"] = inputs["stream"]
        next_inputs["frequency_penalty"] = inputs["frequency_penalty"]
        # next_inputs["presence_penalty"] = inputs["presence_penalty"]
        # next_inputs["repetition_penalty"] = inputs["repetition_penalty"]
        next_inputs["temperature"] = inputs["temperature"]
        inputs = next_inputs
        print(f'🏵️🏵️🏵️\nThis is the aligned input of the llm\n {inputs}\n🏵️🏵️🏵️')

    return inputs


def align_outputs(self, data, cur_node, inputs, runtime_graph, llm_parameters_dict, **kwargs):
    next_data = {}

    ### GENIE.AI ######################################################################################################
    if self.services[cur_node].service_type == ServiceType.TRANSLATOR:
        # The translator service (which is an LLM) returns an OpenAI-like response.
        # We need to extract the translated text from it.
        print(f'🤑🤑🤑 Translator Output Data: {data} 🤑🤑🤑')
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
        
        print(f'🐠🐠🐠 Retriever Output Data: {data} 🐠🐠🐠')
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
        print(f'🌼🌼🌼\nThis is the aligned output of the llm\n {next_data}\n🌼🌼🌼')
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


    def add_remote_service_with_translation(self):
        """
        Builds the full RAG pipeline wrapped with input and output translation.
        Flow: translator_in -> embedding -> retriever -> rerank -> llm -> translator_out
        """
        # translator_in = MicroService(
        #     name="translator_in",
        #     host=TRANSLATION_SERVICE_HOST_IP,
        #     port=TRANSLATION_SERVICE_PORT,
        #     api_key=OPENAI_API_KEY,
        #     endpoint="/v1/chat/completions",
        #     use_remote_service=True,
        #     service_type=ServiceType.TRANSLATOR,
        # )

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

        # self.megaservice.add(translator_in).add(embedding).add(retriever).add(rerank).add(llm).add(translator_out)
        self.megaservice.add(embedding).add(retriever).add(rerank).add(llm).add(translator_out)
        # self.megaservice.flow_to(translator_in, embedding)
        self.megaservice.flow_to(embedding, retriever)
        self.megaservice.flow_to(retriever, rerank)
        self.megaservice.flow_to(rerank, llm)
        self.megaservice.flow_to(llm, translator_out)

    ### GENIE.AI #################################################################################################################
    async def _get_translated_history_string(self, history: list, target_language: str) -> str:
        """
        A helper that:
        1. Truncates history to stay within a token limit.
        2. Flattens the history into a single string.
        3. Sends the string to the translation LLM.
        """
        
        MAX_TRANSLATION_CHARS = 2000 # need to turn this into a configurable parameter later on
        current_chars = 0
        messages_to_process = []
        #logger.info(f'Processing translation for history with {len(history)} messages.')
        print('🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽🐽')
        for message in reversed(history):
            #logger.info(f'Examining message: {message}')    
            print(f'Examining message: {message}')
            message_chars = len(message["content"])
            if current_chars + message_chars > MAX_TRANSLATION_CHARS:
                break
            messages_to_process.append(message)
            current_chars += message_chars
        messages_to_process.reverse()

        
        flattened_history_parts = []
        for message in messages_to_process:
            role = message.get("role", "unknown").upper()
            content = message.get("content", "")
            flattened_history_parts.append(f"{role}: {content}")
        
        # Using a unique separator to help with parsing later
        flattened_history_string = " |<-MSG->| ".join(flattened_history_parts)

        # --- 3. Simple Translation API Call ---
        # The prompt is now much simpler for the small LLM
        prompt = f"Translate the following chat history to {target_language}. Preserve the role markers (e.g., 'USER:', 'ASSISTANT:').\n\nHISTORY:\n{flattened_history_string}"

        payload = {
            "model":"google/gemma-3-1b-it", # Not sure this is required
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "stream": False # Not sure if this one should be false instead
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
                return translated_blob.strip()

        except Exception as e:
            print(f"An error occurred during history translation: {e}")
            # Fallback: return the untranslated flattened string
            return flattened_history_string

        ### 27/08/25 ##################################################################################################################


    async def handle_request(self, request: Request):
        data = await request.json()
        chat_request = ChatCompletionRequest.parse_obj(data)


        ### GENIE.AI #################################################################################################################
        print(f'🐽🐽🐽 {chat_request} 🐽🐽🐽')
        full_chat_history = chat_request.messages
        original_language = chat_request.context.language if chat_request.context else None
        print(f'🐽 Original Language: {original_language} ') # 💚 'auto'

        translated_history_string = ""
        if original_language and original_language.strip() != "EN":
            translated_history_string = await self._get_translated_history_string(full_chat_history, "English")
        else:
            # If already English, flatten without translation
            parts = [f"{msg.get('role', '').upper()}: {msg.get('content', '')}" for msg in full_chat_history]
            translated_history_string = " |<-MSG->| ".join(parts)

        print(f'🐕‍🦺🐕‍🦺🐕‍🦺 Translated History String: {translated_history_string} 🐕‍🦺🐕‍🦺🐕‍🦺')

        # RegEx-based extraction for last user message in the array
        last_translated_message_content = ""
        user_messages = re.findall(r"USER:\s*(.*?)(?:\s*\|<-MSG->\||$)", translated_history_string, re.DOTALL)
        if user_messages:
            # The last one in the list:
            last_translated_message_content = user_messages[-1].strip()

        # If regex fails for some reason, we have a simple fallback
        if not last_translated_message_content:
            # Fallback to just using the whole blob (less accurate for retrieval but safe)
            last_translated_message_content = translated_history_string

        print(f'🐕‍🦺🐕‍🦺🐕‍🦺 last_translated_message_content: {last_translated_message_content} 🐕‍🦺🐕‍🦺🐕‍🦺')

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
        print(f'🐕‍🦺🐕‍🦺🐕‍🦺 Retrieval Context: {retrieval_context} 🐕‍🦺🐕‍🦺🐕‍🦺')


        ### 20/08/25 ##################################################################################################################


        parameters = LLMParams(
            max_tokens=chat_request.max_tokens if chat_request.max_tokens else 1024,
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
            search_type=chat_request.search_type if chat_request.search_type else "similarity_score_threshold", #"similarity",
            k=chat_request.k if chat_request.k else 4,
            distance_threshold=chat_request.distance_threshold if chat_request.distance_threshold else None,
            fetch_k=chat_request.fetch_k if chat_request.fetch_k else 20,
            lambda_mult=chat_request.lambda_mult if chat_request.lambda_mult else 0.5,
            score_threshold=chat_request.score_threshold if chat_request.score_threshold else 0.01,
        )
        reranker_parameters = RerankerParms(
            top_n=chat_request.top_n if chat_request.top_n else 1,
        )


        ### GENIE.AI #################################################################################################################
        result_dict, runtime_graph = await self.megaservice.schedule(
            initial_inputs={"text": last_translated_message_content},
            llm_parameters=parameters,
            retriever_parameters=retriever_parameters,
            reranker_parameters=reranker_parameters,
            full_chat_history_string=translated_history_string,
            retrieval_context=retrieval_context,
            original_language=original_language,
        )
        ### 20/08/25 ##################################################################################################################

        print(f'🌻🌻🌻\nResult Dict: {result_dict}')
        print(f'🐽🐽🐽\nRuntime Graph: {runtime_graph}')

        for node, response in result_dict.items():
            if isinstance(response, StreamingResponse):
                return response

        # Get the final text answer from last node in pipeline
        last_node = runtime_graph.all_leaves()[-1]
        final_text_response = result_dict.get(last_node, {}).get("text", "Sorry, I could not generate a response.")

        print(f'🌿🌿🌿\nRuntime Graph Leaves: {runtime_graph.all_leaves()}')

        # Get source documents from retriever or reranker node
        source_node_name = "rerank" if "rerank" in runtime_graph.nodes else "retriever"
        retrieved_docs_with_scores = result_dict.get(source_node_name, [])

        # Format the source documents list
        source_documents_formatted = []
        scores = []

        for item in retrieved_docs_with_scores:
            doc = item.get("doc")
            score = item.get("score", 0.0)

            if not doc:
                continue

            # LangChain's Document object has page_content and metadata
            metadata = doc.metadata or {}
            doc_id = metadata.get("file_id", "N/A")

            # You can construct the URL based on your server's configuration
            doc_url = f"http://e2e-109-198:8080/documents/{doc_id}"

            source_documents_formatted.append({
                "document_id": doc_id,
                "url": doc_url,
                "text": doc.page_content,
                "categoryLabel": metadata.get("categoryLabel", None), # Assuming these are in metadata
                "serviceLabels": metadata.get("serviceLabels", []), # Assuming these are in metadata
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
        return JSONResponse(content=final_response_payload)


        # response = result_dict[last_node]["text"]
        # choices = []
        # usage = UsageInfo()
        # choices.append(
        #     ChatCompletionResponseChoice(
        #         index=0,
        #         message=ChatMessage(role="assistant", content=response),
        #         finish_reason="stop",
        #     )
        # )
        # return ChatCompletionResponse(model="chatqna", choices=choices, usage=usage)

        ### 28/08/25 ##################################################################################################################


    def start(self):

        self.service = MicroService(
            self.__class__.__name__,
            service_role=ServiceRoleType.MEGASERVICE,
            host=self.host,
            port=self.port,
            endpoint=self.endpoint,
            input_datatype=ChatCompletionRequest,
            # output_datatype=ChatCompletionResponse, <-- This is now handled by handle_request
        )

        self.service.add_route(self.endpoint, self.handle_request, methods=["POST"])

        self.service.start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--without-rerank", action="store_true")
    parser.add_argument("--with-guardrails", action="store_true")
    parser.add_argument("--faqgen", action="store_true")
    parser.add_argument("--genie-ai", action="store_true", help="For Genie AI prototype")
    parser.add_argument("--with-translation", action="store_true") 
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






