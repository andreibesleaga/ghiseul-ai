# Copyright (C) 2025 ArangoDB Corporation
# SPDX-License-Identifier: Apache-2.0

import json
import os
from typing import List, Optional, Union

import aiohttp
import base64
import requests

import openai
from arango import ArangoClient
from fastapi import Body, File, Form, HTTPException, UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_arangodb import ArangoGraph
from langchain_community.embeddings import HuggingFaceHubEmbeddings
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import HTMLHeaderTextSplitter
from openai import AsyncOpenAI

from comps import CustomLogger, DocPath, OpeaComponent, OpeaComponentRegistry, ServiceType, TextDoc
from comps.cores.proto.api_protocol import ArangoDBDataprepRequest, DataprepRequest, ArangoDBDataprepRequestFromDocRepo
from comps.dataprep.src.utils import (
    decode_filename,
    document_loader,
    encode_filename,
    get_separators,
    get_tables_result,
    parse_html,
    save_content_to_local_disk,
    is_valid_content
)

logger = CustomLogger("OPEA_DATAPREP_ARANGODB")
logflag = os.getenv("LOGFLAG", "false").lower() == "true"

# E2E CPU configuration
E2E_CPU_URL = os.getenv("E2E_CPU_URL", "http://91.203.132.51:3000")

# ArangoDB configuration
ARANGO_URL = os.getenv("ARANGO_URL", "http://localhost:8529")
ARANGO_DB_NAME = os.getenv("ARANGO_DB_NAME", "_system")
ARANGO_USERNAME = os.getenv("ARANGO_USERNAME", "root")
ARANGO_PASSWORD = os.getenv("ARANGO_PASSWORD", "test")

# ArangoDB graph configuration
ARANGO_INSERT_ASYNC = os.getenv("ARANGO_INSERT_ASYNC", "false").lower() == "true"
ARANGO_BATCH_SIZE = int(os.getenv("ARANGO_BATCH_SIZE", 1000))
ARANGO_GRAPH_NAME = os.getenv("ARANGO_GRAPH_NAME", "GRAPH_TEST")

# VLLM configuration
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "EMPTY")
VLLM_ENDPOINT = os.getenv("VLLM_ENDPOINT", "http://localhost:80")
VLLM_MODEL_ID = os.getenv("VLLM_MODEL_ID", "Intel/neural-chat-7b-v3-3")
VLLM_MAX_NEW_TOKENS = int(os.getenv("VLLM_MAX_NEW_TOKENS", 512))
VLLM_TOP_P = float(os.getenv("VLLM_TOP_P", 0.9))
VLLM_TEMPERATURE =float(os.getenv("VLLM_TEMPERATURE", 0.8))
VLLM_TIMEOUT = int(os.getenv("VLLM_TIMEOUT", 600))

# TEI configuration
TEI_EMBEDDING_ENDPOINT = os.getenv("TEI_EMBEDDING_ENDPOINT")
TEI_EMBED_MODEL = os.getenv("TEI_EMBED_MODEL", "BAAI/bge-base-en-v1.5")
HUGGINGFACEHUB_API_TOKEN = os.getenv("HUGGINGFACEHUB_API_TOKEN")
EMBED_NODES = os.getenv("EMBED_NODES", "true").lower() == "true"
EMBED_EDGES = os.getenv("EMBED_EDGES", "true").lower() == "true"
EMBED_CHUNKS = os.getenv("EMBED_CHUNKS", "true").lower() == "true"

# Guardrail configuration
GUARDRAIL_URL = os.getenv("GUARDRAIL_URL", "http://guardrail:9090/v1/guardrails")
GUARDRAIL_ENABLED = os.getenv("GUARDRAIL_ENABLED", "false").lower() == "true"

# Document repository configuration
DOC_REPO_URL = os.getenv("DOC_REPO_URL", "http://localhost:3001")
GET_AUTH_TOKEN_URL = os.getenv("GET_AUTH_TOKEN_URL", "http://http-service:6666/get-token")

# OpenAI configuration (alternative to TEI/VLLM)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
OPENAI_EMBED_DIMENSION = int(os.getenv("OPENAI_EMBED_DIMENSION", '512'))
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o")
OPENAI_CHAT_TEMPERATURE = float(os.getenv("OPENAI_CHAT_TEMPERATURE", '0'))
OPENAI_CHAT_ENABLED = os.getenv("OPENAI_CHAT_ENABLED", "true").lower() == "true"
OPENAI_EMBED_ENABLED = os.getenv("OPENAI_EMBED_ENABLED", "true").lower() == "true"

# LLM/Graph Transformer configuration
SYSTEM_PROMPT_PATH = os.getenv("SYSTEM_PROMPT_PATH")
ALLOWED_NODE_TYPES = os.getenv("ALLOWED_NODE_TYPES", "").split(",") if os.getenv("ALLOWED_NODE_TYPES") else []
ALLOWED_EDGE_TYPES = os.getenv("ALLOWED_EDGE_TYPES", "").split(",") if os.getenv("ALLOWED_EDGE_TYPES") else []
NODE_PROPERTIES = os.getenv("NODE_PROPERTIES", "description").split(",")
EDGE_PROPERTIES = os.getenv("EDGE_PROPERTIES", "description").split(",")
TEXT_CAPITALIZATION_STRATEGY = os.getenv("TEXT_CAPITALIZATION_STRATEGY", "upper")
INCLUDE_CHUNKS = os.getenv("INCLUDE_CHUNKS", "true").lower() == "true"


