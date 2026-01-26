# Copyright (C) 2024 Intel Corporation
# Copyright (C) 2025 International Telecommunication Union (ITU)
# SPDX-License-Identifier: Apache-2.0
#
# This file includes modifications and extensions made by the
# International Telecommunication Union (ITU) based on the original 
# work by Intel Corporation.
import json
import os
from typing import List, Optional, Union, Dict, Any

import aiohttp
import asyncio
import base64
import requests

import openai
from arango import ArangoClient
from fastapi import Body, File, Form, HTTPException, UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_arangodb import ArangoGraph
from langchain_community.graphs.graph_document import GraphDocument, Node, Relationship
from langchain_community.embeddings import HuggingFaceHubEmbeddings
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import HTMLHeaderTextSplitter
from openai import AsyncOpenAI
from rank_bm25 import BM25Okapi

from comps import CustomLogger, DocPath, OpeaComponent, OpeaComponentRegistry, ServiceType, TextDoc

# Note:- I changed this import from api_protocol to genieai_api_protocol (David)
from comps.cores.proto.genieai_api_protocol import ArangoDBDataprepRequest, DataprepRequest, ArangoDBDataprepRequestFromDocRepo

from comps.dataprep.src.utils import ( 
    decode_filename,
    encode_filename,
    get_separators,
    get_tables_result,
    parse_html,
    save_content_to_local_disk,
)

# Note:- I replaced the genieai_dataprep_utils.py with the required imports (David)
from comps.dataprep.src.genieai_dataprep_utils import ( 
    is_valid_content,
    docling_document_loader,
    document_loader
)

from comps.dataprep.src.integrations.arangodb import OpeaArangoDataprep

# Note:- I moved this up to the import above (David)
# from comps.dataprep.src.genieai_dataprep_utils import docling_document_loader


logger = CustomLogger("GENIE_DATAPREP_ARANGODB")
logflag = os.getenv("LOGFLAG", "false").lower() == "true"


# Lebel selector prompt 
label_selector_prompt = """
<SYSTEM INSTRUCTIONS> 
Select the relevant labels from the provided list that best match the content of the input text. 
Use only the exact labels from the list. Return an empty list if none fit. 
Output must strictly follow the given JSON format. 
</SYSTEM INSTRUCTIONS>
<EXAMPLE>
Input: "The car has a hydrogen engine that uses a novel technology." 
Labels: ["sports", "innovation", "green energy", "business"] 
Output: {"labels": ["green energy", "innovation"]}
</EXAMPLE>
"""

# * Note **********************************************************
# Need to fix environment variables later to remove redundancies 
# between the original class and the custom sub-class
# Also need to remove the variables that are not used anywhere

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

# Content Extraction Configuration ("opea" or "docling") - only affects PDFs
CONTENT_EXTRACTION_METHOD = os.getenv("CONTENT_EXTRACTION_METHOD", "opea") 

# Labelling Method Configuration 
LABELING_STRATEGY = os.getenv("LABELING_STRATEGY", "bm25") 
LABEL_SELECTOR_SYSTEM_PROMPT = os.getenv("LABEL_SELECTOR_SYSTEM_PROMPT", label_selector_prompt)
EMBEDDING_LABEL_THRESHOLD = os.getenv("EMBEDDING_LABEL_THRESHOLD", "0.75")
BM25_LABEL_THRESHOLD = os.getenv("BM25_LABEL_THRESHOLD", "2.00")


