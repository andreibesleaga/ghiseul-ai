## Build Microservices (Optional)
1. `cd ./GenAIComps`
2. `docker build -t opea/dataprep:latest --build-arg https_proxy=$https_proxy --build-arg http_proxy=$http_proxy -f comps/dataprep/src/Dockerfile .`
3. `docker build -t opea/retriever:latest --build-arg https_proxy=$https_proxy --build-arg http_proxy=$http_proxy -f comps/retrievers/src/Dockerfile .`
4. `docker images`

## Build ChatQnA (Optional)
1. Move or copy the `./GenAIComps/comps` directory into the `./ChatQnA` directory
    - Move: `mv ./GenAIComps/comps ./ChatQnA`
    - Copy: `cp -r ./GenAIComps/comps ./ChatQnA`
2. `cd ./ChatQnA`
3. Confirm that imports work with `python3 -c "from comps.cores.proto.api_protocol import TranslationRequest"`
4. Build ChatQnA from source
5. Confirm with `docker images`

# Compose ChatQnA
1. `. ./set_env.sh` NOTE: Refer to this file to update environment variables! 
2. `docker compose -f ./docker-compose-epic.yaml up -d` or `docker compose -f ./docker-compose-epic.yaml up --no-deps -d <service-name>`
3. `docker ps`

# Shutdown ChatQnA
1. `docker compose -f ./docker-compose-epic.yaml down`


# Interact with ChatQnA

Upload Text:

```bash
curl -X POST \
    -H "Content-Type: multipart/form-data" \
    -F "files=@./sample.txt" \
    http://localhost:6007/v1/dataprep/ingest
```

Submit Query:
 

```bash
curl http://localhost:8888/v1/chatqna \
    -H "Content-Type: application/json" \
    -d '{
        "messages": "Can I hire a police officer?",
        "stream": false
    }'
```

```bash
curl http://localhost:8888/v1/chatqna \
    -H "Content-Type: application/json" \
    -d '{
        "messages": "I am moving to Romania with my family to start a new job. Do I need to register my children for the Social Health Insurance?",
        "stream": false
    }'
```

```bash
curl http://localhost:8888/v1/chatqna \
    -H "Content-Type: application/json" \
    -d '{
        "messages": "My employer told me that I need to obtain an NSSF number. How do I get one?",
        "stream": false
    }'
```

```bash
curl http://localhost:8888/v1/chatqna \
    -H "Content-Type: application/json" \
    -d '{
        "messages": "I am a foreign filmmaker. How much would it cost me to obtain permission to film in Romania?",
        "stream": false
    }'
```

**NOTE**:

1. We've noticed issues with setting `stream` to `true` in the request, the entire VLLM Response is returned for each streamed token.
Suspecting to be related to the following `try/except` clause: https://github.com/opea-project/GenAIExamples/blob/main/ChatQnA/chatqna.py#L182-L194

2. Consider experimenting with the `RETRIEVER_X` environment variables in `set_env.sh` to see different retrieval behaviour.

3. Consider disabling the ChatQnA Reranker Service in order to see if the VLLM Response is better (AFAIK, the reranker may only **keep** a subset of the retrieved documents)

4. Full list of ChatQnA Request Parameters:

Source: https://github.com/opea-project/GenAIComps/blob/main/comps/cores/proto/api_protocol.py#L274

We have opened a Github Issue to track if Swagger can be supported: https://github.com/opea-project/docs/issues/388

```python
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
    max_tokens: Optional[PositiveInt] = 1024  # use https://platform.openai.com/docs/api-reference/completions/create
    n: Optional[PositiveInt] = 1
    presence_penalty: Optional[float] = 0.0
    response_format: Optional[ResponseFormat] = None
    seed: Optional[PositiveInt] = None
    service_tier: Optional[str] = None
    stop: Union[str, List[str], None] = Field(default_factory=list)
    stream: Optional[bool] = False
    stream_options: Optional[StreamOptions] = Field(default=None)
    temperature: Optional[NonNegativeFloat] = 0.01  # vllm default 0.7
    top_p: Optional[NonNegativeFloat] = (
        None  # openai default 1.0, but tgi needs `top_p` must be > 0.0 and < 1.0, set None
    )
    tools: Optional[List[ChatCompletionToolsParam]] = None
    tool_choice: Optional[Union[Literal["none"], ChatCompletionNamedToolChoiceParam]] = "none"
    parallel_tool_calls: Optional[bool] = True
    user: Optional[str] = None
    language: str = "auto"  # can be "en", "zh"
    image_path: Optional[str] = None
    audio_path: Optional[str] = None

    # Ordered by official OpenAI API documentation
    # default values are same with
    # https://platform.openai.com/docs/api-reference/completions/create
    best_of: Optional[PositiveInt] = 1
    suffix: Optional[str] = None

    # vllm reference: https://github.com/vllm-project/vllm/blob/main/vllm/entrypoints/openai/protocol.py#L130
    repetition_penalty: Optional[NonNegativeFloat] = 1.0

    # tgi reference: https://huggingface.github.io/text-generation-inference/#/Text%20Generation%20Inference/generate
    # some tgi parameters in use
    # default values are same with
    # https://github.com/huggingface/text-generation-inference/blob/main/router/src/lib.rs#L190
    # max_new_tokens: Optional[int] = 100 # Priority use openai
    top_k: Optional[PositiveInt] = None
    # top_p: Optional[float] = None # Priority use openai
    typical_p: Optional[float] = None
    # repetition_penalty: Optional[float] = None
    timeout: Optional[PositiveInt] = None

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
    search_type: str = "similarity"
    k: PositiveInt = 4
    distance_threshold: Optional[float] = None
    fetch_k: PositiveInt = 20
    lambda_mult: NonNegativeFloat = 0.5
    score_threshold: NonNegativeFloat = 0.2
    retrieved_docs: Union[List[RetrievalResponseData], List[Dict[str, Any]]] = Field(default_factory=list)
    index_name: Optional[str] = None

    # reranking
    top_n: PositiveInt = 1
    reranked_docs: Union[List[RerankingResponseData], List[Dict[str, Any]]] = Field(default_factory=list)

    # define
    request_type: Literal["chat"] = "chat"
```