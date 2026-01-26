# Copyright (C) 2025 International Telecommunication Union (ITU)
# SPDX-License-Identifier: Apache-2.0

# ------------------------------------------------------------------
# GENIE.AI custom api protocol 
# ------------------------------------------------------------------

# importing all existing models from the original OPEA api protocol
from api_protocol import *  
from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class RetrievalRequestArangoDB(RetrievalRequest):
    graph_name: str | None = None
    search_start: str | None = None  # "node", "edge", "chunk"
    search_mode: str | None = None # "vector", "hybrid"
    num_centroids: int | None = None
    distance_strategy: str | None = None  #  # "COSINE", "EUCLIDEAN_DISTANCE"
    use_approx_search: bool | None = None
    enable_traversal: bool | None = None
    enable_summarizer: bool | None = None
    traversal_max_depth: int | None = None
    traversal_max_returned: int | None = None
    traversal_score_threshold: float | None = None
    traversal_query: str | None = None
    context: Optional[Dict[str, Any]] = None  # need to update in other files filter --> context


class RequestContext(BaseModel):
    """
    A model to hold structured context for metadata filtering during retrieval.
    """
    categoryLabel: Optional[str] = None
    serviceLabels: Optional[List[str]] = None
    language: Optional[str] = None 

class ChatCompletionRequest(BaseModel):
    # Ordered by official OpenAI API documentation
    # https://platform.openai.com/docs/api-reference/chat/create
    messages: Union[
        str,
        List[Dict[str, str]],
        List[Dict[str, Union[str, List[Dict[str, Union[str, Dict[str, str]]]]]]],
    ]
    model: Optional[str] = None
    modalities: List[Literal["text", "audio"]] = Field(default=["text"])
    frequency_penalty: Optional[float] = 0.0
    logit_bias: Optional[Dict[str, float]] = None
    logprobs: Optional[bool] = False
    top_logprobs: Optional[int] = 0
    max_tokens: Optional[int] = 1024  # use https://platform.openai.com/docs/api-reference/completions/create
    n: Optional[int] = 1
    presence_penalty: Optional[float] = 0.0
    response_format: Optional[ResponseFormat] = None
    seed: Optional[int] = None
    service_tier: Optional[str] = None
    stop: Union[str, List[str], None] = Field(default_factory=list)
    stream: Optional[bool] = False
    stream_options: Optional[StreamOptions] = Field(default=None) # changed from default_factory=StreamOptions
    temperature: Optional[float] = 0.01  # vllm default 0.7
    top_p: Optional[float] = (
        None  # openai default 1.0, but tgi needs `top_p` must be > 0.0 and < 1.0, set None
    )
    tools: Optional[List[ChatCompletionToolsParam]] = None
    tool_choice: Optional[Union[Literal["none"], ChatCompletionNamedToolChoiceParam]] = "none"
    parallel_tool_calls: Optional[bool] = True
    user: Optional[str] = None
    context: Optional[RequestContext] = Field(
        default=None,
        description="Application-specific context for metadata filtering in retrieval."
        )
    language: str = "auto"  # can be "en", "zh"
    image_path: Optional[str] = None
    audio_path: Optional[str] = None

    # Ordered by official OpenAI API documentation
    # default values are same with
    # https://platform.openai.com/docs/api-reference/completions/create
    best_of: Optional[int] = 1
    suffix: Optional[str] = None

    # vllm reference: https://github.com/vllm-project/vllm/blob/main/vllm/entrypoints/openai/protocol.py#L130
    repetition_penalty: Optional[float] = 1.0

    # tgi reference: https://huggingface.github.io/text-generation-inference/#/Text%20Generation%20Inference/generate
    # some tgi parameters in use
    # default values are same with
    # https://github.com/huggingface/text-generation-inference/blob/main/router/src/lib.rs#L190
    # max_new_tokens: Optional[int] = 100 # Priority use openai
    top_k: Optional[int] = None
    # top_p: Optional[float] = None # Priority use openai
    typical_p: Optional[float] = None
    # repetition_penalty: Optional[float] = None
    timeout: Optional[int] = None

    # doc: begin-chat-completion-extra-params
    echo: Optional[bool] = Field(
        default=False,
        description=(
            "If true, the new message will be prepended with the last message " "if they belong to the same role."
        ),
    )
    add_generation_prompt: Optional[bool] = Field(
        default=True,
        description=(
            "If true, the generation prompt will be added to the chat template. "
            "This is a parameter used by chat template in tokenizer config of the "
            "model."
        ),
    )
    add_special_tokens: Optional[bool] = Field(
        default=False,
        description=(
            "If true, special tokens (e.g. BOS) will be added to the prompt "
            "on top of what is added by the chat template. "
            "For most models, the chat template takes care of adding the "
            "special tokens so this should be set to False (as is the "
            "default)."
        ),
    )
    documents: Optional[Union[List[Dict[str, str]], List[str]]] = Field(
        default=None,
        description=(
            "A list of dicts representing documents that will be accessible to "
            "the model if it is performing RAG (retrieval-augmented generation)."
            " If the template does not support RAG, this argument will have no "
            "effect. We recommend that each document should be a dict containing "
            '"title" and "text" keys.'
        ),
    )
    chat_template: Optional[str] = Field(
        default=None,
        description=(
            "A template to use for this conversion. "
            "If this is not passed, the model's default chat template will be "
            "used instead. We recommend that the template contains {context} and {question} for rag,"
            "or only contains {question} for chat completion without rag."
        ),
    )
    chat_template_kwargs: Optional[Dict[str, Any]] = Field(
        default=None,
        description=("Additional kwargs to pass to the template renderer. " "Will be accessible by the chat template."),
    )
    # doc: end-chat-completion-extra-params

    # embedding
    input: Union[List[int], List[List[int]], str, List[str]] = None  # user query/question from messages[-]
    encoding_format: Optional[str] = Field("float", pattern="^(float|base64)$")
    dimensions: Optional[int] = None
    embedding: Union[EmbeddingResponse, List[float]] = Field(default_factory=list)

    # retrieval
    search_type: str = "similarity_score_threshold" #"similarity"
    k: int = 4
    distance_threshold: Optional[float] = None
    fetch_k: int = 20
    lambda_mult: float = 0.5
    score_threshold: float = 0.01
    retrieved_docs: Union[List[RetrievalResponseData], List[Dict[str, Any]]] = Field(default_factory=list)
    index_name: Optional[str] = None

    # reranking
    top_n: int = 2 # Need to highlight this variable in the documentation
    reranked_docs: Union[List[RerankingResponseData], List[Dict[str, Any]]] = Field(default_factory=list)

    # define
    request_type: Literal["chat"] = "chat"