@OpeaComponentRegistry.register("GENIE_DATAPREP_ARANGODB")
class GenieArangoDataprep(OpeaArangoDataprep):
    """
    Extended dataprep component with custom ingestion logic.
    Introducese the following enhancements and features:
    - Genie.AI labelling method for better RAG accuracy
    - Enhanced content extraction using Docling
    - Custom functionalitis for the Genie.AI frontend
    """

    def __init__(self, name: str, description: str, config: dict = None):
        # Call the parent constructor to initialize the base functionality
        super().__init__(name, description, config)

        # Place to add any additional attributes for GenieArangoDataprep
        self.custom_attribute = "custom_value"

    
    async def get_auth_token(self):
        """Get admin auth token"""
        response = requests.get(GET_AUTH_TOKEN_URL)
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("accessToken")
            if access_token:
                return access_token
            else:
                logger.error("Failed to retrieve access token from response.")
        else:
            logger.error(f"Failed to call /get-token. Status code: {response.status_code}")


    async def fetch_all_labels_new(self):
        """Fetch all labels from the labelling tree stored in node-service db."""

        auth_token = await self.get_auth_token()
        if not auth_token:
            logger.error("Failed to get admin auth token.")
            return ""

        url = f"{E2E_CPU_URL}/api/service-categories/categories" # NEED TO UPDATE SINCE ALL IS DEPLOYED ON GPU NOW
        headers = {"Authorization": f"Bearer {auth_token}"}
        if logflag:
            logger.debug(f"Send request to {url} with headers {headers}")

        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        labels = []
                        for item in data:
                            labels.append(item['name'])
                            labels.extend(item['children'])
                        labels = list(set(labels))
                        return labels
                    else:
                        logger.error(f"Failed to fetch labels. Status code: {response.status}")
                        return []
            except Exception as e:
                logger.error(f"Error fetching labels: {e}")
                return []


    async def generate_label_embeddings(self, labels):
        """
        Generate and return embeddings for a list of labels.
        """
        if not hasattr(self, "embeddings") or self.embeddings is None:
            self._initialize_embeddings()

        label_embeddings = self.embeddings.embed_documents(labels)
        return label_embeddings


    async def generate_chunk_embedding(self, text_chunk):
        """
        Generate and return embedding for a single text chunk.
        """
        if not hasattr(self, "embeddings") or self.embeddings is None:
            self._initialize_embeddings()

        chunk_embedding = self.embeddings.embed_query(text_chunk)
        return chunk_embedding

    
    async def _load_and_chunk_document(self, doc_path: DocPath) -> List[str]:
        """
        Load a document from disk and split it into plain text chunks.

        Returns:
            plain_chunks: List[str] -- list of chunk text strings.
            Returns an empty list on fatal error (file empty / unreadable).
        """
        path = doc_path.path
        if logflag:
            logger.debug(f"[_load_and_chunk_document] Parsing document {path}")

        # choose a sensible splitter depending on file type
        if path.endswith(".html"):
            headers_to_split_on = [("h1", "Header 1"), ("h2", "Header 2"), ("h3", "Header 3")]
            text_splitter = HTMLHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        else:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=doc_path.chunk_size,
                chunk_overlap=doc_path.chunk_overlap,
                add_start_index=True,
                separators=get_separators(),
            )

        # load content (PDFs may use docling)
        if path.endswith(".pdf") and CONTENT_EXTRACTION_METHOD == "docling":
            if logflag:
                logger.info("[_load_and_chunk_document] Using docling_document_loader for PDF")
            content = await docling_document_loader(path)
        else:
            if logflag:
                logger.info("[_load_and_chunk_document] Using document_loader")
            content = await document_loader(path)

        if logflag:
            logger.debug(f"[_load_and_chunk_document] content preview: {str(content)[:500]}...")

        # empty content -> fail early
        if isinstance(content, str) and len(content) == 0:
            logger.error(f"File {path} is empty or could not be read.")
            return []

        # handle structured types (the loader returns a list of items)
        structured_types = [".xlsx", ".csv", ".json", "jsonl", ".xls"]
        _, ext = os.path.splitext(path)

        # chunk the content
        if ext in structured_types and isinstance(content, list):
            # content already as list of string-like rows/records
            chunks: List[Any] = content
            new_chunks: List[str] = []
            for chunk in chunks:
                # some elements may already be large strings; split further if needed
                chunk_text = chunk if isinstance(chunk, str) else str(chunk)
                if len(chunk_text) > doc_path.chunk_size:
                    split_items = text_splitter.split_text(chunk_text)
                    # split_text may return list of Document-like objects or strings
                    for s in split_items:
                        new_chunks.append(s.page_content if hasattr(s, "page_content") else str(s))
                else:
                    new_chunks.append(chunk_text)
            chunks = new_chunks
        else:
            # standard text chunking path
            raw_chunks = text_splitter.split_text(content)
            # check if any chunk exceeded configured chunk size -> fall back to smaller chunk size
            too_large = False
            for c in raw_chunks:
                chunk_content = c.page_content if hasattr(c, "page_content") else str(c)
                if len(chunk_content) > doc_path.chunk_size:
                    too_large = True
                    break

            if too_large:
                # create a safer splitter (smaller chunk size) and re-split
                smaller_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=500,  # safe fallback
                    chunk_overlap=doc_path.chunk_overlap,
                    add_start_index=True,
                    separators=get_separators(),
                )
                raw_chunks = smaller_splitter.split_text(content)

            # normalize to plaintext strings
            chunks = [c.page_content if hasattr(c, "page_content") else str(c) for c in raw_chunks]

        # append extracted table chunks if requested and available
        if getattr(doc_path, "process_table", False) and path.endswith(".pdf"):
            try:
                table_chunks = get_tables_result(path, doc_path.table_strategy)
                if isinstance(table_chunks, list):
                    chunks.extend(table_chunks)
            except Exception as e:
                logger.warning(f"Failed to extract table chunks: {e}")

        # now ensure all chunks are strings
        plain_chunks: List[str] = [c if isinstance(c, str) else str(c) for c in chunks]

        if logflag:
            logger.info(f"[_load_and_chunk_document] Created {len(plain_chunks)} plain chunks.")
            if len(plain_chunks) > 0 and logflag:
                logger.debug(f"[_load_and_chunk_document] first chunk preview: {plain_chunks[0][:300]}...")

        # validate content: guard against base64/web-archive noise
        valid_chunks = 0
        for i, chunk in enumerate(plain_chunks):
            try:
                if is_valid_content(chunk):
                    valid_chunks += 1
                else:
                    logger.warning(f"Chunk {i} is not valid content (possible binary/web archive/base64).")
            except Exception as e:
                logger.warning(f"is_valid_content raised for chunk {i}: {e}")

        # Avoid division by zero
        if len(plain_chunks) == 0:
            logger.error(f"No chunks produced for file {path}.")
            return []

        valid_ratio = valid_chunks / len(plain_chunks)
        if valid_ratio < 0.2:
            logger.error(f"Less than 20% ({valid_ratio:.2f}) of chunks are valid. Aborting.")
            return []

        return plain_chunks

    async def _run_guardrail_check(self, plain_chunks: List[str]) -> Dict[str, Any]:
        """
        Send chunks to the Guardrail service (if enabled) and return a dict:
        {"success": bool, "message": str, "chunk_index": Optional[int], ...}

        If GUARDRAIL_ENABLED is False, returns {"success": True}.
        """
        guardrail_url = GUARDRAIL_URL

        if not GUARDRAIL_ENABLED:
            return {"success": True, "message": "Guardrail disabled."}

        if not guardrail_url:
            return {"success": True, "message": "Guardrail URL not configured; skipping."}

        if not guardrail_url.startswith("http://") and not guardrail_url.startswith("https://"):
            raise HTTPException(status_code=400, detail="Invalid Guardrail URL.")

        if logflag:
            logger.info(f"[_run_guardrail_check] Sending {len(plain_chunks)} chunks to Guardrail at {guardrail_url}")

        async with aiohttp.ClientSession() as session:
            for i, text in enumerate(plain_chunks):
                payload = {"text": text}
                try:
                    async with session.post(guardrail_url, json=payload, timeout=30) as resp:
                        if resp.status != 200:
                            logger.error(f"Guardrail service returned status {resp.status} for chunk {i}")
                            return {"success": False, "message": "Guardrail service error", "chunk_index": i, "http_status": resp.status}
                        result = await resp.json()
                except asyncio.TimeoutError:
                    logger.error(f"Guardrail service timed out for chunk {i}")
                    return {"success": False, "message": "Guardrail timeout", "chunk_index": i}
                except Exception as e:
                    logger.error(f"Guardrail request failed for chunk {i}: {e}")
                    return {"success": False, "message": f"Guardrail request failed: {e}", "chunk_index": i}

                # The original logic assumed the service echoes the text when safe.
                # Adjust this check to match your guardrail contract.
                # Here we keep the same semantics: if returned "text" equals input, it's safe.
                returned_text = result.get("text", "")
                if returned_text == payload.get("text", ""):
                    if logflag:
                        logger.info(f"Chunk {i} passed guardrail check.")
                    continue  # safe
                else:
                    logger.error(f"Harmful content detected in chunk {i} by guardrail.")
                    return {
                        "success": False,
                        "message": "Harmful content detected",
                        "chunk_index": i,
                        "result_text": returned_text,
                        "chunk_content": text[:1000],  # do not log full sensitive text
                    }

        # all chunks passed
        return {"success": True, "message": "All chunks passed guardrail check."}


    async def _label_chunks_llm(self, plain_chunks, all_labels):
        """Assign labels using LLM classification."""
        client = AsyncOpenAI(api_key=VLLM_API_KEY, base_url=f"{VLLM_ENDPOINT}/v1")

        async def label_chunk(i, text):
            for attempt in range(3):
                try:
                    response = await client.chat.completions.create(
                        model=VLLM_MODEL_ID,
                        messages=[
                            {"role": "system", "content": LABEL_SELECTOR_SYSTEM_PROMPT},
                            {"role": "user", "content": f"Input: {text}\nLabels: {all_labels}"}
                        ],
                    )
                    parsed = json.loads(response.choices[0].message.content)
                    if "labels" in parsed:
                        valid_labels = [l for l in parsed["labels"] if l in all_labels]
                        return {"text": text, "labels": valid_labels}
                except Exception as e:
                    logger.warning(f"Chunk {i} LLM labeling attempt {attempt+1} failed: {e}")
            return {"text": text, "labels": []}

        results = await asyncio.gather(*(label_chunk(i, t) for i, t in enumerate(plain_chunks)))
        return results


    async def _label_chunks_embedding(self, plain_chunks, all_labels):
        """Assign labels using cosine similarity of embeddings."""
        # Consider using file meta-data from document repository
        # to prepend to chunks for additional context 
        # Create an issue on GitLab for that...
        from numpy import dot
        from numpy.linalg import norm

        logger.info("Generating label embeddings...")
        label_vectors = await self.generate_label_embeddings(all_labels)

        labelled_docs = []
        for i, text in enumerate(plain_chunks):
            try:
                chunk_vector = await self.generate_chunk_embedding(text)
                similarities = [
                    dot(lv, chunk_vector) / (norm(lv) * norm(chunk_vector))
                    for lv in label_vectors
                ]
                selected_labels = [
                    label for label, score in zip(all_labels, similarities)
                    if score >= EMBEDDING_LABEL_THRESHOLD
                ]
                labelled_docs.append({"text": text, "labels": selected_labels})
            except Exception as e:
                logger.warning(f"Embedding label error in chunk {i}: {e}")
                labelled_docs.append({"text": text, "labels": []})
        return labelled_docs


    async def _label_chunks_bm25(self, plain_chunks, all_labels):
        """Assign labels to each chunk using BM25 lexical similarity."""
        from rank_bm25 import BM25Okapi
        import re

        logger.info("Initializing BM25 label model...")

        try:
            tokenized_labels = [re.findall(r"\b\w+\b", label.lower()) for label in all_labels]
            bm25 = BM25Okapi(tokenized_labels)
        except Exception as e:
            logger.warning(f"Failed to initialize BM25: {e}")
            return [{"text": c, "labels": []} for c in plain_chunks]

        labelled_docs = []
        for i, text in enumerate(plain_chunks):
            tokens = re.findall(r"\b\w+\b", text.lower())
            scores = bm25.get_scores(tokens)
            selected_labels = [l for l, s in zip(all_labels, scores) if s >= BM25_LABEL_THRESHOLD]
            labelled_docs.append({"text": text, "labels": selected_labels})
            logger.debug(f"Chunk {i} → {selected_labels}")

        return labelled_docs

    async def _label_chunks(self, plain_chunks, all_labels, labelling_method):
        if labelling_method == "bm25":
            return await self._label_chunks_bm25(plain_chunks, all_labels)
        elif labelling_method == "embedding":
            return await self._label_chunks_embedding(plain_chunks, all_labels)
        elif labelling_method == "llm":
            return await self._label_chunks_llm(plain_chunks, all_labels)
        else:
            raise ValueError(f"Unknown labelling method: {labelling_method}")

    
    async def _insert_documents_to_graph(self, graph, graph_name, labelled_documents, include_chunks=True, **kwargs):
        for i, doc in enumerate(labelled_documents):
            document = Document(
                page_content=doc["text"],
                metadata={
                    "file_id": kwargs["file_id"],
                    "file_path": kwargs["storage_path"],
                    "chunk_index": i,
                    "chunk_labels": doc["labels"],
                },
            )
            if OPENAI_CHAT_ENABLED:
                try:
                    graph_doc = self.llm_transformer.process_response(document)
                except Exception as e:
                    logger.warning(f"LLM Graph Extraction failed for chunk {i}: {e}. Falling back to chunk-only ingestion.")
                    # Fallback: Create a GraphDocument with just the source document, no extracted nodes/edges
                    graph_doc = GraphDocument(nodes=[], relationships=[], source=document)
            else:
                if logflag:
                    logger.info(f"Skipping LLM Graph Extraction for chunk {i} (OPENAI_CHAT_ENABLED=False).")
                graph_doc = GraphDocument(nodes=[], relationships=[], source=document)

            graph.add_graph_documents(
                graph_documents=[graph_doc],
                include_source=include_chunks,
                graph_name=graph_name,
                update_graph_definition_if_exists=False,
                batch_size=kwargs.get("insert_batch_size", 10),
                use_one_entity_collection=True,
                insert_async=kwargs.get("insert_async", False),
                embeddings=self.embeddings,
                embedding_field="embedding",
                embed_source=kwargs.get("embed_chunks", False),
                embed_nodes=kwargs.get("embed_nodes", False),
                embed_relationships=kwargs.get("embed_edges", False),
                capitalization_strategy=kwargs.get("text_capitalization_strategy", "none"),
            )
            logger.info(f"Chunk {i}: processed and inserted.")


    async def ingest_data_to_arango_with_guardrail(self, doc_path: DocPath, file_id: str, storage_path: str, graph_name: str, **kwargs):
        """Ingest document to ArangoDB with chunking, guardrails, labelling, and graph insertion."""

        # --- 1. Load and chunk document ---
        plain_chunks = await self._load_and_chunk_document(doc_path)
        if not plain_chunks:
            return {"success": False, "message": "No valid chunks generated."}

        # --- 2. Guardrail check ---
        if GUARDRAIL_ENABLED:
            passed = await self._run_guardrail_check(plain_chunks)
            if not passed["success"]:
                return passed

        # --- 3. Initialize graph ---
        graph = ArangoGraph(db=self.db, generate_schema_on_init=False)

        # --- 4. Apply labelling strategy ---
        labelled_documents = await self._label_chunks(
            plain_chunks=plain_chunks,
            all_labels=kwargs["all_labels"],
            labelling_method=LABELING_STRATEGY
        )

        # --- 5. Insert into ArangoDB ---
        await self._insert_documents_to_graph(
            graph, graph_name, labelled_documents, file_id=file_id, storage_path=storage_path, **kwargs
        )

        return {
            "success": True,
            "message": f"File ingested with {len(labelled_documents)} chunks.",
            "graph_name": graph_name,
            "chunk_count": len(labelled_documents),
        }

    
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
        storage_path = input.storage_path
        file_path = input.file_path
        file_type = input.file_type
        file_labels = input.file_labels
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

        self._initialize_llm(
            allowed_node_types=allowed_node_types,
            allowed_edge_types=allowed_edge_types,
            node_properties=node_properties,
            edge_properties=edge_properties,
        )
        logger.info('Initialize LLM finished.')

        logger.info(f"file to be ingested:{file_id}")

        valid_strategies = ['lower', 'upper', 'none']
        if text_capitalization_strategy not in valid_strategies:
            logger.warning(f"Invalid capitalization strategy '{text_capitalization_strategy}', defaulting to 'upper'")
            text_capitalization_strategy = 'upper'

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
                storage_path=storage_path,
                graph_name=graph_name,
                insert_async=insert_async,
                insert_batch_size=insert_batch_size,
                embed_nodes=embed_nodes,
                embed_edges=embed_edges,
                embed_chunks=embed_chunks,
                text_capitalization_strategy=text_capitalization_strategy,
                include_chunks=include_chunks,
                all_labels=all_labels,
            )
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
                    logger.info(f"Successfully retracted ingested chunks for file_id={file_id} after ingestion failure.")
                    retraction_message = retraction_response.get("message", "")
                    result["message"] += f" {retraction_message}"
                else:
                    logger.error(f"Failed to retract ingested chunks for file_id={file_id} after ingestion failure.")
                    retraction_message = retraction_response.get("message", "")
                    result["message"] += f" Failed to retract ingested chunks: {retraction_message}"
            except Exception as retraction_error:
                logger.error(f"Error during retraction of ingested chunks for file_id={file_id}: {retraction_error}")
                result["message"] += f" Error during retraction of ingested chunks: {retraction_error}"
            #######################################################
            return result
        if logflag:
            logger.info(f"Get file ingestion response for {file_id}.")

        result = arango_response

        if logflag:
            logger.info(result)

        return result


    def invoke(self, *args, **kwargs):
        pass

    
    async def retract_file(self, file_id: str = Body(..., embed=True), graph_name: str = Body(..., embed=True)):
        """
        Retract chunks, entities, and relations for a given file_id in a specific graph.
        """
        logger.info(f"[ retraction ] start to retract file {file_id} in graph {graph_name}")

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
        logger.info(f"Found {len(chunk_ids)} chunks for file_id={file_id}")

        if not chunk_ids:
            logger.warning(f"No chunks found for file_id={file_id}")

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
            logger.debug(f"Deleted chunks for file_id={file_id}")

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
            logger.debug(f"Deleted {graph_name}_HAS_SOURCE linkages for file_id={file_id}")

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
            logger.debug(f"Deleted orphan entities for file_id={file_id}")

        # 5. Delete orphan HAS_SOURCE edges (whose _from pointing to missing entities)
        self.db.aql.execute(
            f"""
            FOR hs IN {graph_name}_HAS_SOURCE
                FILTER !DOCUMENT(hs._from) OR !DOCUMENT(hs._to)
                REMOVE hs IN {graph_name}_HAS_SOURCE
            """
        )
        if logflag:
            logger.debug(f"Deleted orphan {graph_name}_HAS_SOURCE edges for file_id={file_id}")
        
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
            logger.debug(f"Deleted orphan {graph_name}_LINKS_TO edges for file_id={file_id}")

        return {
            "status": 200,
            "success": True,
            "message": f"Data retraction succeeded for file_id={file_id}",
            "deleted_chunks": chunk_ids
        }


    # async def ingest_data_to_arango_with_guardrail(
    #     self,
    #     doc_path: DocPath,
    #     file_id: str,
    #     storage_path: str,
    #     graph_name: str,
    #     insert_async: bool,
    #     insert_batch_size: int,
    #     embed_nodes: bool,
    #     embed_edges: bool,
    #     embed_chunks: bool,
    #     include_chunks: bool,
    #     text_capitalization_strategy: str,
    #     all_labels: List[str],
    # ):
    #     """Ingest document to ArangoDB."""

    #     path = doc_path.path
    #     if logflag:
    #         logger.debug(f"Parsing document {path}")

    #     labelling_method = LABELING_STRATEGY

    #     ############
    #     # Chunking #
    #     ############

    #     if path.endswith(".html"):
    #         headers_to_split_on = [
    #             ("h1", "Header 1"),
    #             ("h2", "Header 2"),
    #             ("h3", "Header 3"),
    #         ]
    #         text_splitter = HTMLHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    #     else:
    #         # Chunk size is measured by the number of characters. https://python.langchain.com/docs/how_to/recursive_text_splitter/
    #         text_splitter = RecursiveCharacterTextSplitter(
    #             chunk_size=doc_path.chunk_size,
    #             chunk_overlap=doc_path.chunk_overlap,
    #             add_start_index=True,
    #             separators=get_separators(),
    #         )

    #     logger.info(' [load document] Using document_loader to load the file content.')
        
    #     # Custom logic to extract content with Docling (only affects PDF files)
    #     if path.endswith(".pdf") and CONTENT_EXTRACTION_METHOD == "docling":
    #         content = await docling_document_loader(path) # string format
    #     else:
    #         content = await document_loader(path) # string format


    #     if logflag:
    #         logger.debug(f" [load document] Document content loaded: {content[:500]}...")
    #     if isinstance(content, str) and len(content) == 0:
    #         logger.error(f"File {path} is empty or could not be read.")
    #         return {
    #             "success": False,
    #             "message": f"File {path} is empty or could not be read.",
    #         }

    #     structured_types = [".xlsx", ".csv", ".json", "jsonl", ".xls"]
    #     _, ext = os.path.splitext(path)

    #     logger.info(' [document chunking] Start to chunk file content.')
    #     if ext in structured_types:
    #         chunks = content # type of chunks is list <class 'list'>
    #         new_chunks = []
    #         for chunk in chunks:
    #             if len(chunk) > doc_path.chunk_size:
    #                 split_items = text_splitter.split_text(chunk)
    #                 new_chunks.extend(split_items)
    #             else:
    #                 new_chunks.append(chunk)
    #         chunks = new_chunks
    #     else:
    #         chunks = text_splitter.split_text(content) 
    #         for chunk in chunks:
    #             chunk_content = chunk.page_content if hasattr(chunk, "page_content") else str(chunk)
    #             if len(chunk_content) > doc_path.chunk_size:
    #                 text_splitter = RecursiveCharacterTextSplitter(
    #                     chunk_size=500,  # Adjusted to avoid token length issues by using the RecursiveCharacterTextSplitter
    #                     chunk_overlap=doc_path.chunk_overlap,
    #                     add_start_index=True,
    #                     separators=get_separators(),
    #                 )
    #                 break
    #         chunks = text_splitter.split_text(content)
    #         # By expanding the max_model_len of vllm and setting the chunk size to 500, we can guarantee that using text_splitter will get proper chunks that won't cause token lenth limit issues.

    #     if doc_path.process_table and path.endswith(".pdf"):
    #         table_chunks = get_tables_result(path, doc_path.table_strategy)
    #         if isinstance(table_chunks, list):
    #             chunks = chunks + table_chunks

    #     logger.info(f"Created {len(chunks)} chunks of the original file")
    #     if len(chunks) > 0:
    #         if logflag:
    #             logger.debug(f" [document chunking] Chunks: {chunks[0]}...")
        
    #     plain_chunks = [
    #         c.page_content if hasattr(c, "page_content") else str(c)
    #         for c in chunks
    #     ]

    #     # Validate chunk content to make sure it is not web archive content
    #     valid_chunks = 0
    #     for i, chunk in enumerate(plain_chunks):
    #         if is_valid_content(chunk):
    #             valid_chunks += 1
    #         else:
    #             logger.warning(f"Chunk {i} is not valid content and might contain base64 codes or web archive content.")
    #     if valid_chunks / len(plain_chunks) < 0.2:
    #         if logflag:
    #             logger.error("Less than 20 percent of the chunks are valid. Please check the file content to remove any base64 codes or web archive content.")
    #         return {
    #             "success": False,
    #             "message": f"Less than 20% of the content are valid. Please check the file content to remove any potential base64 codes or web archive content."
    #         }

    #     ################################
    #     # Guardrail check for chunks   #
    #     ################################

    #     guardrail_url = GUARDRAIL_URL

    #     if GUARDRAIL_ENABLED and guardrail_url:
    #         if logflag:
    #             logger.info("Guardrail service is enabled, checking chunks for harmful content.")

    #         # Ensure the guardrail URL is valid
    #         if not guardrail_url.startswith("http://") and not guardrail_url.startswith("https://"):
    #             raise HTTPException(status_code=400, detail="Invalid Guardrail URL.")

    #         # Check each chunk for harmful content
    #         if logflag:
    #             logger.info(f"Sending {len(plain_chunks)} chunks to Guardrail service at {guardrail_url}")

    #         async with aiohttp.ClientSession() as session:
    #             for i, text in enumerate(plain_chunks):
    #                 payload = {"text": text} # Adjust based on actual guardrail prompt template 
    #                 async with session.post(guardrail_url, json=payload) as resp:
    #                     if resp.status != 200:
    #                         logger.error(f"Guardrail service error on chunk {i}")
    #                         return {
    #                             "success": False,
    #                             "message": f"Guardrail service error on chunk {i}",
    #                             "chunk_index": i,
    #                         }
    #                     result = await resp.json()
    #                     if result.get("text", "") == payload.get("text", ""):
    #                         # safe
    #                         if logflag:
    #                             logger.info(f"Chunk {i} passed guardrail check.")
    #                     else:
    #                         logger.error(f"Harmful content detected in chunk {i}")
    #                         return {
    #                             "success": False,
    #                             "message": f"Harmful content detected in chunk {i}",
    #                             "result": result.get("text", ""),
    #                             "chunk_index": i,
    #                             "chunk_content": text,
    #                         }


    #     ################################
    #     # Graph generation & insertion #
    #     ################################

    #     if logflag:
    #         logger.info(f"Creating graph {graph_name}.")

    #     graph = ArangoGraph(db=self.db, generate_schema_on_init=False)
    #     logger.info(f"Graph object: {graph}")
    #     logger.info(f"Graph db: {str(self.db)}")

    #     client = AsyncOpenAI(api_key=VLLM_API_KEY, base_url=f"{VLLM_ENDPOINT}/v1") #############################

    

    #     ############## Generate chunk labels ##############

    #     if labelling_method == 'llm':

    #         # Change chunks into plain_chunks
    #         for i, text in enumerate(plain_chunks):
    #             if logflag:
    #                 logger.info(f"Processing chunk {i}/{len(plain_chunks)}")
    #                 logger.debug(f"Chunk content: {text}")

    #             # Run llm-based labelling 
    #             labelling_time = 0
    #             logger.info("Labelling the chunk using 'llm' method...")
    #             while labelling_time < 3:
    #                 response = await client.chat.completions.create(
    #                     model=VLLM_MODEL_ID,
    #                     messages=[
    #                         {"role": "system", "content": "You are a label selector. Your sole purpose is to classify content by selecting labels from a predefined list. You are strictly forbidden from generating any labels not included in the provided list."},
    #                         {"role": "user", "content": f"Select one or more labels from the provided labels list that best describe the input content. If no labels from the list are a good fit, return an empty list. Don't treat capitalized words as labels. DO NOT CREATE NEW LABELS. \nInput: {text} \nLabels: {all_labels} \n Your output should be in this format: {{\"labels\": [\"label1\", \"label2\", ...]}}"},
    #                     ],
    #                 )
    #                 raw_text = response.choices[0].message.content
    #                 labelling_time += 1
    #                 try:
    #                     chunk_labels = json.loads(raw_text)
    #                     if "labels" in chunk_labels and isinstance(chunk_labels['labels'], list):
    #                         all_fit = all(item in all_labels for item in chunk_labels['labels'])
    #                         if all_fit:
    #                             if logflag:
    #                                 logger.debug(f"Chunk {i} labelled with: {chunk_labels['labels']}")
    #                                 break
    #                         else:
    #                             logger.warning(f"Chunk {i} labelling returned some invalid labels: {chunk_labels['labels']}, retrying...")
    #                             chunk_labels = {"labels": []} # reset to empty list
    #                     else:
    #                         logger.warning(f"Chunk {i} labelling did not return a list of labels, retrying...")
    #                         chunk_labels = {"labels": []} # reset to empty list
    #                 except json.JSONDecodeError as e:
    #                     logger.warning(f"Chunk {i} labelling JSON decode error: {e}, retrying...")
    #                     chunk_labels = {"labels": []} # reset to empty list
                
    #             try:
    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": chunk_labels.get("labels", [])
    #                         }
    #                 )
    #             except:
    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_labels": [],
    #                         "chunk_index": i,
    #                         }
    #                 )
                
    #             logger.info(f"Chunk {i}: extracting nodes & relationships")

    #             graph_doc = self.llm_transformer.process_response(document)

    #             logger.info(f"Chunk {i}: inserting into ArangoDB")
                
    #             # FYI: coming from langchain-arangodb package
    #             graph.add_graph_documents( 
    #                 graph_documents=[graph_doc],
    #                 include_source=include_chunks,
    #                 graph_name=graph_name,
    #                 update_graph_definition_if_exists=False,
    #                 batch_size=insert_batch_size,
    #                 use_one_entity_collection=True,
    #                 insert_async=insert_async,
    #                 embeddings=self.embeddings,
    #                 embedding_field="embedding",
    #                 embed_source=embed_chunks,
    #                 embed_nodes=embed_nodes,
    #                 embed_relationships=embed_edges,
    #                 capitalization_strategy=text_capitalization_strategy,
    #             )

    #             logger.info(f"Chunk {i}: processed")

            
    #     if labelling_method == 'embedding':

    #         try:
    #             logger.info("Generating label embeddings...")
    #             label_vectors = await self.generate_label_embeddings(all_labels)
    #             logger.info(f"Generated {len(label_vectors)} embeddings")
    #         except Exception as e:
    #             logger.warning(f"Failed to generate label embeddings: {e}")
    #             logger.warning(f"Proceeding with empty list. Consider re-ingesting the document using a different labelling strategy.")
    #             for i, text in enumerate(plain_chunks):
    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": []
    #                         }
    #                 )

    #         for i, text in enumerate(plain_chunks):
    #             if logflag:
    #                 logger.info(f"Processing chunk {i}/{len(plain_chunks)}")
    #                 logger.debug(f"Chunk content: {text}")

    #             try:
    #                 chunk_vector = await self.generate_chunk_embedding(text)
    #                 logger.info("Chunk embedding generated")
    #                 logger.info("Computing cosine simularity...")

    #                 selected_labels = []

    #                 for index, vector in enumerate(label_vectors):
    #                     cosine_similarity = dot(vector, chunk_vector) / (norm(vector) * norm(chunk_vector))
    #                     if cosine_simularity > EMBEDDING_LABEL_THRESHOLD:
    #                         selected_lables.append(all_labels[index])

    #                 logger.info(f"Chunk {i} labelled with: {selected_labels}")

    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": selected_labels
    #                         }
    #                 )

    #             except Exception as e:
    #                 logger.info(f"Failed to assigne labels to chunk: {e}")
    #                 logger.warning(f"Proceeding with empty list. Consider re-ingesting the document using a different labelling strategy.")
    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": []
    #                         }
    #                 )

    #             logger.info(f"Chunk {i}: extracting nodes & relationships")

    #             graph_doc = self.llm_transformer.process_response(document)

    #             logger.info(f"Chunk {i}: inserting into ArangoDB")
                
    #             # FYI: coming from langchain-arangodb package
    #             graph.add_graph_documents( 
    #                 graph_documents=[graph_doc],
    #                 include_source=include_chunks,
    #                 graph_name=graph_name,
    #                 update_graph_definition_if_exists=False,
    #                 batch_size=insert_batch_size,
    #                 use_one_entity_collection=True,
    #                 insert_async=insert_async,
    #                 embeddings=self.embeddings,
    #                 embedding_field="embedding",
    #                 embed_source=embed_chunks,
    #                 embed_nodes=embed_nodes,
    #                 embed_relationships=embed_edges,
    #                 capitalization_strategy=text_capitalization_strategy,
    #             )

    #             logger.info(f"Chunk {i}: processed")

                
    #     if labelling_method == 'bm25':

    #         try:
    #             logger.info("Tokenizing labels with BM25...")
    #             tokenized_labels = []
    #             for label in all_labels:
    #                 tokenized_label = re.findall(r"\b\w+\b", label.lower())
    #                 tokenized_labels.append(tokenized_label)
    #             logger.info(f"Generated {len(tokenized_labels)} tokens")
            
    #         except Exception as e:
    #             logger.warning(f"Failed to generate label tokens: {e}")
    #             logger.warning(f"Proceeding with empty list. Consider re-ingesting the document using a different labelling strategy.")
    #             for i, text in enumerate(plain_chunks):
    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": []
    #                         }
    #                 )

    #         for i, text in enumerate(plain_chunks):
    #             if logflag:
    #                 logger.info(f"Processing chunk {i}/{len(plain_chunks)}")
    #                 logger.debug(f"Chunk content: {text}")

    #             try:
    #                 bm25 = BM25Okapi(tokenized_labels)
    #                 tokenized_chunk = re.findall(r"\b\w+\b", text.lower())
    #                 scores = bm25.get_scores(tokenized_chunk)

    #                 selected_labels = [label for label, score in zip(all_labels, scores) if score >= BM25_LABEL_THRESHOLD]

    #                 logger.info(f"Chunk {i} labelled with: {selected_labels}")

    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": selected_labels
    #                         }
    #                 )

    #             except Exception as e:
    #                 logger.info(f"Failed to generate assign labels to chunk: {e}")
    #                 logger.warning(f"Proceeding with empty list. Consider re-ingesting the document using a different labelling strategy.")
    #                 document = Document(
    #                     page_content=text, 
    #                     metadata={
    #                         "file_id": file_id, 
    #                         "file_path": storage_path,
    #                         "chunk_index": i,
    #                         "chunk_labels": []
    #                         }
    #                 )
                
    #             logger.info(f"Chunk {i}: extracting nodes & relationships")

    #             graph_doc = self.llm_transformer.process_response(document)

    #             logger.info(f"Chunk {i}: inserting into ArangoDB")
                
    #             # FYI: coming from langchain-arangodb package
    #             graph.add_graph_documents( 
    #                 graph_documents=[graph_doc],
    #                 include_source=include_chunks,
    #                 graph_name=graph_name,
    #                 update_graph_definition_if_exists=False,
    #                 batch_size=insert_batch_size,
    #                 use_one_entity_collection=True,
    #                 insert_async=insert_async,
    #                 embeddings=self.embeddings,
    #                 embedding_field="embedding",
    #                 embed_source=embed_chunks,
    #                 embed_nodes=embed_nodes,
    #                 embed_relationships=embed_edges,
    #                 capitalization_strategy=text_capitalization_strategy,
    #             )

    #             logger.info(f"Chunk {i}: processed")



    #     logger.info(f"Graph {graph_name} created with {len(plain_chunks)} chunks.")
        
    #     chunk_count = len(plain_chunks)

    #     return {
    #         "success": True,
    #         "message": f"File ingested with {chunk_count} chunks.",
    #         "graph_name": graph_name,
    #         "chunk_count": chunk_count,
    #     }


    # async def ingest_file_with_guardrail(self, input: ArangoDBDataprepRequestFromDocRepo):
    #     """Ingest files/links content into ArangoDB database.

    #     Save in the format of vector[768].
    #     Returns '{"status": 200, "message": "Data preparation succeeded"}' if successful.
    #     Args:
    #         input (ArangoDBDataprepRequestFromDocRepo): Model containing the following parameters:
    #             file_id: The ID of the file to be ingested from the document repository.
    #             file_path: file storage path on local disk.
    #             files (Union[UploadFile, List[UploadFile]], optional): A file or a list of files to be ingested. Defaults to File(None).
    #             link_list (str, optional): A list of links to be ingested. Defaults to Form(None).
    #             chunk_size (int, optional): The size of the chunks to be split. Defaults to Form(500).
    #             chunk_overlap (int, optional): The overlap between chunks. Defaults to Form(100).
    #             process_table (bool, optional): Whether to process tables in PDFs. Defaults to Form(False).
    #             table_strategy (str, optional): The strategy to process tables in PDFs. Defaults to Form("fast").
    #             graph_name (str, optional): The name of the graph to be created. Defaults to "GRAPH".
    #             insert_async (bool, optional): Whether to insert data asynchronously. Defaults to False.
    #             insert_batch_size (int, optional): The batch size for insertion. Defaults to 1000.
    #             embed_nodes (bool, optional): Whether to embed nodes. Defaults to True.
    #             embed_edges (bool, optional): Whether to embed edges. Defaults to True.
    #             embed_chunks (bool, optional): Whether to embed chunks. Defaults to True.
    #             allowed_node_types (List[str], optional): The allowed node types. Defaults to [].
    #             allowed_edge_types (List[str], optional): The allowed edge types. Defaults to [].
    #             node_properties (List[str], optional): The node properties to be used. Defaults to ["description"].
    #             edge_properties (List[str], optional): The edge properties to be used. Defaults to ["description"].
    #             text_capitalization_strategy (str, optional): The text capitalization strategy. Defaults to "upper".
    #             include_chunks (bool, optional): Whether to include chunks in the graph. Defaults to True.
    #     """
    #     file_id = input.file_id
    #     file_name = input.file_name
    #     storage_path = input.storage_path
    #     file_path = input.file_path
    #     file_type = input.file_type
    #     file_labels = input.file_labels
    #     upload_date = input.upload_date
    #     chunk_size = input.chunk_size
    #     chunk_overlap = input.chunk_overlap
    #     process_table = input.process_table
    #     table_strategy = input.table_strategy
    #     graph_name = getattr(input, "graph_name", ARANGO_GRAPH_NAME) # It tries to get the attribute graph_name from the object input. If input has a graph_name attribute, its value is used. If not, it uses the value of ARANGO_GRAPH_NAME as a default.
    #     insert_async = getattr(input, "insert_async", ARANGO_INSERT_ASYNC)
    #     insert_batch_size = getattr(input, "insert_batch_size", ARANGO_BATCH_SIZE)
    #     embed_nodes = getattr(input, "embed_nodes", EMBED_NODES)
    #     embed_edges = getattr(input, "embed_edges", EMBED_EDGES)
    #     embed_chunks = getattr(input, "embed_chunks", EMBED_CHUNKS)
    #     allowed_node_types = getattr(input, "allowed_node_types", ALLOWED_NODE_TYPES)
    #     allowed_edge_types = getattr(input, "allowed_edge_types", ALLOWED_EDGE_TYPES)
    #     node_properties = getattr(input, "node_properties", NODE_PROPERTIES)
    #     edge_properties = getattr(input, "edge_properties", EDGE_PROPERTIES)
    #     text_capitalization_strategy = getattr(input, "text_capitalization_strategy", TEXT_CAPITALIZATION_STRATEGY)
    #     include_chunks = getattr(input, "include_chunks", INCLUDE_CHUNKS)

    #     all_labels = await self.fetch_all_labels_new()
    #     if logflag:
    #         logger.info(f"all_labels from node-service:{all_labels}")

    #     self._initialize_llm(
    #         allowed_node_types=allowed_node_types,
    #         allowed_edge_types=allowed_edge_types,
    #         node_properties=node_properties,
    #         edge_properties=edge_properties,
    #     )
    #     logger.info('Initialize LLM finished.')

    #     logger.info(f"file to be ingested:{file_id}")

    #     valid_strategies = ['lower', 'upper', 'none']
    #     if text_capitalization_strategy not in valid_strategies:
    #         logger.warning(f"Invalid capitalization strategy '{text_capitalization_strategy}', defaulting to 'upper'")
    #         text_capitalization_strategy = 'upper'

    #     try:
    #         arango_response = await self.ingest_data_to_arango_with_guardrail(
    #             DocPath(
    #                 path=file_path,
    #                 chunk_size=chunk_size,
    #                 chunk_overlap=chunk_overlap,
    #                 process_table=process_table,
    #                 table_strategy=table_strategy,
    #             ),
    #             file_id=file_id,
    #             storage_path=storage_path,
    #             graph_name=graph_name,
    #             insert_async=insert_async,
    #             insert_batch_size=insert_batch_size,
    #             embed_nodes=embed_nodes,
    #             embed_edges=embed_edges,
    #             embed_chunks=embed_chunks,
    #             text_capitalization_strategy=text_capitalization_strategy,
    #             include_chunks=include_chunks,
    #             all_labels=all_labels,
    #         )
    #     except Exception as e:
    #         raise HTTPException(status_code=500, detail=f"Failed to ingest {file_id} into ArangoDB: {e}")
    #         result = {
    #             "status": 500,
    #             "success": False,
    #             "message": f"Failed to ingest {file_id} into ArangoDB: {e}",
    #         }
    #         ###### Delete ingested chunks if error happens ########
    #         try:
    #             retraction_response = await self.retract_file(file_id=file_id, graph_name=graph_name)
    #             if retraction_response.get("status", 500) == 200:
    #                 logger.info(f"Successfully retracted ingested chunks for file_id={file_id} after ingestion failure.")
    #                 retraction_message = retraction_response.get("message", "")
    #                 result["message"] += f" {retraction_message}"
    #             else:
    #                 logger.error(f"Failed to retract ingested chunks for file_id={file_id} after ingestion failure.")
    #                 retraction_message = retraction_response.get("message", "")
    #                 result["message"] += f" Failed to retract ingested chunks: {retraction_message}"
    #         except Exception as retraction_error:
    #             logger.error(f"Error during retraction of ingested chunks for file_id={file_id}: {retraction_error}")
    #             result["message"] += f" Error during retraction of ingested chunks: {retraction_error}"
    #         #######################################################
    #         return result
    #     if logflag:
    #         logger.info(f"Get file ingestion response for {file_id}.")

    #     result = arango_response

    #     if logflag:
    #         logger.info(result)

    #     return result


    # def invoke(self, *args, **kwargs):
    #     pass

    # async def get_files(self):
    #     """Get file structure from ArangoDB in the format of
    #     {
    #         "name": "File Name",
    #         "id": "File Name",
    #         "graph": "Graph Name",
    #         "type": "File",
    #         "parent": "",
    #     }"""

    #     res_list = []

    #     for graph in self.db.graphs():
    #         source_collection = f"{graph['name']}_SOURCE"

    #         query = """
    #             FOR chunk IN @@source_collection
    #                 COLLECT file_name = chunk.file_name
    #                 RETURN file_name
    #         """

    #         cursor = self.db.aql.execute(query, bind_vars={"@source_collection": source_collection})

    #         for file_name in cursor:
    #             res_list.append(
    #                 {
    #                     "name": decode_filename(file_name),
    #                     "id": decode_filename(file_name),
    #                     "graph": graph["name"],
    #                     "type": "File",
    #                     "parent": "",
    #                 }
    #             )

    #     if logflag:
    #         logger.info(f"[ arango get ] number of files: {len(res_list)}")

    #     return res_list

    # async def delete_files(self, file_path: str = Body(..., embed=True)):
    #     """Delete a Graph according to `file_path`.

    #     `file_path`:
    #         - A specific graph name (e.g GRAPH_1)
    #         - "all": delete all graphs created
    #     """

    #     if file_path == "all":
    #         for graph in self.db.graphs():
    #             self.db.delete_graph(graph["name"], drop_collections=True)
    #     else:
    #         if not self.db.has_graph(file_path):
    #             raise HTTPException(status_code=400, detail=f"Graph {file_path} does not exist.")

    #         self.db.delete_graph(file_path, drop_collections=True)

    #     return {"status": True}

    

    # async def retract_file(self, file_id: str = Body(..., embed=True), graph_name: str = Body(..., embed=True)):
    #     """
    #     Retract chunks, entities, and relations for a given file_id in a specific graph.
    #     """
    #     logger.info(f"[ retraction ] start to retract file {file_id} in graph {graph_name}")

    #     # 1. Find all chunk ids for this file
    #     cursor = self.db.aql.execute(
    #         f"""
    #         FOR s IN {graph_name}_SOURCE
    #             FILTER s.file_id == @file_id
    #             RETURN s._id
    #         """,
    #         bind_vars={"file_id": file_id}
    #     )
    #     chunk_ids = [doc for doc in cursor] # [GRAPH_TEST_SOURCE/10035803544387714385, GRAPH_TEST_SOURCE/10035803544387714385, ...]
    #     logger.info(f"Found {len(chunk_ids)} chunks for file_id={file_id}")

    #     if not chunk_ids:
    #         logger.warning(f"No chunks found for file_id={file_id}")

    #     # 2. Delete those chunks
    #     self.db.aql.execute(
    #         f"""
    #         FOR s IN {graph_name}_SOURCE
    #             FILTER s.file_id == @file_id
    #             REMOVE s IN {graph_name}_SOURCE
    #         """,
    #         bind_vars={"file_id": file_id}
    #     )
    #     if logflag:
    #         logger.debug(f"Deleted chunks for file_id={file_id}")

    #     # 3. Delete HAS_SOURCE edges pointing to deleted chunks
    #     self.db.aql.execute(
    #         f"""
    #         FOR e IN {graph_name}_HAS_SOURCE
    #             FILTER e._to IN @chunk_ids
    #             REMOVE e IN {graph_name}_HAS_SOURCE
    #         """,
    #         bind_vars={"chunk_ids": chunk_ids}
    #     )
    #     if logflag:
    #         logger.debug(f"Deleted {graph_name}_HAS_SOURCE linkages for file_id={file_id}")

    #     # 4. Delete orphan entities (no HAS_SOURCE edges left)
    #     self.db.aql.execute(
    #         f"""
    #         FOR ent IN {graph_name}_ENTITY
    #             FILTER LENGTH(
    #                 FOR hs IN {graph_name}_HAS_SOURCE
    #                     FILTER hs._from == ent._id
    #                     RETURN 1
    #             ) == 0
    #             REMOVE ent IN {graph_name}_ENTITY
    #         """
    #     )
    #     if logflag:
    #         logger.debug(f"Deleted orphan entities for file_id={file_id}")

    #     # 5. Delete orphan HAS_SOURCE edges (whose _from pointing to missing entities)
    #     self.db.aql.execute(
    #         f"""
    #         FOR hs IN {graph_name}_HAS_SOURCE
    #             FILTER !DOCUMENT(hs._from) OR !DOCUMENT(hs._to)
    #             REMOVE hs IN {graph_name}_HAS_SOURCE
    #         """
    #     )
    #     if logflag:
    #         logger.debug(f"Deleted orphan {graph_name}_HAS_SOURCE edges for file_id={file_id}")
        
    #     # 6. Delete orphan LINKS_TO edges (pointing to missing entities)
    #     self.db.aql.execute(
    #         f"""
    #         FOR l IN {graph_name}_LINKS_TO
    #             FILTER NOT DOCUMENT({graph_name}_ENTITY, PARSE_IDENTIFIER(l._from).key)
    #             OR NOT DOCUMENT({graph_name}_ENTITY, PARSE_IDENTIFIER(l._to).key)
    #             REMOVE l IN {graph_name}_LINKS_TO
    #         """
    #     )
    #     if logflag:
    #         logger.debug(f"Deleted orphan {graph_name}_LINKS_TO edges for file_id={file_id}")

    #     return {
    #         "status": 200,
    #         "success": True,
    #         "message": f"Data retraction succeeded for file_id={file_id}",
    #         "deleted_chunks": chunk_ids
    #     }