@OpeaComponentRegistry.register("OPEA_DATAPREP_ARANGODB")
class OpeaArangoDataprep(OpeaComponent):
    """Dataprep component for ArangoDB ingestion and search services."""

    def __init__(self, name: str, description: str, config: dict = None):
        super().__init__(name, ServiceType.DATAPREP.name.lower(), description, config)
        self.upload_folder = "./uploaded_files/"

        self.llm_transformer: LLMGraphTransformer
        self.embeddings: Embeddings

        self._initialize_embeddings()
        self._initialize_client()

        if not self.check_health():
            logger.error("OpeaArangoDataprep health check failed.")

    def _initialize_llm(
        self,
        allowed_node_types: Union[List[str], str],
        allowed_edge_types: Union[List[str], str],
        node_properties: Union[List[str], str],
        edge_properties: Union[List[str], str],
    ):
        """Initialize the LLM model & LLMGraphTransformer object."""

        # Process string inputs if needed
        if allowed_node_types and isinstance(allowed_node_types, str):
            allowed_node_types = allowed_node_types.split(",")

        if allowed_edge_types and isinstance(allowed_edge_types, str):
            allowed_edge_types = allowed_edge_types.split(",")

        if node_properties and isinstance(node_properties, str):
            node_properties = node_properties.split(",")

        if edge_properties and isinstance(edge_properties, str):
            edge_properties = edge_properties.split(",")

        prompt_template = None
        if SYSTEM_PROMPT_PATH is not None:
            try:
                with open(SYSTEM_PROMPT_PATH, "r") as f:
                    prompt_template = ChatPromptTemplate.from_messages(
                        [
                            ("system", f.read()),
                            (
                                "human",
                                (
                                    "Tip: Make sure to answer in the correct format and do "
                                    "not include any explanations. "
                                    "Use the given format to extract information from the "
                                    "following input: {input}"
                                ),
                            ),
                        ]
                    )
            except Exception as e:
                logger.error(f"Could not set custom Prompt: {e}")

        ignore_tool_usage = False

        if OPENAI_API_KEY and OPENAI_CHAT_ENABLED:
            if logflag:
                logger.info("OpenAI API Key is set. Verifying its validity...")
            openai.api_key = OPENAI_API_KEY

            try:
                openai.models.list()
                if logflag:
                    logger.info("OpenAI API Key is valid.")
                llm = ChatOpenAI(temperature=OPENAI_CHAT_TEMPERATURE, model_name=OPENAI_CHAT_MODEL)
            except openai.error.AuthenticationError:
                if logflag:
                    logger.info("OpenAI API Key is invalid.")
            except Exception as e:
                logger.error(f"An error occurred while verifying the API Key: {e}")
        elif VLLM_ENDPOINT:
            llm = ChatOpenAI(
                openai_api_key=VLLM_API_KEY,
                openai_api_base=f"{VLLM_ENDPOINT}/v1",
                model=VLLM_MODEL_ID,
                temperature=VLLM_TEMPERATURE,
                max_tokens=VLLM_MAX_NEW_TOKENS,
                top_p=VLLM_TOP_P,
                timeout=VLLM_TIMEOUT,
            )
            ignore_tool_usage = True
        else:
            raise HTTPException(status_code=400, detail="No LLM environment variables are set, cannot generate graphs.")

        try:
            self.llm_transformer = LLMGraphTransformer(
                llm=llm,
                allowed_nodes=allowed_node_types,
                allowed_relationships=allowed_edge_types,
                prompt=prompt_template,
                node_properties=node_properties or False,
                relationship_properties=edge_properties or False,
                ignore_tool_usage=ignore_tool_usage,
            )
        except (TypeError, ValueError) as e:
            logger.warning(f"Advanced LLMGraphTransformer failed: {e}")
            # Fall back to basic config
            try:
                self.llm_transformer = LLMGraphTransformer(llm=llm, ignore_tool_usage=ignore_tool_usage)
            except (TypeError, ValueError) as e:
                logger.error(f"Failed to initialize LLMGraphTransformer: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to initialize LLMGraphTransformer: {e}")

    def _initialize_embeddings(self):
        """Initialize the embeddings model."""
        if TEI_EMBED_MODEL:
            self.embeddings = HuggingFaceEmbeddings(model_name=TEI_EMBED_MODEL)
            if logflag:
                logger.debug("Using HuggingFaceEmbeddings for embeddings.")
        else:
            raise HTTPException(
                status_code=400, detail="No embeddings environment variables are set, cannot generate embeddings."
            )

    def _initialize_client(self):
        """Initialize the ArangoDB connection."""

        self.client = ArangoClient(hosts=ARANGO_URL)
        sys_db = self.client.db(name="_system", username=ARANGO_USERNAME, password=ARANGO_PASSWORD, verify=True)

        if not sys_db.has_database(ARANGO_DB_NAME):
            sys_db.create_database(ARANGO_DB_NAME)

        self.db = self.client.db(name=ARANGO_DB_NAME, username=ARANGO_USERNAME, password=ARANGO_PASSWORD, verify=True)
        logger.info(f"Connected to ArangoDB {self.db.version()}.")

    def check_health(self) -> bool:
        """Checks the health of the retriever service."""

        if logflag:
            logger.info("[ check health ] start to check health of ArangoDB")
        try:
            version = self.db.version()
            if logflag:
                logger.info(f"[ check health ] Successfully connected to ArangoDB {version}!")
            return True
        except Exception as e:
            logger.info(f"[ check health ] Failed to connect to ArangoDB: {e}")
            return False

    async def ingest_data_to_arango(
        self,
        doc_path: DocPath,
        graph_name: str,
        insert_async: bool,
        insert_batch_size: int,
        embed_nodes: bool,
        embed_edges: bool,
        embed_chunks: bool,
        include_chunks: bool,
        text_capitalization_strategy: str,
    ):
        """Ingest document to ArangoDB."""

        path = doc_path.path
        if logflag:
            logger.info(f"Parsing document {path}")

        ############
        # Chunking #
        ############

        if path.endswith(".html"):
            headers_to_split_on = [
                ("h1", "Header 1"),
                ("h2", "Header 2"),
                ("h3", "Header 3"),
            ]
            text_splitter = HTMLHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        else:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=doc_path.chunk_size,
                chunk_overlap=doc_path.chunk_overlap,
                add_start_index=True,
                separators=get_separators(),
            )

        content = await document_loader(path)

        structured_types = [".xlsx", ".csv", ".json", "jsonl"]
        _, ext = os.path.splitext(path)

        if ext in structured_types:
            chunks = content
        else:
            chunks = text_splitter.split_text(content)

        if doc_path.process_table and path.endswith(".pdf"):
            table_chunks = get_tables_result(path, doc_path.table_strategy)
            if isinstance(table_chunks, list):
                chunks = chunks + table_chunks

        if logflag:
            logger.info(f"Created {len(chunks)} chunks of the original file")

        ################################
        # Graph generation & insertion #
        ################################

        if logflag:
            logger.info(f"Creating graph {graph_name}.")

        graph = ArangoGraph(db=self.db, generate_schema_on_init=False)

        for i, text in enumerate(chunks):
            document = Document(page_content=text, metadata={"file_name": path, "chunk_index": i})
            # Temporarily remove the following lines because file_labels workflow is not defined yet.
            # Add labels to chunks if needed. See the comments starting from line 359.
            # document = Document(
            #     page_content=text,
            #     metadata={
            #         "file_name": path,
            #         "chunk_index": i,
            #         "file_labels": file_labels,
            #     },
            # )

            if logflag:
                logger.info(f"Chunk {i}: extracting nodes & relationships")

            graph_doc = self.llm_transformer.process_response(document)

            if logflag:
                logger.info(f"Chunk {i}: inserting into ArangoDB")

            graph.add_graph_documents(
                graph_documents=[graph_doc],
                include_source=include_chunks,
                graph_name=graph_name,
                update_graph_definition_if_exists=False,
                batch_size=insert_batch_size,
                use_one_entity_collection=True,
                insert_async=insert_async,
                embeddings=self.embeddings,
                embedding_field="embedding",
                embed_source=embed_chunks,
                embed_nodes=embed_nodes,
                embed_relationships=embed_edges,
                capitalization_strategy=text_capitalization_strategy,
            )

            if logflag:
                logger.info(f"Chunk {i}: processed")

        if logflag:
            logger.info(f"Graph {graph_name} created with {len(chunks)} chunks.")

        # if file_labels:
        #     # TODO: Propagate the file labels to the Entities & Edges in the Graph.
        #     # At this point, all the data has been successfully ingested into the Graph.
        #     # We can now do whatever we want with the Graph before returning it.

        #     # Example, here is an AQL query to add the file_labels to ALL ENTITIES in the Graph
        #     query = f"""
        #     FOR doc IN {graph_name}_ENTITIES
        #         UPDATE doc WITH {{ file_labels: @file_labels }} IN {graph_name}_ENTITIES
        #     """
            
        #     self.db.aql.execute(query, bind_vars={"@file_labels": file_labels})

        #     # Example, here is an AQL query to add the file_labels to ALL EDGES in the Graph
        #     query = f"""
        #     FOR doc IN {graph_name}_LINKS_TO
        #         UPDATE doc WITH {{ file_labels: @file_labels }} IN {graph_name}_LINKS_TO
        #     """

        #     self.db.aql.execute(query, bind_vars={"@file_labels": file_labels})
        #     pass

        return graph_name

    async def ingest_files(self, input: Union[DataprepRequest, ArangoDBDataprepRequest]):
        """Ingest files/links content into ArangoDB database.

        Save in the format of vector[768].
        Returns '{"status": 200, "message": "Data preparation succeeded"}' if successful.
        Args:
            input (DataprepRequest | ArangoDBDataprepRequest): Model containing the following parameters:
                files (Union[UploadFile, List[UploadFile]], optional): A file or a list of files to be ingested. Defaults to File(None).
                link_list (str, optional): A list of links to be ingested. Defaults to Form(None).
                chunk_size (int, optional): The size of the chunks to be split. Defaults to Form(500).
                chunk_overlap (int, optional): The overlap between chunks. Defaults to Form(100).
                process_table (bool, optional): Whether to process tables in PDFs. Defaults to Form(False).
                table_strategy (str, optional): The strategy to process tables in PDFs. Defaults to Form("fast").
                graph_name (str, optional): The name of the graph to be created. Defaults to "GRAPH".
                insert_async (bool, optional): Whether to insert data asynchronously. Defaults to False.
                insert_batch_size (int, optional): The batch size for insertion. Defaults to 1000.
                embed_nodes (bool, optional): Whether to embed nodes. Defaults to True.
                embed_edges (bool, optional): Whether to embed edges. Defaults to True.
                embed_chunks (bool, optional): Whether to embed chunks. Defaults to True.
                allowed_node_types (List[str], optional): The allowed node types. Defaults to [].
                allowed_edge_types (List[str], optional): The allowed edge types. Defaults to [].
                node_properties (List[str], optional): The node properties to be used. Defaults to ["description"].
                edge_properties (List[str], optional): The edge properties to be used. Defaults to ["description"].
                text_capitalization_strategy (str, optional): The text capitalization strategy. Defaults to "upper".
                include_chunks (bool, optional): Whether to include chunks in the graph. Defaults to True.
        """

        files = input.files
        link_list = input.link_list
        chunk_size = input.chunk_size
        chunk_overlap = input.chunk_overlap
        process_table = input.process_table
        table_strategy = input.table_strategy
        graph_name = getattr(input, "graph_name", ARANGO_GRAPH_NAME)
        insert_async = getattr(input, "insert_async", ARANGO_INSERT_ASYNC)
        insert_batch_size = getattr(input, "insert_batch_size", ARANGO_BATCH_SIZE)
        embed_nodes = getattr(input, "embed_nodes", EMBED_NODES)
        embed_edges = getattr(input, "embed_edges", EMBED_EDGES)
        embed_chunks = getattr(input, "embed_chunks", EMBED_CHUNKS)
        allowed_node_types = getattr(input, "allowed_node_types", ALLOWED_NODE_TYPES)
        allowed_edge_types = getattr(input, "allowed_edge_types", ALLOWED_EDGE_TYPES)
        node_properties = getattr(input, "node_properties", NODE_PROPERTIES)
        edge_properties = getattr(input, "edge_properties", EDGE_PROPERTIES)
        text_capitalization_strategy = getattr(input, "text_capitalization_strategy", TEXT_CAPITALIZATION_STRATEGY)
        include_chunks = getattr(input, "include_chunks", INCLUDE_CHUNKS)
        # file_labels = getattr(input, "file_labels", []) Temporarily commented out because labelling workflow is not defined yet.

        self._initialize_llm(
            allowed_node_types=allowed_node_types,
            allowed_edge_types=allowed_edge_types,
            node_properties=node_properties,
            edge_properties=edge_properties,
        )

        if logflag:
            logger.info(f"files:{files}")
            logger.info(f"link_list:{link_list}")

        if not files and not link_list:
            raise HTTPException(status_code=400, detail="Must provide either a file or a string list.")

        graph_names_created = set()

        if files:
            if not isinstance(files, list):
                files = [files]
            uploaded_files = []
            for file in files:
                encode_file = encode_filename(file.filename)
                save_path = self.upload_folder + encode_file
                await save_content_to_local_disk(save_path, file)
                try:
                    graph_name = await self.ingest_data_to_arango(
                        DocPath(
                            path=save_path,
                            chunk_size=chunk_size,
                            chunk_overlap=chunk_overlap,
                            process_table=process_table,
                            table_strategy=table_strategy,
                        ),
                        graph_name=graph_name,
                        insert_async=insert_async,
                        insert_batch_size=insert_batch_size,
                        embed_nodes=embed_nodes,
                        embed_edges=embed_edges,
                        embed_chunks=embed_chunks,
                        text_capitalization_strategy=text_capitalization_strategy,
                        include_chunks=include_chunks
                        # file_labels=file_labels,
                    )

                    uploaded_files.append(save_path)
                    graph_names_created.add(graph_name)
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to ingest {save_path} into ArangoDB: {e}")

                if logflag:
                    logger.info(f"Successfully saved file {save_path}")

        if link_list:
            link_list = json.loads(link_list)  # Parse JSON string to list
            if not isinstance(link_list, list):
                raise HTTPException(status_code=400, detail="link_list should be a list.")
            for link in link_list:
                encoded_link = encode_filename(link)
                save_path = self.upload_folder + encoded_link + ".txt"
                content = parse_html([link])[0][0]   #########################################
                await save_content_to_local_disk(save_path, content)
                try:
                    graph_name = await self.ingest_data_to_arango(
                        DocPath(
                            path=save_path,
                            chunk_size=chunk_size,
                            chunk_overlap=chunk_overlap,
                            process_table=process_table,
                            table_strategy=table_strategy,
                        ),
                        graph_name=graph_name,
                        insert_async=insert_async,
                        insert_batch_size=insert_batch_size,
                        embed_nodes=embed_nodes,
                        embed_edges=embed_edges,
                        embed_chunks=embed_chunks,
                        text_capitalization_strategy=text_capitalization_strategy,
                        include_chunks=include_chunks,
                        # file_labels=file_labels,
                    )
                    graph_names_created.add(graph_name)
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to ingest {save_path} into ArangoDB: {e}")

                if logflag:
                    logger.info(f"Successfully saved link {link}")

        result = {
            "status": 200,
            "message": f"Data preparation succeeded: {graph_names_created}",
            "graph_names": list(graph_names_created),
        }

        if logflag:
            logger.info(result)

        return result


    async def fetch_all_labels(self): # LEGACY & FUTURE
        """Fetch all labels from the document repository."""

        url = f"{DOC_REPO_URL}/api/labels?"
        headers = {"Authorization": f"Bearer {DOC_REPO_AUTH_TOKEN}"}
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        labels = data.get("labels", [])
                        return labels
                    else:
                        if logflag:
                            logger.error(f"Failed to fetch labels. Status code: {response.status}")
                        return []
            except Exception as e:
                if logflag:
                    logger.error(f"Error fetching labels: {e}")
                return []
    
    async def create_new_label(self, label_info: Optional[dict] = None): # LEGACY & FUTURE
        """Create llm-generated labels in the document repository."""
        
        if label_info is None:
            if logflag:
                logger.error("No label information provided.")
            return {"status": 400, "message": "No label information provided."}

        url = f"{DOC_REPO_URL}/api/labels"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DOC_REPO_AUTH_TOKEN}",
        }

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(url, json=label_info, headers=headers) as response:
                    if response.status == 201:
                        data = await response.json()
                        return {"status": 201, "message": "Label created successfully.", "data": data}
                    else:
                        if logflag:
                            logger.error(f"Failed to create label. Status code: {response.status}")
                        return {"status": response.status, "message": "Failed to create label."}
            except Exception as e:
                if logflag:
                    logger.error(f"Error creating label: {e}")
                return {"status": 500, "message": f"Error creating label: {e}"}

    async def get_auth_token(self):
        """Get admin auth token"""
        response = requests.get(GET_AUTH_TOKEN_URL)
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("accessToken")
            if access_token:
                return access_token
            else:
                print("Failed to retrieve access token")
        else:
            print(f"Failed to call /get-token. Status code: {response.status_code}")


    async def fetch_all_labels_new(self):
        """Fetch all labels from the labelling tree stored in node-service db."""

        auth_token = await self.get_auth_token()
        if not auth_token:
            if logflag:
                logger.error("Failed to get admin auth token.")
            return ""

        url = f"{E2E_CPU_URL}/api/service-categories/categories"
        headers = {"Authorization": f"Bearer {auth_token}"}
        print('🌈🌈🌈')
        print(url)
        print(headers)
        print('🌈🌈🌈')
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        labels = []
                        for item in data:
                            labels.append(item['name'])
                            labels.extend(item['children'])
                        labels = list(set(labels)) # remove duplicates
                        return labels
                    else:
                        if logflag:
                            logger.error(f"Failed to fetch labels. Status code: {response.status}")
                        return []
            except Exception as e:
                if logflag:
                    logger.error(f"Error fetching labels: {e}")
                return []



    async def ingest_data_to_arango_with_guardrail(
        self,
        doc_path: DocPath,
        file_id: str,
        storage_path: str, # 🗂️🗂️🗂️🗂️🗂️🗂️
        graph_name: str,
        insert_async: bool,
        insert_batch_size: int,
        embed_nodes: bool,
        embed_edges: bool,
        embed_chunks: bool,
        include_chunks: bool,
        text_capitalization_strategy: str,
        all_labels: List[str],
    ):
        """Ingest document to ArangoDB."""

        path = doc_path.path
        if logflag:
            logger.info(f"Parsing document {path}")

        ############
        # Chunking #
        ############

        if path.endswith(".html"):
            headers_to_split_on = [
                ("h1", "Header 1"),
                ("h2", "Header 2"),
                ("h3", "Header 3"),
            ]
            text_splitter = HTMLHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        else:
            # How the chunk size is measured: by number of characters. https://python.langchain.com/docs/how_to/recursive_text_splitter/
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=doc_path.chunk_size,
                chunk_overlap=doc_path.chunk_overlap,
                add_start_index=True,
                separators=get_separators(),
            )

        print('🖤 Using document_loader to load the file content.')
        content = await document_loader(path) # Here content is a string
        print('🖤 type(content):', type(content))
        print('🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤')
        print(content)
        print('🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤🖤')
        if isinstance(content, str) and len(content) == 0:
            if logflag:
                logger.error(f"File {path} is empty or could not be read.")
            return {
                "success": False,
                "message": f"File {path} is empty or could not be read.",
            }

        structured_types = [".xlsx", ".csv", ".json", "jsonl", ".xls"]
        _, ext = os.path.splitext(path)

        print('🖤 Start to chunk file content.')
        if ext in structured_types:
            chunks = content # type chunks is list
            new_chunks = []
            for chunk in chunks:
                if len(chunk) > doc_path.chunk_size:
                    split_items = text_splitter.split_text(chunk)
                    new_chunks.extend(split_items)
                else:
                    new_chunks.append(chunk)
            chunks = new_chunks
        else:
            chunks = text_splitter.split_text(content) 
            for chunk in chunks:
                chunk_content = chunk.page_content if hasattr(chunk, "page_content") else str(chunk)
                if len(chunk_content) > doc_path.chunk_size:
                    text_splitter = RecursiveCharacterTextSplitter(
                        chunk_size=500,  # Adjusted to avoid token length issues by using the RecursiveCharacterTextSplitter
                        chunk_overlap=doc_path.chunk_overlap,
                        add_start_index=True,
                        separators=get_separators(),
                    )
                    break
            chunks = text_splitter.split_text(content)
            # By expanding the max_model_len of vllm and setting the chunk size to 500, we can guarantee that using text_splitter will get proper chunks that won't cause token lenth limit issues.
            # type chunks is list <class 'list'>
            # [Document(metadata={}, page_content='Example Domain\n\nThis domain is for use in illustrative examples in documents. More information...')]

        if doc_path.process_table and path.endswith(".pdf"):
            table_chunks = get_tables_result(path, doc_path.table_strategy)
            if isinstance(table_chunks, list):
                chunks = chunks + table_chunks

        if logflag:
            logger.info(f"Created {len(chunks)} chunks of the original file")
        if len(chunks) > 0:
            logger.info(f"📄 Chunks: {chunks[0]}...")
        
        plain_chunks = [
            c.page_content if hasattr(c, "page_content") else str(c)
            for c in chunks
        ]

        # Validate chunk content to make sure it is not web archive content
        valid_chunks = 0
        for i, chunk in enumerate(plain_chunks):
            if is_valid_content(chunk):
                valid_chunks += 1
            else:
                logger.warning(f"Chunk {i} is not valid content and might contain base64 codes or web archive content.")
        if valid_chunks / len(plain_chunks) < 0.2:
            if logflag:
                logger.error("Less than 20 percent of the chunks are valid. Please check the file content to remove any base64 codes or web archive content.")
            return {
                "success": False,
                "message": f"Less than 20% of the content are valid. Please check the file content to remove any potential base64 codes or web archive content."
            }

        ################################
        # Guardrail check for chunks   #
        ################################

        guardrail_url = GUARDRAIL_URL

        if GUARDRAIL_ENABLED and guardrail_url:
            if logflag:
                logger.info("Guardrail service is enabled, checking chunks for harmful content.")

            # Ensure the guardrail URL is valid
            if not guardrail_url.startswith("http://") and not guardrail_url.startswith("https://"):
                raise HTTPException(status_code=400, detail="Invalid Guardrail URL.")

            # Check each chunk for harmful content
            if logflag:
                logger.info(f"Sending {len(plain_chunks)} chunks to Guardrail service at {guardrail_url}")

            async with aiohttp.ClientSession() as session:
                for i, text in enumerate(plain_chunks):
                    payload = {"text": text} # Adjust based on actual guardrail prompt template 
                    async with session.post(guardrail_url, json=payload) as resp:
                        if resp.status != 200:
                            logger.error(f"Guardrail service error on chunk {i}")
                            return {
                                "success": False,
                                "message": f"Guardrail service error on chunk {i}",
                                "chunk_index": i,
                            }
                        result = await resp.json()
                        if result.get("text", "") == payload.get("text", ""):
                            # safe
                            if logflag:
                                logger.info(f"Chunk {i} passed guardrail check.")
                        else:
                            logger.error(f"Harmful content detected in chunk {i}")
                            return {
                                "success": False,
                                "message": f"Harmful content detected in chunk {i}",
                                "result": result.get("text", ""),
                                "chunk_index": i,
                                "chunk_content": text,
                            }


        ################################
        # Graph generation & insertion #
        ################################

        if logflag:
            logger.info(f"Creating graph {graph_name}.")

        graph = ArangoGraph(db=self.db, generate_schema_on_init=False)
        print(f"🔵 Graph object created: {graph}")
        print(f"🔵 Graph db: {str(self.db)}")

        client = AsyncOpenAI(api_key=VLLM_API_KEY, base_url=f"{VLLM_ENDPOINT}/v1") #############################

        # Change chunks into plain_chunks
        for i, text in enumerate(plain_chunks):
            print(f"🔵 Processing chunk {i}/{len(plain_chunks)}")
            print(f"🔵 text: {text}")

            ############## Generate chunk labels ##############
            labelling_time = 0
            print("❤️ Start to label this chunk!")
            while labelling_time < 20:
                response = await client.chat.completions.create(
                    model=VLLM_MODEL_ID,
                    messages=[
                        {"role": "system", "content": "You are a label selector. Your sole purpose is to classify content by selecting labels from a predefined list. You are strictly forbidden from generating any labels not included in the provided list."},
                        {"role": "user", "content": f"Select one or more labels from the provided labels list that best describe the input content. If no labels from the list are a good fit, return an empty list. Don't treat capitalized words as labels. DO NOT CREATE NEW LABELS. \nInput: {text} \nLabels: {all_labels} \n Your output should be in this format: {{\"labels\": [\"label1\", \"label2\", ...]}}"},
                    ],
                )
                raw_text = response.choices[0].message.content
                labelling_time += 1
                try:
                    chunk_labels = json.loads(raw_text)
                    if "labels" in chunk_labels and isinstance(chunk_labels['labels'], list):
                        all_fit = all(item in all_labels for item in chunk_labels['labels'])
                        if all_fit:
                            if logflag:
                                logger.info(f"Chunk {i} labelled with: {chunk_labels['labels']}")
                                print(f"💛 Chunk {i} labelled with: {chunk_labels['labels']}")
                                break
                        else:
                            if logflag:
                                logger.warning(f"Chunk {i} labelling returned some invalid labels: {chunk_labels['labels']}, retrying...")
                            chunk_labels = {"labels": []} # reset to empty list
                    else:
                        if logflag:
                            logger.warning(f"Chunk {i} labelling did not return a list of labels, retrying...")
                        chunk_labels = {"labels": []} # reset to empty list
                except json.JSONDecodeError as e:
                    if logflag:
                        logger.warning(f"Chunk {i} labelling JSON decode error: {e}, retrying...")
                    chunk_labels = {"labels": []} # reset to empty list
            
            try:
                document = Document(
                    page_content=text, 
                    metadata={
                        "file_id": file_id, 
                        "file_path": storage_path, # 🗂️🗂️🗂️🗂️🗂️🗂️
                        "chunk_index": i,
                        "chunk_labels": chunk_labels.get("labels", [])
                        }
                )
            except:
                document = Document(
                    page_content=text, 
                    metadata={
                        "file_id": file_id, 
                        "file_path": storage_path, # 🗂️🗂️🗂️🗂️🗂️🗂️
                        "chunk_labels": [],
                        "chunk_index": i,
                        }
                )

            if logflag:
                logger.info(f"Chunk {i}: extracting nodes & relationships")

            print(f"🔵 About to call llm_transformer.process_response for chunk {i}")
            graph_doc = self.llm_transformer.process_response(document)
            print(type(graph_doc))
            print(graph_doc)
            print(f"🔵 Finished llm_transformer.process_response for chunk {i}")

            if logflag:
                logger.info(f"Chunk {i}: inserting into ArangoDB")
            
            # FYI: coming from langchain-arangodb package
            print(f"🔵 About to call graph.add_graph_documents for chunk {i}")
            graph.add_graph_documents( 
                graph_documents=[graph_doc],
                include_source=include_chunks,
                graph_name=graph_name,
                update_graph_definition_if_exists=False,
                batch_size=insert_batch_size,
                use_one_entity_collection=True,
                insert_async=insert_async,
                embeddings=self.embeddings,
                embedding_field="embedding",
                embed_source=embed_chunks,
                embed_nodes=embed_nodes,
                embed_relationships=embed_edges,
                capitalization_strategy=text_capitalization_strategy,
            )
            print(f"🔵 Finished graph.add_graph_documents for chunk {i}")

            if logflag:
                logger.info(f"Chunk {i}: processed")

        if logflag:
            logger.info(f"Graph {graph_name} created with {len(plain_chunks)} chunks.")
        
        chunk_count = len(plain_chunks)

        return {
            "success": True,
            "message": f"File ingested with {chunk_count} chunks.",
            "graph_name": graph_name,
            "chunk_count": chunk_count,
        }

        # return graph_name



    async def ingest_file_with_guardrail(self, input: ArangoDBDataprepRequestFromDocRepo):
        """Ingest files/links content into ArangoDB database.

        Save in the format of vector[768].
        Returns '{"status": 200, "message": "Data preparation succeeded"}' if successful.
        Args:
            input (ArangoDBDataprepRequestFromDocRepo): Model containing the following parameters:
                file_id: The ID of the file to be ingested from the document repository.
                file_path: file storage path on local disk.
                files (Union[UploadFile, List[UploadFile]], optional): A file or a list of files to be ingested. Defaults to File(None).
                link_list (str, optional): A list of links to be ingested. Defaults to Form(None).
                chunk_size (int, optional): The size of the chunks to be split. Defaults to Form(500).
                chunk_overlap (int, optional): The overlap between chunks. Defaults to Form(100).
                process_table (bool, optional): Whether to process tables in PDFs. Defaults to Form(False).
                table_strategy (str, optional): The strategy to process tables in PDFs. Defaults to Form("fast").
                graph_name (str, optional): The name of the graph to be created. Defaults to "GRAPH".
                insert_async (bool, optional): Whether to insert data asynchronously. Defaults to False.
                insert_batch_size (int, optional): The batch size for insertion. Defaults to 1000.
                embed_nodes (bool, optional): Whether to embed nodes. Defaults to True.
                embed_edges (bool, optional): Whether to embed edges. Defaults to True.
                embed_chunks (bool, optional): Whether to embed chunks. Defaults to True.
                allowed_node_types (List[str], optional): The allowed node types. Defaults to [].
                allowed_edge_types (List[str], optional): The allowed edge types. Defaults to [].
                node_properties (List[str], optional): The node properties to be used. Defaults to ["description"].
                edge_properties (List[str], optional): The edge properties to be used. Defaults to ["description"].
                text_capitalization_strategy (str, optional): The text capitalization strategy. Defaults to "upper".
                include_chunks (bool, optional): Whether to include chunks in the graph. Defaults to True.
        """
        file_id = input.file_id
        file_name = input.file_name
        storage_path = input.storage_path # 🗂️🗂️🗂️🗂️🗂️🗂️
        file_path = input.file_path
        file_type = input.file_type
        file_labels = input.file_labels # 🏷️🏷️🏷️🏷️🏷️🏷️
        upload_date = input.upload_date
        chunk_size = input.chunk_size
        chunk_overlap = input.chunk_overlap
        process_table = input.process_table
        table_strategy = input.table_strategy
        graph_name = getattr(input, "graph_name", ARANGO_GRAPH_NAME) # It tries to get the attribute graph_name from the object input. If input has a graph_name attribute, its value is used. If not, it uses the value of ARANGO_GRAPH_NAME as a default.
        insert_async = getattr(input, "insert_async", ARANGO_INSERT_ASYNC)
        insert_batch_size = getattr(input, "insert_batch_size", ARANGO_BATCH_SIZE)
        embed_nodes = getattr(input, "embed_nodes", EMBED_NODES)
        embed_edges = getattr(input, "embed_edges", EMBED_EDGES)
        embed_chunks = getattr(input, "embed_chunks", EMBED_CHUNKS)
        allowed_node_types = getattr(input, "allowed_node_types", ALLOWED_NODE_TYPES)
        allowed_edge_types = getattr(input, "allowed_edge_types", ALLOWED_EDGE_TYPES)
        node_properties = getattr(input, "node_properties", NODE_PROPERTIES)
        edge_properties = getattr(input, "edge_properties", EDGE_PROPERTIES)
        text_capitalization_strategy = getattr(input, "text_capitalization_strategy", TEXT_CAPITALIZATION_STRATEGY)
        include_chunks = getattr(input, "include_chunks", INCLUDE_CHUNKS)

        all_labels = await self.fetch_all_labels_new()
        if logflag:
            logger.info(f"all_labels from node-service:{all_labels}")
        print('💙 all_labels from node-service:', all_labels)

        self._initialize_llm(
            allowed_node_types=allowed_node_types,
            allowed_edge_types=allowed_edge_types,
            node_properties=node_properties,
            edge_properties=edge_properties,
        )

        print('🖤 Initialize LLM finished.')

        if logflag:
            logger.info(f"file to be ingested:{file_id}")

        valid_strategies = ['lower', 'upper', 'none']
        if text_capitalization_strategy not in valid_strategies:
            logger.warning(f"Invalid capitalization strategy '{text_capitalization_strategy}', defaulting to 'upper'")
            text_capitalization_strategy = 'upper'

        print('🖤 Start to ingest data to ArangoDB.')
        try:
            arango_response = await self.ingest_data_to_arango_with_guardrail(
                DocPath(
                    path=file_path,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                    process_table=process_table,
                    table_strategy=table_strategy,
                ),
                file_id=file_id,
                storage_path=storage_path, # 🗂️🗂️🗂️🗂️🗂️🗂️
                graph_name=graph_name,
                insert_async=insert_async,
                insert_batch_size=insert_batch_size,
                embed_nodes=embed_nodes,
                embed_edges=embed_edges,
                embed_chunks=embed_chunks,
                text_capitalization_strategy=text_capitalization_strategy,
                include_chunks=include_chunks,
                all_labels=all_labels, # 🏷️🏷️🏷️🏷️🏷️🏷️
            )
            # if isinstance(graph_name, dict):
            #     result = graph_name
            #     return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to ingest {file_id} into ArangoDB: {e}")
            result = {
                "status": 500,
                "success": False,
                "message": f"Failed to ingest {file_id} into ArangoDB: {e}",
            }
            ###### Delete ingested chunks if error happens ########
            try:
                retraction_response = await self.retract_file(file_id=file_id, graph_name=graph_name)
                if retraction_response.get("status", 500) == 200:
                    if logflag:
                        logger.info(f"Successfully retracted ingested chunks for file_id={file_id} after ingestion failure.")
                    retraction_message = retraction_response.get("message", "")
                    result["message"] += f" {retraction_message}"
                else:
                    if logflag:
                        logger.error(f"Failed to retract ingested chunks for file_id={file_id} after ingestion failure.")
                    retraction_message = retraction_response.get("message", "")
                    result["message"] += f" Failed to retract ingested chunks: {retraction_message}"
            except Exception as retraction_error:
                if logflag:
                    logger.error(f"Error during retraction of ingested chunks for file_id={file_id}: {retraction_error}")
                result["message"] += f" Error during retraction of ingested chunks: {retraction_error}"
            #######################################################
            return result
        if logflag:
            logger.info(f"Get file ingestion response for {file_id}.")
        # result = {
        #     "status": 200,
        #     "success": True,
        #     "message": f"Data preparation succeeded: {graph_name}",
        #     "graph_name": {graph_name},
        # }
        result = arango_response

        if logflag:
            logger.info(result)

        return result


    def invoke(self, *args, **kwargs):
        pass

    async def get_files(self):
        """Get file structure from ArangoDB in the format of
        {
            "name": "File Name",
            "id": "File Name",
            "graph": "Graph Name",
            "type": "File",
            "parent": "",
        }"""

        res_list = []

        for graph in self.db.graphs():
            source_collection = f"{graph['name']}_SOURCE"

            query = """
                FOR chunk IN @@source_collection
                    COLLECT file_name = chunk.file_name
                    RETURN file_name
            """

            cursor = self.db.aql.execute(query, bind_vars={"@source_collection": source_collection})

            for file_name in cursor:
                res_list.append(
                    {
                        "name": decode_filename(file_name),
                        "id": decode_filename(file_name),
                        "graph": graph["name"],
                        "type": "File",
                        "parent": "",
                    }
                )

        if logflag:
            logger.info(f"[ arango get ] number of files: {len(res_list)}")

        return res_list

    async def delete_files(self, file_path: str = Body(..., embed=True)):
        """Delete a Graph according to `file_path`.

        `file_path`:
            - A specific graph name (e.g GRAPH_1)
            - "all": delete all graphs created
        """

        if file_path == "all":
            for graph in self.db.graphs():
                self.db.delete_graph(graph["name"], drop_collections=True)
        else:
            if not self.db.has_graph(file_path):
                raise HTTPException(status_code=400, detail=f"Graph {file_path} does not exist.")

            self.db.delete_graph(file_path, drop_collections=True)

        return {"status": True}

    # async def retract_file(self, file_id: str = Body(..., embed=True)):
    #     """Delete a Graph according to `file_id`, which also defines the graph name: graph_name=f"GRAPH_{payload.fileId}"
    #     """
    #     graph_name = f"GRAPH_{file_id}"

    #     if file_id == "all":
    #         for graph in self.db.graphs():
    #             self.db.delete_graph(graph["name"], drop_collections=True)
    #     else:
    #         if not self.db.has_graph(graph_name):
    #             raise HTTPException(status_code=400, detail=f"GRAPH_{file_id} does not exist.")
    #             result = {
    #                 "status": 400,
    #                 "success": False,
    #                 "message": f"Graph {graph_name} does not exist.",
    #             }
    #             return result

    #         self.db.delete_graph(graph_name, drop_collections=True)

    #     result = {
    #         "status": 200,
    #         "success": True,
    #         "message": f"Data retraction succeeded: {graph_name}",
    #         "graph_name": {graph_name},
    #     }

    #     return result
    

    async def retract_file(self, file_id: str = Body(..., embed=True), graph_name: str = Body(..., embed=True)):
        """
        Retract chunks, entities, and relations for a given file_id in a specific graph.
        """
        if logflag:
            logger.info(f"[ dataprep loader ] retract file {file_id} in graph {graph_name}")

        # 1. Find all chunk ids for this file
        cursor = self.db.aql.execute(
            f"""
            FOR s IN {graph_name}_SOURCE
                FILTER s.file_id == @file_id
                RETURN s._id
            """,
            bind_vars={"file_id": file_id}
        )
        chunk_ids = [doc for doc in cursor] # [GRAPH_TEST_SOURCE/10035803544387714385, GRAPH_TEST_SOURCE/10035803544387714385, ...]
        if logflag:
            logger.info(f"Found {len(chunk_ids)} chunks for file_id={file_id}")

        if not chunk_ids:
            if logflag:
                logger.warning(f"No chunks found for file_id={file_id}")
            # return {"status": 404, "success": False, "message": f"No chunks found for file_id={file_id}"}

        # 2. Delete those chunks
        self.db.aql.execute(
            f"""
            FOR s IN {graph_name}_SOURCE
                FILTER s.file_id == @file_id
                REMOVE s IN {graph_name}_SOURCE
            """,
            bind_vars={"file_id": file_id}
        )
        if logflag:
            logger.info(f"Deleted chunks for file_id={file_id}")

        # 3. Delete HAS_SOURCE edges pointing to deleted chunks
        self.db.aql.execute(
            f"""
            FOR e IN {graph_name}_HAS_SOURCE
                FILTER e._to IN @chunk_ids
                REMOVE e IN {graph_name}_HAS_SOURCE
            """,
            bind_vars={"chunk_ids": chunk_ids}
        )
        if logflag:
            logger.info(f"Deleted {graph_name}_HAS_SOURCE linkages for file_id={file_id}")

        # 4. Delete orphan entities (no HAS_SOURCE edges left)
        self.db.aql.execute(
            f"""
            FOR ent IN {graph_name}_ENTITY
                FILTER LENGTH(
                    FOR hs IN {graph_name}_HAS_SOURCE
                        FILTER hs._from == ent._id
                        RETURN 1
                ) == 0
                REMOVE ent IN {graph_name}_ENTITY
            """
        )
        if logflag:
            logger.info(f"Deleted orphan entities for file_id={file_id}")

        # 5. Delete orphan HAS_SOURCE edges (whose _from pointing to missing entities)
        self.db.aql.execute(
            f"""
            FOR hs IN {graph_name}_HAS_SOURCE
                FILTER !DOCUMENT(hs._from) OR !DOCUMENT(hs._to)
                REMOVE hs IN {graph_name}_HAS_SOURCE
            """
        )
        if logflag:
            logger.info(f"Deleted orphan {graph_name}_HAS_SOURCE edges for file_id={file_id}")
        
        # 6. Delete orphan LINKS_TO edges (pointing to missing entities)
        self.db.aql.execute(
            f"""
            FOR l IN {graph_name}_LINKS_TO
                FILTER NOT DOCUMENT({graph_name}_ENTITY, PARSE_IDENTIFIER(l._from).key)
                OR NOT DOCUMENT({graph_name}_ENTITY, PARSE_IDENTIFIER(l._to).key)
                REMOVE l IN {graph_name}_LINKS_TO
            """
        )
        if logflag:
            logger.info(f"Deleted orphan {graph_name}_LINKS_TO edges for file_id={file_id}")

        return {
            "status": 200,
            "success": True,
            "message": f"Data retraction succeeded for file_id={file_id}",
            "deleted_chunks": chunk_ids
        }