class TranslationRequest(BaseModel):
    text: str
    stream: Optional[bool] = False

    
class ArangoDBDataprepRequestFromDocRepo(ArangoDBDataprepRequest):
    def __init__(
        self,
        file_id: Optional[str] = None,
        file_name: Optional[str] = None,
        file_path: Optional[str] = None,
        file_type: Optional[str] = None,
        file_labels: Optional[List[str]] = None,
        upload_date: Optional[str] = None,
        storage_path: Optional[str] = None,
        files: Optional[Union[UploadFile, List[UploadFile]]] = File(None),
        link_list: Optional[str] = None,
        chunk_size: Optional[int] = 1500,
        chunk_overlap: Optional[int] = 100,
        process_table: Optional[bool] = False,
        table_strategy: Optional[str] = "fast",
        graph_name: Optional[str] = None,
        insert_async: Optional[bool] = None,
        insert_batch_size: Optional[int] = None,
        embed_nodes: Optional[bool] = None,
        embed_edges: Optional[bool] = None,
        embed_chunks: Optional[bool] = None,
        allowed_node_types: Optional[List[str]] = None,
        allowed_edge_types: Optional[List[str]] = None,
        node_properties: Optional[List[str]] = None,
        edge_properties: Optional[List[str]] = None,
        text_capitalization_strategy: Optional[str] = None,
        include_chunks: Optional[bool] = None,
    ):
        super().__init__(
            files=files,
            link_list=link_list,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            process_table=process_table,
            table_strategy=table_strategy,
            graph_name = graph_name,
            insert_async = insert_async,
            insert_batch_size = insert_batch_size,
            embed_nodes = embed_nodes,
            embed_edges = embed_edges,
            embed_chunks = embed_chunks,
            allowed_node_types = allowed_node_types,
            allowed_edge_types = allowed_edge_types,
            node_properties = node_properties,
            edge_properties = edge_properties,
            text_capitalization_strategy = text_capitalization_strategy,
            include_chunks = include_chunks
        )

        self.file_id = file_id
        self.file_name = file_name
        self.file_path = file_path
        self.file_type = file_type
        self.file_labels = file_labels
        self.upload_date = upload_date
        self.storage_path = storage_path