################################################################################################
### OLD CODE (MODIFIED ARANGODB.PY) ############################################################
################################################################################################
# import json
# import os
# from typing import List, Optional, Union

# import aiohttp
# import base64
# import requests

# import openai
# from arango import ArangoClient
# from fastapi import Body, File, Form, HTTPException, UploadFile
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_arangodb import ArangoGraph
# from langchain_community.embeddings import HuggingFaceHubEmbeddings
# from langchain_core.documents import Document
# from langchain_core.embeddings import Embeddings
# from langchain_core.prompts import ChatPromptTemplate
# from langchain_experimental.graph_transformers import LLMGraphTransformer
# from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_openai import ChatOpenAI, OpenAIEmbeddings
# from langchain_text_splitters import HTMLHeaderTextSplitter
# from openai import AsyncOpenAI

# from comps import CustomLogger, DocPath, OpeaComponent, OpeaComponentRegistry, ServiceType, TextDoc
# from comps.cores.proto.api_protocol import ArangoDBDataprepRequest, DataprepRequest, ArangoDBDataprepRequestFromDocRepo
# from comps.dataprep.src.utils import (
#     decode_filename,
#     document_loader,
#     encode_filename,
#     get_separators,
#     get_tables_result,
#     parse_html,
#     save_content_to_local_disk,
#     is_valid_content
# )