# if __name__ == "__main__":

#     from arango import ArangoClient

#     db = ArangoClient(hosts="http://localhost:8529").db(
#         "opea_arangodb",
#         username="root",
#         password="root",
#     )

#     graph = ArangoGraph(db=db, generate_schema_on_init=False)


#     for i, text in enumerate(chunks):
#         document = Document(page_content=text, metadata={"file_id": file_id, "file_path": path, "chunk_index": i})

#         if logflag:
#             logger.info(f"Chunk {i}: extracting nodes & relationships")

#         graph_doc = self.llm_transformer.process_response(document)

#         if logflag:
#             logger.info(f"Chunk {i}: inserting into ArangoDB")
        
#         # FYI: coming from langchain-arangodb package
#         graph.add_graph_documents( 
#             graph_documents=[graph_doc],
#             include_source=include_chunks,
#             graph_name=graph_name,
#             update_graph_definition_if_exists=False,
#             batch_size=insert_batch_size,
#             use_one_entity_collection=True,
#             insert_async=insert_async,
#             embeddings=self.embeddings,
#             embedding_field="embedding",
#             embed_source=embed_chunks,
#             embed_nodes=embed_nodes,
#             embed_relationships=embed_edges,
#             capitalization_strategy=text_capitalization_strategy,
#         )

#         if logflag:
#             logger.info(f"Chunk {i}: processed")