# logger = CustomLogger("OPEA_DATAPREP_ARANGODB")
# logflag = os.getenv("LOGFLAG", "false").lower() == "true"

# # E2E CPU configuration
# E2E_CPU_URL = os.getenv("E2E_CPU_URL", "http://91.203.132.51:3000")

# # ArangoDB configuration
# ARANGO_URL = os.getenv("ARANGO_URL", "http://localhost:8529")
# ARANGO_DB_NAME = os.getenv("ARANGO_DB_NAME", "_system")
# ARANGO_USERNAME = os.getenv("ARANGO_USERNAME", "root")
# ARANGO_PASSWORD = os.getenv("ARANGO_PASSWORD", "test")

# # ArangoDB graph configuration
# ARANGO_INSERT_ASYNC = os.getenv("ARANGO_INSERT_ASYNC", "false").lower() == "true"
# ARANGO_BATCH_SIZE = int(os.getenv("ARANGO_BATCH_SIZE", 1000))
# ARANGO_GRAPH_NAME = os.getenv("ARANGO_GRAPH_NAME", "GRAPH_TEST")

# # VLLM configuration
# VLLM_API_KEY = os.getenv("VLLM_API_KEY", "EMPTY")
# VLLM_ENDPOINT = os.getenv("VLLM_ENDPOINT", "http://localhost:80")
# VLLM_MODEL_ID = os.getenv("VLLM_MODEL_ID", "Intel/neural-chat-7b-v3-3")
# VLLM_MAX_NEW_TOKENS = int(os.getenv("VLLM_MAX_NEW_TOKENS", 512))
# VLLM_TOP_P = float(os.getenv("VLLM_TOP_P", 0.9))
# VLLM_TEMPERATURE =float(os.getenv("VLLM_TEMPERATURE", 0.8))
# VLLM_TIMEOUT = int(os.getenv("VLLM_TIMEOUT", 600))

# # TEI configuration
# TEI_EMBEDDING_ENDPOINT = os.getenv("TEI_EMBEDDING_ENDPOINT")
# TEI_EMBED_MODEL = os.getenv("TEI_EMBED_MODEL", "BAAI/bge-base-en-v1.5")
# HUGGINGFACEHUB_API_TOKEN = os.getenv("HUGGINGFACEHUB_API_TOKEN")
# EMBED_NODES = os.getenv("EMBED_NODES", "true").lower() == "true"
# EMBED_EDGES = os.getenv("EMBED_EDGES", "true").lower() == "true"
# EMBED_CHUNKS = os.getenv("EMBED_CHUNKS", "true").lower() == "true"

# # Guardrail configuration
# GUARDRAIL_URL = os.getenv("GUARDRAIL_URL", "http://guardrail:9090/v1/guardrails")
# GUARDRAIL_ENABLED = os.getenv("GUARDRAIL_ENABLED", "false").lower() == "true"

# # Document repository configuration
# DOC_REPO_URL = os.getenv("DOC_REPO_URL", "http://localhost:3001")
# GET_AUTH_TOKEN_URL = os.getenv("GET_AUTH_TOKEN_URL", "http://http-service:6666/get-token")

# # OpenAI configuration (alternative to TEI/VLLM)
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
# OPENAI_EMBED_DIMENSION = int(os.getenv("OPENAI_EMBED_DIMENSION", '512'))
# OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o")
# OPENAI_CHAT_TEMPERATURE = float(os.getenv("OPENAI_CHAT_TEMPERATURE", '0'))
# OPENAI_CHAT_ENABLED = os.getenv("OPENAI_CHAT_ENABLED", "true").lower() == "true"
# OPENAI_EMBED_ENABLED = os.getenv("OPENAI_EMBED_ENABLED", "true").lower() == "true"

# # LLM/Graph Transformer configuration
# SYSTEM_PROMPT_PATH = os.getenv("SYSTEM_PROMPT_PATH")
# ALLOWED_NODE_TYPES = os.getenv("ALLOWED_NODE_TYPES", "").split(",") if os.getenv("ALLOWED_NODE_TYPES") else []
# ALLOWED_EDGE_TYPES = os.getenv("ALLOWED_EDGE_TYPES", "").split(",") if os.getenv("ALLOWED_EDGE_TYPES") else []
# NODE_PROPERTIES = os.getenv("NODE_PROPERTIES", "description").split(",")
# EDGE_PROPERTIES = os.getenv("EDGE_PROPERTIES", "description").split(",")
# TEXT_CAPITALIZATION_STRATEGY = os.getenv("TEXT_CAPITALIZATION_STRATEGY", "upper")
# INCLUDE_CHUNKS = os.getenv("INCLUDE_CHUNKS", "true").lower() == "true"


# @OpeaComponentRegistry.register("OPEA_DATAPREP_ARANGODB")
# class OpeaArangoDataprep(OpeaComponent):
#     """Dataprep component for ArangoDB ingestion and search services."""

#     def __init__(self, name: str, description: str, config: dict = None):
#         super().__init__(name, ServiceType.DATAPREP.name.lower(), description, config)
#         self.upload_folder = "./uploaded_files/"

#         self.llm_transformer: LLMGraphTransformer
#         self.embeddings: Embeddings

#         self._initialize_embeddings()
#         self._initialize_client()

#         if not self.check_health():
#             logger.error("OpeaArangoDataprep health check failed.")

#     def _initialize_llm(
#         self,
#         allowed_node_types: Union[List[str], str],
#         allowed_edge_types: Union[List[str], str],
#         node_properties: Union[List[str], str],
#         edge_properties: Union[List[str], str],
#     ):
#         """Initialize the LLM model & LLMGraphTransformer object."""

#         # Process string inputs if needed
#         if allowed_node_types and isinstance(allowed_node_types, str):
#             allowed_node_types = allowed_node_types.split(",")

#         if allowed_edge_types and isinstance(allowed_edge_types, str):
#             allowed_edge_types = allowed_edge_types.split(",")

#         if node_properties and isinstance(node_properties, str):
#             node_properties = node_properties.split(",")

#         if edge_properties and isinstance(edge_properties, str):
#             edge_properties = edge_properties.split(",")

#         prompt_template = None
#         if SYSTEM_PROMPT_PATH is not None:
#             try:
#                 with open(SYSTEM_PROMPT_PATH, "r") as f:
#                     prompt_template = ChatPromptTemplate.from_messages(
#                         [
#                             ("system", f.read()),
#                             (
#                                 "human",
#                                 (
#                                     "Tip: Make sure to answer in the correct format and do "
#                                     "not include any explanations. "
#                                     "Use the given format to extract information from the "
#                                     "following input: {input}"
#                                 ),
#                             ),
#                         ]
#                     )
#             except Exception as e:
#                 logger.error(f"Could not set custom Prompt: {e}")

#         ignore_tool_usage = False

#         if OPENAI_API_KEY and OPENAI_CHAT_ENABLED:
#             if logflag:
#                 logger.info("OpenAI API Key is set. Verifying its validity...")
#             openai.api_key = OPENAI_API_KEY

#             try:
#                 openai.models.list()
#                 if logflag:
#                     logger.info("OpenAI API Key is valid.")
#                 llm = ChatOpenAI(temperature=OPENAI_CHAT_TEMPERATURE, model_name=OPENAI_CHAT_MODEL)
#             except openai.error.AuthenticationError:
#                 if logflag:
#                     logger.info("OpenAI API Key is invalid.")
#             except Exception as e:
#                 logger.error(f"An error occurred while verifying the API Key: {e}")
#         elif VLLM_ENDPOINT:
#             llm = ChatOpenAI(
#                 openai_api_key=VLLM_API_KEY,
#                 openai_api_base=f"{VLLM_ENDPOINT}/v1",
#                 model=VLLM_MODEL_ID,
#                 temperature=VLLM_TEMPERATURE,
#                 max_tokens=VLLM_MAX_NEW_TOKENS,
#                 top_p=VLLM_TOP_P,
#                 timeout=VLLM_TIMEOUT,
#             )
#             ignore_tool_usage = True
#         else:
#             raise HTTPException(status_code=400, detail="No LLM environment variables are set, cannot generate graphs.")

#         try:
#             self.llm_transformer = LLMGraphTransformer(
#                 llm=llm,
#                 allowed_nodes=allowed_node_types,
#                 allowed_relationships=allowed_edge_types,
#                 prompt=prompt_template,
#                 node_properties=node_properties or False,
#                 relationship_properties=edge_properties or False,
#                 ignore_tool_usage=ignore_tool_usage,
#             )
#         except (TypeError, ValueError) as e:
#             logger.warning(f"Advanced LLMGraphTransformer failed: {e}")
#             # Fall back to basic config
#             try:
#                 self.llm_transformer = LLMGraphTransformer(llm=llm, ignore_tool_usage=ignore_tool_usage)
#             except (TypeError, ValueError) as e:
#                 logger.error(f"Failed to initialize LLMGraphTransformer: {e}")
#                 raise HTTPException(status_code=500, detail=f"Failed to initialize LLMGraphTransformer: {e}")

#     def _initialize_embeddings(self):
#         """Initialize the embeddings model."""
#         if TEI_EMBED_MODEL:
#             self.embeddings = HuggingFaceEmbeddings(model_name=TEI_EMBED_MODEL)
#             if logflag:
#                 logger.debug("Using HuggingFaceEmbeddings for embeddings.")
#         else:
#             raise HTTPException(
#                 status_code=400, detail="No embeddings environment variables are set, cannot generate embeddings."
#             )

#     def _initialize_client(self):
#         """Initialize the ArangoDB connection."""

#         self.client = ArangoClient(hosts=ARANGO_URL)
#         sys_db = self.client.db(name="_system", username=ARANGO_USERNAME, password=ARANGO_PASSWORD, verify=True)

#         if not sys_db.has_database(ARANGO_DB_NAME):
#             sys_db.create_database(ARANGO_DB_NAME)

#         self.db = self.client.db(name=ARANGO_DB_NAME, username=ARANGO_USERNAME, password=ARANGO_PASSWORD, verify=True)
#         logger.info(f"Connected to ArangoDB {self.db.version()}. Database: {ARANGO_DB_NAME}")

#     def check_health(self) -> bool:
#         """Checks the health of the retriever service."""

#         if logflag:
#             logger.info("[ check health ] start to check health of ArangoDB")
#         try:
#             version = self.db.version()
#             if logflag:
#                 logger.info(f"[ check health ] Successfully connected to ArangoDB {version}! Database: {ARANGO_DB_NAME}")
#             return True
#         except Exception as e:
#             logger.info(f"[ check health ] Failed to connect to ArangoDB: {e}")
#             return False

#     async def ingest_data_to_arango(
#         self,
#         doc_path: DocPath,
#         graph_name: str,
#         insert_async: bool,
#         insert_batch_size: int,
#         embed_nodes: bool,
#         embed_edges: bool,
#         embed_chunks: bool,
#         include_chunks: bool,
#         text_capitalization_strategy: str,
#     ):
#         """Ingest document to ArangoDB."""

#         path = doc_path.path
#         if logflag:
#             logger.info(f"Parsing document {path}")

#         ############
#         # Chunking #
#         ############

#         if path.endswith(".html"):
#             headers_to_split_on = [
#                 ("h1", "Header 1"),
#                 ("h2", "Header 2"),
#                 ("h3", "Header 3"),
#             ]
#             text_splitter = HTMLHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
#         else:
#             text_splitter = RecursiveCharacterTextSplitter(
#                 chunk_size=doc_path.chunk_size,
#                 chunk_overlap=doc_path.chunk_overlap,
#                 add_start_index=True,
#                 separators=get_separators(),
#             )

#         content = await document_loader(path)

#         structured_types = [".xlsx", ".csv", ".json", "jsonl"]
#         _, ext = os.path.splitext(path)

#         if ext in structured_types:
#             chunks = content
#         else:
#             chunks = text_splitter.split_text(content)

#         if doc_path.process_table and path.endswith(".pdf"):
#             table_chunks = get_tables_result(path, doc_path.table_strategy)
#             if isinstance(table_chunks, list):
#                 chunks = chunks + table_chunks

#         if logflag:
#             logger.info(f"Created {len(chunks)} chunks of the original file")

#         ################################
#         # Graph generation & insertion #
#         ################################

#         if logflag:
#             logger.info(f"Creating graph {graph_name}.")

#         graph = ArangoGraph(db=self.db, generate_schema_on_init=False)

#         for i, text in enumerate(chunks):
#             document = Document(page_content=text, metadata={"file_name": path, "chunk_index": i})

#             if logflag:
#                 logger.info(f"Chunk {i}: extracting nodes & relationships")

#             graph_doc = self.llm_transformer.process_response(document)

#             if logflag:
#                 logger.info(f"Chunk {i}: inserting into ArangoDB")

#             graph.add_graph_documents(
#                 graph_documents=[graph_doc],
#                 include_source=include_chunks,
#                 graph_name=graph_name,
#                 update_graph_definition_if_exists=False,
#                 batch_size=insert_batch_size,
#                 use_one_entity_collection=True,
#                 insert_async=insert_async,
#                 embeddings=self.embeddings,
#                 embedding_field="embedding",
#                 embed_source=embed_chunks,
#                 embed_nodes=embed_nodes,
#                 embed_relationships=embed_edges,
#                 capitalization_strategy=text_capitalization_strategy,
#             )

#             if logflag:
#                 logger.info(f"Chunk {i}: processed")

#         if logflag:
#             logger.info(f"Graph {graph_name} created with {len(chunks)} chunks.")

#         return graph_name

#     async def ingest_files(self, input: Union[DataprepRequest, ArangoDBDataprepRequest]):
#         """Default OPEA file ingestion method.
#         Ingest files/links content into ArangoDB database.

#         Save in the format of vector[768].
#         Returns '{"status": 200, "message": "Data preparation succeeded"}' if successful.
#         Args:
#             input (DataprepRequest | ArangoDBDataprepRequest): Model containing the following parameters:
#                 files (Union[UploadFile, List[UploadFile]], optional): A file or a list of files to be ingested. Defaults to File(None).
#                 link_list (str, optional): A list of links to be ingested. Defaults to Form(None).
#                 chunk_size (int, optional): The size of the chunks to be split. Defaults to Form(500).
#                 chunk_overlap (int, optional): The overlap between chunks. Defaults to Form(100).
#                 process_table (bool, optional): Whether to process tables in PDFs. Defaults to Form(False).
#                 table_strategy (str, optional): The strategy to process tables in PDFs. Defaults to Form("fast").
#                 graph_name (str, optional): The name of the graph to be created. Defaults to "GRAPH".
#                 insert_async (bool, optional): Whether to insert data asynchronously. Defaults to False.
#                 insert_batch_size (int, optional): The batch size for insertion. Defaults to 1000.
#                 embed_nodes (bool, optional): Whether to embed nodes. Defaults to True.
#                 embed_edges (bool, optional): Whether to embed edges. Defaults to True.
#                 embed_chunks (bool, optional): Whether to embed chunks. Defaults to True.
#                 allowed_node_types (List[str], optional): The allowed node types. Defaults to [].
#                 allowed_edge_types (List[str], optional): The allowed edge types. Defaults to [].
#                 node_properties (List[str], optional): The node properties to be used. Defaults to ["description"].
#                 edge_properties (List[str], optional): The edge properties to be used. Defaults to ["description"].
#                 text_capitalization_strategy (str, optional): The text capitalization strategy. Defaults to "upper".
#                 include_chunks (bool, optional): Whether to include chunks in the graph. Defaults to True.
#         """

#         files = input.files
#         link_list = input.link_list
#         chunk_size = input.chunk_size
#         chunk_overlap = input.chunk_overlap
#         process_table = input.process_table
#         table_strategy = input.table_strategy
#         graph_name = getattr(input, "graph_name", ARANGO_GRAPH_NAME)
#         insert_async = getattr(input, "insert_async", ARANGO_INSERT_ASYNC)
#         insert_batch_size = getattr(input, "insert_batch_size", ARANGO_BATCH_SIZE)
#         embed_nodes = getattr(input, "embed_nodes", EMBED_NODES)
#         embed_edges = getattr(input, "embed_edges", EMBED_EDGES)
#         embed_chunks = getattr(input, "embed_chunks", EMBED_CHUNKS)
#         allowed_node_types = getattr(input, "allowed_node_types", ALLOWED_NODE_TYPES)
#         allowed_edge_types = getattr(input, "allowed_edge_types", ALLOWED_EDGE_TYPES)
#         node_properties = getattr(input, "node_properties", NODE_PROPERTIES)
#         edge_properties = getattr(input, "edge_properties", EDGE_PROPERTIES)
#         text_capitalization_strategy = getattr(input, "text_capitalization_strategy", TEXT_CAPITALIZATION_STRATEGY)
#         include_chunks = getattr(input, "include_chunks", INCLUDE_CHUNKS)

#         self._initialize_llm(
#             allowed_node_types=allowed_node_types,
#             allowed_edge_types=allowed_edge_types,
#             node_properties=node_properties,
#             edge_properties=edge_properties,
#         )

#         if logflag:
#             logger.info(f"files:{files}")
#             logger.info(f"link_list:{link_list}")

#         if not files and not link_list:
#             raise HTTPException(status_code=400, detail="Must provide either a file or a string list.")

#         graph_names_created = set()

#         if files:
#             if not isinstance(files, list):
#                 files = [files]
#             uploaded_files = []
#             for file in files:
#                 encode_file = encode_filename(file.filename)
#                 save_path = self.upload_folder + encode_file
#                 await save_content_to_local_disk(save_path, file)
#                 try:
#                     graph_name = await self.ingest_data_to_arango(
#                         DocPath(
#                             path=save_path,
#                             chunk_size=chunk_size,
#                             chunk_overlap=chunk_overlap,
#                             process_table=process_table,
#                             table_strategy=table_strategy,
#                         ),
#                         graph_name=graph_name,
#                         insert_async=insert_async,
#                         insert_batch_size=insert_batch_size,
#                         embed_nodes=embed_nodes,
#                         embed_edges=embed_edges,
#                         embed_chunks=embed_chunks,
#                         text_capitalization_strategy=text_capitalization_strategy,
#                         include_chunks=include_chunks
#                     )

#                     uploaded_files.append(save_path)
#                     graph_names_created.add(graph_name)
#                 except Exception as e:
#                     raise HTTPException(status_code=500, detail=f"Failed to ingest {save_path} into ArangoDB: {e}")

#                 if logflag:
#                     logger.info(f"Successfully saved file {save_path}")

#         if link_list:
#             link_list = json.loads(link_list)  # Parse JSON string to list
#             if not isinstance(link_list, list):
#                 raise HTTPException(status_code=400, detail="link_list should be a list.")
#             for link in link_list:
#                 encoded_link = encode_filename(link)
#                 save_path = self.upload_folder + encoded_link + ".txt"
#                 content = parse_html([link])[0][0]
#                 await save_content_to_local_disk(save_path, content)
#                 try:
#                     graph_name = await self.ingest_data_to_arango(
#                         DocPath(
#                             path=save_path,
#                             chunk_size=chunk_size,
#                             chunk_overlap=chunk_overlap,
#                             process_table=process_table,
#                             table_strategy=table_strategy,
#                         ),
#                         graph_name=graph_name,
#                         insert_async=insert_async,
#                         insert_batch_size=insert_batch_size,
#                         embed_nodes=embed_nodes,
#                         embed_edges=embed_edges,
#                         embed_chunks=embed_chunks,
#                         text_capitalization_strategy=text_capitalization_strategy,
#                         include_chunks=include_chunks,
#                     )
#                     graph_names_created.add(graph_name)
#                 except Exception as e:
#                     raise HTTPException(status_code=500, detail=f"Failed to ingest {save_path} into ArangoDB: {e}")

#                 if logflag:
#                     logger.info(f"Successfully saved link {link}")

#         result = {
#             "status": 200,
#             "message": f"Data preparation succeeded: {graph_names_created}",
#             "graph_names": list(graph_names_created),
#         }

#         if logflag:
#             logger.info(result)

#         return result


#     async def fetch_all_labels(self): # Unused now but might be helpful for more complicated labelling system
#         """Not used for the current label management. Might be helpful for more complicated labelling system.
#         Fetch all labels from the document repository."""

#         url = f"{DOC_REPO_URL}/api/labels?"
#         headers = {"Authorization": f"Bearer {DOC_REPO_AUTH_TOKEN}"}
#         async with aiohttp.ClientSession() as session:
#             try:
#                 async with session.get(url, headers=headers) as response:
#                     if response.status == 200:
#                         data = await response.json()
#                         labels = data.get("labels", [])
#                         return labels
#                     else:
#                         logger.error(f"Failed to fetch labels. Status code: {response.status}")
#                         return []
#             except Exception as e:
#                 logger.error(f"Error fetching labels: {e}")
#                 return []
    
#     async def create_new_label(self, label_info: Optional[dict] = None): # Unused now but might be helpful for more complicated labelling system
#         """Not used for the current label management. Might be helpful for more complicated labelling system.
#         Create llm-generated labels in the document repository."""
        
#         if label_info is None:
#             if logflag:
#                 logger.error("No label information provided.")
#             return {"status": 400, "message": "No label information provided."}

#         url = f"{DOC_REPO_URL}/api/labels"
#         headers = {
#             "Content-Type": "application/json",
#             "Authorization": f"Bearer {DOC_REPO_AUTH_TOKEN}",
#         }

#         async with aiohttp.ClientSession() as session:
#             try:
#                 async with session.post(url, json=label_info, headers=headers) as response:
#                     if response.status == 201:
#                         data = await response.json()
#                         return {"status": 201, "message": "Label created successfully.", "data": data}
#                     else:
#                         if logflag:
#                             logger.error(f"Failed to create label. Status code: {response.status}")
#                         return {"status": response.status, "message": "Failed to create label."}
#             except Exception as e:
#                 if logflag:
#                     logger.error(f"Error creating label: {e}")
#                 return {"status": 500, "message": f"Error creating label: {e}"}

#     async def get_auth_token(self):
#         """Get admin auth token"""
#         response = requests.get(GET_AUTH_TOKEN_URL)
#         if response.status_code == 200:
#             data = response.json()
#             access_token = data.get("accessToken")
#             if access_token:
#                 return access_token
#             else:
#                 logger.error("Failed to retrieve access token from response.")
#         else:
#             logger.error(f"Failed to call /get-token. Status code: {response.status_code}")


#     async def fetch_all_labels_new(self):
#         """Fetch all labels from the labelling tree stored in node-service db."""

#         auth_token = await self.get_auth_token()
#         if not auth_token:
#             logger.error("Failed to get admin auth token.")
#             return ""

#         url = f"{E2E_CPU_URL}/api/service-categories/categories"
#         headers = {"Authorization": f"Bearer {auth_token}"}
#         if logflag:
#             logger.debug(f"Send request to {url} with headers {headers}")

#         async with aiohttp.ClientSession() as session:
#             try:
#                 async with session.get(url, headers=headers) as response:
#                     if response.status == 200:
#                         data = await response.json()
#                         labels = []
#                         for item in data:
#                             labels.append(item['name'])
#                             labels.extend(item['children'])
#                         labels = list(set(labels))
#                         return labels
#                     else:
#                         logger.error(f"Failed to fetch labels. Status code: {response.status}")
#                         return []
#             except Exception as e:
#                 logger.error(f"Error fetching labels: {e}")
#                 return []



#     async def ingest_data_to_arango_with_guardrail(
#         self,
#         doc_path: DocPath,
#         file_id: str,
#         storage_path: str,
#         graph_name: str,
#         insert_async: bool,
#         insert_batch_size: int,
#         embed_nodes: bool,
#         embed_edges: bool,
#         embed_chunks: bool,
#         include_chunks: bool,
#         text_capitalization_strategy: str,
#         all_labels: List[str],
#     ):
#         """Ingest document to ArangoDB."""

#         path = doc_path.path
#         if logflag:
#             logger.debug(f"Parsing document {path}")

#         ############
#         # Chunking #
#         ############

#         if path.endswith(".html"):
#             headers_to_split_on = [
#                 ("h1", "Header 1"),
#                 ("h2", "Header 2"),
#                 ("h3", "Header 3"),
#             ]
#             text_splitter = HTMLHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
#         else:
#             # Chunk size is measured by the number of characters. https://python.langchain.com/docs/how_to/recursive_text_splitter/
#             text_splitter = RecursiveCharacterTextSplitter(
#                 chunk_size=doc_path.chunk_size,
#                 chunk_overlap=doc_path.chunk_overlap,
#                 add_start_index=True,
#                 separators=get_separators(),
#             )

#         logger.info(' [load document] Using document_loader to load the file content.')
#         content = await document_loader(path) # Here content is a string
#         if logflag:
#             logger.debug(f" [load document] Document content loaded: {content[:500]}...")
#         if isinstance(content, str) and len(content) == 0:
#             logger.error(f"File {path} is empty or could not be read.")
#             return {
#                 "success": False,
#                 "message": f"File {path} is empty or could not be read.",
#             }

#         structured_types = [".xlsx", ".csv", ".json", "jsonl", ".xls"]
#         _, ext = os.path.splitext(path)

#         logger.info(' [document chunking] Start to chunk file content.')
#         if ext in structured_types:
#             chunks = content # type of chunks is list <class 'list'>
#             new_chunks = []
#             for chunk in chunks:
#                 if len(chunk) > doc_path.chunk_size:
#                     split_items = text_splitter.split_text(chunk)
#                     new_chunks.extend(split_items)
#                 else:
#                     new_chunks.append(chunk)
#             chunks = new_chunks
#         else:
#             chunks = text_splitter.split_text(content) 
#             for chunk in chunks:
#                 chunk_content = chunk.page_content if hasattr(chunk, "page_content") else str(chunk)
#                 if len(chunk_content) > doc_path.chunk_size:
#                     text_splitter = RecursiveCharacterTextSplitter(
#                         chunk_size=500,  # Adjusted to avoid token length issues by using the RecursiveCharacterTextSplitter
#                         chunk_overlap=doc_path.chunk_overlap,
#                         add_start_index=True,
#                         separators=get_separators(),
#                     )
#                     break
#             chunks = text_splitter.split_text(content)
#             # By expanding the max_model_len of vllm and setting the chunk size to 500, we can guarantee that using text_splitter will get proper chunks that won't cause token lenth limit issues.

#         if doc_path.process_table and path.endswith(".pdf"):
#             table_chunks = get_tables_result(path, doc_path.table_strategy)
#             if isinstance(table_chunks, list):
#                 chunks = chunks + table_chunks

#         logger.info(f"Created {len(chunks)} chunks of the original file")
#         if len(chunks) > 0:
#             if logflag:
#                 logger.debug(f" [document chunking] Chunks: {chunks[0]}...")
        
#         plain_chunks = [
#             c.page_content if hasattr(c, "page_content") else str(c)
#             for c in chunks
#         ]

#         # Validate chunk content to make sure it is not web archive content
#         valid_chunks = 0
#         for i, chunk in enumerate(plain_chunks):
#             if is_valid_content(chunk):
#                 valid_chunks += 1
#             else:
#                 logger.warning(f"Chunk {i} is not valid content and might contain base64 codes or web archive content.")
#         if valid_chunks / len(plain_chunks) < 0.2:
#             if logflag:
#                 logger.error("Less than 20 percent of the chunks are valid. Please check the file content to remove any base64 codes or web archive content.")
#             return {
#                 "success": False,
#                 "message": f"Less than 20% of the content are valid. Please check the file content to remove any potential base64 codes or web archive content."
#             }

#         ################################
#         # Guardrail check for chunks   #
#         ################################

#         guardrail_url = GUARDRAIL_URL

#         if GUARDRAIL_ENABLED and guardrail_url:
#             if logflag:
#                 logger.info("Guardrail service is enabled, checking chunks for harmful content.")

#             # Ensure the guardrail URL is valid
#             if not guardrail_url.startswith("http://") and not guardrail_url.startswith("https://"):
#                 raise HTTPException(status_code=400, detail="Invalid Guardrail URL.")

#             # Check each chunk for harmful content
#             if logflag:
#                 logger.info(f"Sending {len(plain_chunks)} chunks to Guardrail service at {guardrail_url}")

#             async with aiohttp.ClientSession() as session:
#                 for i, text in enumerate(plain_chunks):
#                     payload = {"text": text} # Adjust based on actual guardrail prompt template 
#                     async with session.post(guardrail_url, json=payload) as resp:
#                         if resp.status != 200:
#                             logger.error(f"Guardrail service error on chunk {i}")
#                             return {
#                                 "success": False,
#                                 "message": f"Guardrail service error on chunk {i}",
#                                 "chunk_index": i,
#                             }
#                         result = await resp.json()
#                         if result.get("text", "") == payload.get("text", ""):
#                             # safe
#                             if logflag:
#                                 logger.info(f"Chunk {i} passed guardrail check.")
#                         else:
#                             logger.error(f"Harmful content detected in chunk {i}")
#                             return {
#                                 "success": False,
#                                 "message": f"Harmful content detected in chunk {i}",
#                                 "result": result.get("text", ""),
#                                 "chunk_index": i,
#                                 "chunk_content": text,
#                             }


#         ################################
#         # Graph generation & insertion #
#         ################################

#         if logflag:
#             logger.info(f"Creating graph {graph_name}.")

#         graph = ArangoGraph(db=self.db, generate_schema_on_init=False)
#         logger.info(f"Graph object: {graph}")
#         logger.info(f"Graph db: {str(self.db)}")

#         client = AsyncOpenAI(api_key=VLLM_API_KEY, base_url=f"{VLLM_ENDPOINT}/v1") #############################

#         # Change chunks into plain_chunks
#         for i, text in enumerate(plain_chunks):
#             if logflag:
#                 logger.info(f"Processing chunk {i}/{len(plain_chunks)}")
#                 logger.debug(f"Chunk content: {text}")

#             ############## Generate chunk labels ##############
#             labelling_time = 0
#             logger.info("Start to label the chunk...")
#             while labelling_time < 20:
#                 response = await client.chat.completions.create(
#                     model=VLLM_MODEL_ID,
#                     messages=[
#                         {"role": "system", "content": "You are a label selector. Your sole purpose is to classify content by selecting labels from a predefined list. You are strictly forbidden from generating any labels not included in the provided list."},
#                         {"role": "user", "content": f"Select one or more labels from the provided labels list that best describe the input content. If no labels from the list are a good fit, return an empty list. Don't treat capitalized words as labels. DO NOT CREATE NEW LABELS. \nInput: {text} \nLabels: {all_labels} \n Your output should be in this format: {{\"labels\": [\"label1\", \"label2\", ...]}}"},
#                     ],
#                 )
#                 raw_text = response.choices[0].message.content
#                 labelling_time += 1
#                 try:
#                     chunk_labels = json.loads(raw_text)
#                     if "labels" in chunk_labels and isinstance(chunk_labels['labels'], list):
#                         all_fit = all(item in all_labels for item in chunk_labels['labels'])
#                         if all_fit:
#                             if logflag:
#                                 logger.debug(f"Chunk {i} labelled with: {chunk_labels['labels']}")
#                                 break
#                         else:
#                             logger.warning(f"Chunk {i} labelling returned some invalid labels: {chunk_labels['labels']}, retrying...")
#                             chunk_labels = {"labels": []} # reset to empty list
#                     else:
#                         logger.warning(f"Chunk {i} labelling did not return a list of labels, retrying...")
#                         chunk_labels = {"labels": []} # reset to empty list
#                 except json.JSONDecodeError as e:
#                     logger.warning(f"Chunk {i} labelling JSON decode error: {e}, retrying...")
#                     chunk_labels = {"labels": []} # reset to empty list
            
#             try:
#                 document = Document(
#                     page_content=text, 
#                     metadata={
#                         "file_id": file_id, 
#                         "file_path": storage_path,
#                         "chunk_index": i,
#                         "chunk_labels": chunk_labels.get("labels", [])
#                         }
#                 )
#             except:
#                 document = Document(
#                     page_content=text, 
#                     metadata={
#                         "file_id": file_id, 
#                         "file_path": storage_path,
#                         "chunk_labels": [],
#                         "chunk_index": i,
#                         }
#                 )

#             logger.info(f"Chunk {i}: extracting nodes & relationships")

#             graph_doc = self.llm_transformer.process_response(document)

#             logger.info(f"Chunk {i}: inserting into ArangoDB")
            
#             # FYI: coming from langchain-arangodb package
#             graph.add_graph_documents( 
#                 graph_documents=[graph_doc],
#                 include_source=include_chunks,
#                 graph_name=graph_name,
#                 update_graph_definition_if_exists=False,
#                 batch_size=insert_batch_size,
#                 use_one_entity_collection=True,
#                 insert_async=insert_async,
#                 embeddings=self.embeddings,
#                 embedding_field="embedding",
#                 embed_source=embed_chunks,
#                 embed_nodes=embed_nodes,
#                 embed_relationships=embed_edges,
#                 capitalization_strategy=text_capitalization_strategy,
#             )

#             logger.info(f"Chunk {i}: processed")

#         logger.info(f"Graph {graph_name} created with {len(plain_chunks)} chunks.")
        
#         chunk_count = len(plain_chunks)

#         return {
#             "success": True,
#             "message": f"File ingested with {chunk_count} chunks.",
#             "graph_name": graph_name,
#             "chunk_count": chunk_count,
#         }


#     async def ingest_file_with_guardrail(self, input: ArangoDBDataprepRequestFromDocRepo):
#         """Ingest files/links content into ArangoDB database.

#         Save in the format of vector[768].
#         Returns '{"status": 200, "message": "Data preparation succeeded"}' if successful.
#         Args:
#             input (ArangoDBDataprepRequestFromDocRepo): Model containing the following parameters:
#                 file_id: The ID of the file to be ingested from the document repository.
#                 file_path: file storage path on local disk.
#                 files (Union[UploadFile, List[UploadFile]], optional): A file or a list of files to be ingested. Defaults to File(None).
#                 link_list (str, optional): A list of links to be ingested. Defaults to Form(None).
#                 chunk_size (int, optional): The size of the chunks to be split. Defaults to Form(500).
#                 chunk_overlap (int, optional): The overlap between chunks. Defaults to Form(100).
#                 process_table (bool, optional): Whether to process tables in PDFs. Defaults to Form(False).
#                 table_strategy (str, optional): The strategy to process tables in PDFs. Defaults to Form("fast").
#                 graph_name (str, optional): The name of the graph to be created. Defaults to "GRAPH".
#                 insert_async (bool, optional): Whether to insert data asynchronously. Defaults to False.
#                 insert_batch_size (int, optional): The batch size for insertion. Defaults to 1000.
#                 embed_nodes (bool, optional): Whether to embed nodes. Defaults to True.
#                 embed_edges (bool, optional): Whether to embed edges. Defaults to True.
#                 embed_chunks (bool, optional): Whether to embed chunks. Defaults to True.
#                 allowed_node_types (List[str], optional): The allowed node types. Defaults to [].
#                 allowed_edge_types (List[str], optional): The allowed edge types. Defaults to [].
#                 node_properties (List[str], optional): The node properties to be used. Defaults to ["description"].
#                 edge_properties (List[str], optional): The edge properties to be used. Defaults to ["description"].
#                 text_capitalization_strategy (str, optional): The text capitalization strategy. Defaults to "upper".
#                 include_chunks (bool, optional): Whether to include chunks in the graph. Defaults to True.
#         """
#         file_id = input.file_id
#         file_name = input.file_name
#         storage_path = input.storage_path
#         file_path = input.file_path
#         file_type = input.file_type
#         file_labels = input.file_labels
#         upload_date = input.upload_date
#         chunk_size = input.chunk_size
#         chunk_overlap = input.chunk_overlap
#         process_table = input.process_table
#         table_strategy = input.table_strategy
#         graph_name = getattr(input, "graph_name", ARANGO_GRAPH_NAME) # It tries to get the attribute graph_name from the object input. If input has a graph_name attribute, its value is used. If not, it uses the value of ARANGO_GRAPH_NAME as a default.
#         insert_async = getattr(input, "insert_async", ARANGO_INSERT_ASYNC)
#         insert_batch_size = getattr(input, "insert_batch_size", ARANGO_BATCH_SIZE)
#         embed_nodes = getattr(input, "embed_nodes", EMBED_NODES)
#         embed_edges = getattr(input, "embed_edges", EMBED_EDGES)
#         embed_chunks = getattr(input, "embed_chunks", EMBED_CHUNKS)
#         allowed_node_types = getattr(input, "allowed_node_types", ALLOWED_NODE_TYPES)
#         allowed_edge_types = getattr(input, "allowed_edge_types", ALLOWED_EDGE_TYPES)
#         node_properties = getattr(input, "node_properties", NODE_PROPERTIES)
#         edge_properties = getattr(input, "edge_properties", EDGE_PROPERTIES)
#         text_capitalization_strategy = getattr(input, "text_capitalization_strategy", TEXT_CAPITALIZATION_STRATEGY)
#         include_chunks = getattr(input, "include_chunks", INCLUDE_CHUNKS)

#         all_labels = await self.fetch_all_labels_new()
#         if logflag:
#             logger.info(f"all_labels from node-service:{all_labels}")

#         self._initialize_llm(
#             allowed_node_types=allowed_node_types,
#             allowed_edge_types=allowed_edge_types,
#             node_properties=node_properties,
#             edge_properties=edge_properties,
#         )
#         logger.info('Initialize LLM finished.')

#         logger.info(f"file to be ingested:{file_id}")

#         valid_strategies = ['lower', 'upper', 'none']
#         if text_capitalization_strategy not in valid_strategies:
#             logger.warning(f"Invalid capitalization strategy '{text_capitalization_strategy}', defaulting to 'upper'")
#             text_capitalization_strategy = 'upper'

#         try:
#             arango_response = await self.ingest_data_to_arango_with_guardrail(
#                 DocPath(
#                     path=file_path,
#                     chunk_size=chunk_size,
#                     chunk_overlap=chunk_overlap,
#                     process_table=process_table,
#                     table_strategy=table_strategy,
#                 ),
#                 file_id=file_id,
#                 storage_path=storage_path,
#                 graph_name=graph_name,
#                 insert_async=insert_async,
#                 insert_batch_size=insert_batch_size,
#                 embed_nodes=embed_nodes,
#                 embed_edges=embed_edges,
#                 embed_chunks=embed_chunks,
#                 text_capitalization_strategy=text_capitalization_strategy,
#                 include_chunks=include_chunks,
#                 all_labels=all_labels,
#             )
#         except Exception as e:
#             raise HTTPException(status_code=500, detail=f"Failed to ingest {file_id} into ArangoDB: {e}")
#             result = {
#                 "status": 500,
#                 "success": False,
#                 "message": f"Failed to ingest {file_id} into ArangoDB: {e}",
#             }
#             ###### Delete ingested chunks if error happens ########
#             try:
#                 retraction_response = await self.retract_file(file_id=file_id, graph_name=graph_name)
#                 if retraction_response.get("status", 500) == 200:
#                     logger.info(f"Successfully retracted ingested chunks for file_id={file_id} after ingestion failure.")
#                     retraction_message = retraction_response.get("message", "")
#                     result["message"] += f" {retraction_message}"
#                 else:
#                     logger.error(f"Failed to retract ingested chunks for file_id={file_id} after ingestion failure.")
#                     retraction_message = retraction_response.get("message", "")
#                     result["message"] += f" Failed to retract ingested chunks: {retraction_message}"
#             except Exception as retraction_error:
#                 logger.error(f"Error during retraction of ingested chunks for file_id={file_id}: {retraction_error}")
#                 result["message"] += f" Error during retraction of ingested chunks: {retraction_error}"
#             #######################################################
#             return result
#         if logflag:
#             logger.info(f"Get file ingestion response for {file_id}.")

#         result = arango_response

#         if logflag:
#             logger.info(result)

#         return result


#     def invoke(self, *args, **kwargs):
#         pass

#     async def get_files(self):
#         """Get file structure from ArangoDB in the format of
#         {
#             "name": "File Name",
#             "id": "File Name",
#             "graph": "Graph Name",
#             "type": "File",
#             "parent": "",
#         }"""

#         res_list = []

#         for graph in self.db.graphs():
#             source_collection = f"{graph['name']}_SOURCE"

#             query = """
#                 FOR chunk IN @@source_collection
#                     COLLECT file_name = chunk.file_name
#                     RETURN file_name
#             """

#             cursor = self.db.aql.execute(query, bind_vars={"@source_collection": source_collection})

#             for file_name in cursor:
#                 res_list.append(
#                     {
#                         "name": decode_filename(file_name),
#                         "id": decode_filename(file_name),
#                         "graph": graph["name"],
#                         "type": "File",
#                         "parent": "",
#                     }
#                 )

#         if logflag:
#             logger.info(f"[ arango get ] number of files: {len(res_list)}")

#         return res_list

#     async def delete_files(self, file_path: str = Body(..., embed=True)):
#         """Delete a Graph according to `file_path`.

#         `file_path`:
#             - A specific graph name (e.g GRAPH_1)
#             - "all": delete all graphs created
#         """

#         if file_path == "all":
#             for graph in self.db.graphs():
#                 self.db.delete_graph(graph["name"], drop_collections=True)
#         else:
#             if not self.db.has_graph(file_path):
#                 raise HTTPException(status_code=400, detail=f"Graph {file_path} does not exist.")

#             self.db.delete_graph(file_path, drop_collections=True)

#         return {"status": True}

    

#     async def retract_file(self, file_id: str = Body(..., embed=True), graph_name: str = Body(..., embed=True)):
#         """
#         Retract chunks, entities, and relations for a given file_id in a specific graph.
#         """
#         logger.info(f"[ retraction ] start to retract file {file_id} in graph {graph_name}")

#         # 1. Find all chunk ids for this file
#         cursor = self.db.aql.execute(
#             f"""
#             FOR s IN {graph_name}_SOURCE
#                 FILTER s.file_id == @file_id
#                 RETURN s._id
#             """,
#             bind_vars={"file_id": file_id}
#         )
#         chunk_ids = [doc for doc in cursor] # [GRAPH_TEST_SOURCE/10035803544387714385, GRAPH_TEST_SOURCE/10035803544387714385, ...]
#         logger.info(f"Found {len(chunk_ids)} chunks for file_id={file_id}")

#         if not chunk_ids:
#             logger.warning(f"No chunks found for file_id={file_id}")

#         # 2. Delete those chunks
#         self.db.aql.execute(
#             f"""
#             FOR s IN {graph_name}_SOURCE
#                 FILTER s.file_id == @file_id
#                 REMOVE s IN {graph_name}_SOURCE
#             """,
#             bind_vars={"file_id": file_id}
#         )
#         if logflag:
#             logger.debug(f"Deleted chunks for file_id={file_id}")

#         # 3. Delete HAS_SOURCE edges pointing to deleted chunks
#         self.db.aql.execute(
#             f"""
#             FOR e IN {graph_name}_HAS_SOURCE
#                 FILTER e._to IN @chunk_ids
#                 REMOVE e IN {graph_name}_HAS_SOURCE
#             """,
#             bind_vars={"chunk_ids": chunk_ids}
#         )
#         if logflag:
#             logger.debug(f"Deleted {graph_name}_HAS_SOURCE linkages for file_id={file_id}")

#         # 4. Delete orphan entities (no HAS_SOURCE edges left)
#         self.db.aql.execute(
#             f"""
#             FOR ent IN {graph_name}_ENTITY
#                 FILTER LENGTH(
#                     FOR hs IN {graph_name}_HAS_SOURCE
#                         FILTER hs._from == ent._id
#                         RETURN 1
#                 ) == 0
#                 REMOVE ent IN {graph_name}_ENTITY
#             """
#         )
#         if logflag:
#             logger.debug(f"Deleted orphan entities for file_id={file_id}")

#         # 5. Delete orphan HAS_SOURCE edges (whose _from pointing to missing entities)
#         self.db.aql.execute(
#             f"""
#             FOR hs IN {graph_name}_HAS_SOURCE
#                 FILTER !DOCUMENT(hs._from) OR !DOCUMENT(hs._to)
#                 REMOVE hs IN {graph_name}_HAS_SOURCE
#             """
#         )
#         if logflag:
#             logger.debug(f"Deleted orphan {graph_name}_HAS_SOURCE edges for file_id={file_id}")
        
#         # 6. Delete orphan LINKS_TO edges (pointing to missing entities)
#         self.db.aql.execute(
#             f"""
#             FOR l IN {graph_name}_LINKS_TO
#                 FILTER NOT DOCUMENT({graph_name}_ENTITY, PARSE_IDENTIFIER(l._from).key)
#                 OR NOT DOCUMENT({graph_name}_ENTITY, PARSE_IDENTIFIER(l._to).key)
#                 REMOVE l IN {graph_name}_LINKS_TO
#             """
#         )
#         if logflag:
#             logger.debug(f"Deleted orphan {graph_name}_LINKS_TO edges for file_id={file_id}")

#         return {
#             "status": 200,
#             "success": True,
#             "message": f"Data retraction succeeded for file_id={file_id}",
#             "deleted_chunks": chunk_ids
#         }
