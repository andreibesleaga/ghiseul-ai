# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
from pydantic import BaseModel

import base64
import os
import time
from typing import Annotated, List, Optional, Union

from fastapi import Body, Depends, File, Form, HTTPException, Request, UploadFile
from integrations.arangodb import OpeaArangoDataprep
# Can be decomented when other integrations are needed
# from integrations.elasticsearch import OpeaElasticSearchDataprep
# from integrations.milvus import OpeaMilvusDataprep
# from integrations.neo4j_llamaindex import OpeaNeo4jLlamaIndexDataprep
# from integrations.opensearch import OpeaOpenSearchDataprep
# from integrations.pgvect import OpeaPgvectorDataprep
# from integrations.pipecone import OpeaPineConeDataprep
# from integrations.qdrant import OpeaQdrantDataprep
# from integrations.redis import OpeaRedisDataprep
# from integrations.redis_finance import OpeaRedisDataprepFinance
# from integrations.vdms import OpeaVdmsDataprep
from opea_dataprep_loader import OpeaDataprepLoader

from comps import (
    CustomLogger,
    ServiceType,
    opea_microservices,
    register_microservice,
    register_statistics,
    statistics_dict,
)
from comps.cores.proto.api_protocol import (
    ArangoDBDataprepRequest,
    DataprepRequest,
    Neo4jDataprepRequest,
    RedisDataprepRequest,
    ArangoDBDataprepRequestFromDocRepo
)
from comps.dataprep.src.utils import create_upload_folder


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
DOC_REPO_URL = os.getenv("DOC_REPO_URL", "http://localhost:3001") # Document repository URL

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



logger = CustomLogger("opea_dataprep_microservice")
logflag = os.getenv("LOGFLAG", False)
upload_folder = "./uploaded_files/"

dataprep_component_name = os.getenv("DATAPREP_COMPONENT_NAME", "OPEA_DATAPREP_ARANGODB")
# Initialize OpeaComponentLoader
loader = OpeaDataprepLoader(
    dataprep_component_name,
    description=f"OPEA DATAPREP Component: {dataprep_component_name}",
)


class DocRepoIngestPayload(BaseModel):
    fileId: str
    fileName: str
    fileBase64: str
    fileType: str
    uploadDate: str
    fileLabels: Optional[List[str]] = None
    storagePath: Optional[str] = None

class DocRepoRetractPayload(BaseModel):
    fileId: str

async def resolve_dataprep_request(request: Request):
    form = await request.form()

    common_args = {
        "files": form.get("files", None),
        "link_list": form.get("link_list", None),
        "chunk_size": form.get("chunk_size", 1500),
        "chunk_overlap": form.get("chunk_overlap", 100),
        "process_table": form.get("process_table", False),
        "table_strategy": form.get("table_strategy", "fast"),
    }

    # if "index_name" in form:
    #     return RedisDataprepRequest(
    #         **common_args,
    #         index_name=form.get("index_name"),
    #     )

    # if "ingest_from_graphDB" in form:
    #     return Neo4jDataprepRequest(
    #         **common_args,
    #         ingest_from_graphDB=form.get("ingest_from_graphDB"),
    #     )

    if "graph_name" in form:
        return ArangoDBDataprepRequest(
            **common_args,
            graph_name=form.get("graph_name"),
            insert_async=form.get("insert_async"),
            insert_batch=form.get("batch_size"),
            embed_nodes=form.get("embed_nodes"),
            embed_edges=form.get("embed_edges"),
            embed_chunks=form.get("embed_chunks"),
            allowed_node_types=form.get("allowed_node_types"),
            allowed_edge_types=form.get("allowed_edge_types"),
            node_properties=form.get("node_properties"),
            edge_properties=form.get("edge_properties"),
            text_capitalization_strategy=form.get("text_capitalization_strategy"),
            include_chunks=form.get("include_chunks"),
        )

    return DataprepRequest(**common_args)


# Default OPEA ingestion method, which is used by the default UI but not in current workflow.
@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/ingest",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def ingest_files(
    input: Union[DataprepRequest, RedisDataprepRequest, Neo4jDataprepRequest, ArangoDBDataprepRequest] = Depends(
        resolve_dataprep_request
    ),
):
    if isinstance(input, RedisDataprepRequest):
        logger.info(f"[ ingest ] Redis mode: index_name={input.index_name}")
    elif isinstance(input, Neo4jDataprepRequest):
        logger.info(f"[ ingest ] Neo4j mode: ingest_from_graphDB={input.ingest_from_graphDB}")
    elif isinstance(input, ArangoDBDataprepRequest):
        logger.info(f"[ ingest ] ArangoDB mode: graph_name={input.graph_name}, ...")
    # elif ...
    else:
        logger.info("[ ingest ] Base mode")

    start = time.time()

    files = input.files
    link_list = input.link_list

    if logflag:
        logger.info(f"[ ingest ] files:{files}")
        logger.info(f"[ ingest ] link_list:{link_list}")

    try:
        response = await loader.ingest_files(input)

        # Log the result if logging is enabled
        if logflag:
            logger.info(f"[ ingest ] Output generated: {response}")
        # Record statistics
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)
        return response
    except Exception as e:
        logger.error(f"Error during dataprep ingest invocation: {e}")
        raise



@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/ingest_file",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def ingest_file_from_repo(payload: DocRepoIngestPayload):
    """
    Accepts JSON: { "fileId": "...", "fileName": "...", "fileBase64": "...", "fileType": "...", "uploadDate": "..." }
    """

    start = time.time()

    logger.info(f" [ ingest ] file_id: {payload.fileId}")
    logger.info(f" [ ingest ] file_name: {payload.fileName}")
    logger.info(f" [ ingest ] file_type: {payload.fileType}")

    try:
        # Decode base64 and save file
        file_bytes = base64.b64decode(payload.fileBase64)
        save_path = os.path.join(upload_folder, payload.fileName)
        with open(save_path, "wb") as f:
            f.write(file_bytes)
        logger.info(f" [ ingest ] File saved to: {save_path}")

        # Construct the full request using ArangoDBDataprepRequestFromDocRepo
        input = ArangoDBDataprepRequestFromDocRepo(
            file_id=payload.fileId,
            file_name=payload.fileName,
            storage_path=payload.storagePath, 
            file_path=save_path,
            file_type=payload.fileType,
            file_labels=payload.fileLabels,
            upload_date=payload.uploadDate,
            graph_name=ARANGO_GRAPH_NAME,
            insert_async=ARANGO_INSERT_ASYNC,
            insert_batch_size=ARANGO_BATCH_SIZE,
            embed_nodes=True,
            embed_edges=True,
            embed_chunks=True,
            allowed_node_types=ALLOWED_NODE_TYPES,
            allowed_edge_types=ALLOWED_EDGE_TYPES,
            node_properties=NODE_PROPERTIES,
            edge_properties=EDGE_PROPERTIES,
            text_capitalization_strategy=TEXT_CAPITALIZATION_STRATEGY,
            include_chunks=INCLUDE_CHUNKS,
        )

        response = await loader.ingest_file_with_guardrail(input)

        if logflag:
            logger.debug(f"[ ingest ] Output generated: {response}")
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)

        return response
    except Exception as e:
        logger.error(f"Error during dataprep ingest invocation from document repository: {e}")
        raise
    finally:
        # Clean up the uploaded file after processing
        try:
            if os.path.exists(save_path):
                os.remove(save_path)
                logger.info(f" [ ingest ] Temporary file removed: {save_path}")
        except Exception as cleanup_error:
            logger.error(f" [ ingest ] Failed to remove temporary file {save_path}: {cleanup_error}")


# Default OPEA get ingested files method.
@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/get",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def get_files(index_name: str = Body(None, embed=True)):
    start = time.time()

    logger.info("[ get ] start to get ingested files")

    try:
        # Use the loader to invoke the component
        if dataprep_component_name == "OPEA_DATAPREP_REDIS":
            response = await loader.get_files(index_name)
        else:
            if index_name:
                logger.error(
                    'Error during dataprep get files: "index_name" option is supported if "DATAPREP_COMPONENT_NAME" environment variable is set to "OPEA_DATAPREP_REDIS". i.e: export DATAPREP_COMPONENT_NAME="OPEA_DATAPREP_REDIS"'
                )
                raise
            response = await loader.get_files()

        # Log the result if logging is enabled
        if logflag:
            logger.debug(f"[ get ] ingested files: {response}")
        # Record statistics
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)
        return response
    except Exception as e:
        logger.error(f"Error during dataprep get invocation: {e}")
        raise


# Default OPEA delete ingested files method.
@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/delete",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def delete_files(file_path: str = Body(..., embed=True), index_name: str = Body(None, embed=True)):
    start = time.time()

    logger.info("[ delete ] start to delete ingested files")

    try:
        # Use the loader to invoke the component
        if dataprep_component_name == "OPEA_DATAPREP_REDIS":
            response = await loader.delete_files(file_path, index_name)
        else:
            if index_name:
                logger.error(
                    'Error during dataprep delete files: "index_name" option is supported if "DATAPREP_COMPONENT_NAME" environment variable is set to "OPEA_DATAPREP_REDIS". i.e: export DATAPREP_COMPONENT_NAME="OPEA_DATAPREP_REDIS"'
                )
                raise
            response = await loader.delete_files(file_path)

        # Log the result if logging is enabled
        if logflag:
            logger.debug(f"[ delete ] deleted result: {response}")
        # Record statistics
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)
        return response
    except Exception as e:
        logger.error(f"Error during dataprep delete invocation: {e}")
        raise




@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/retract_file",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def retract_file(payload: DocRepoRetractPayload):
    """ Accepts JSON: { "fileId": "..." }
    """
    start = time.time()
    file_id = payload.fileId
    graph_name = ARANGO_GRAPH_NAME

    logger.info(f"[ delete ] Start to delete ingested file {file_id} (graph, chunks, entities and relations)")

    try:
        # Use the loader to invoke the component
        if dataprep_component_name == "OPEA_DATAPREP_ARANGODB":
            response = await loader.retract_file(file_id, graph_name)
        else:
            logger.error('dataprep_component_name is not set.')
            raise

        # Log the result if logging is enabled
        if logflag:
            logger.debug(f"[ retract ] retracted result: {response}")
        # Record statistics
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)
        return response
    except Exception as e:
        logger.error(f"Error during dataprep retract invocation: {e}")
        raise



# Default OPEA get list of indices method.
@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/indices",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def get_list_of_indices():
    start = time.time()
    logger.info("[ get ] start to get list of indices.")

    if dataprep_component_name != "OPEA_DATAPREP_REDIS":
        logger.error(
            'Error during dataprep - get list of indices: "index_name" option is supported if "DATAPREP_COMPONENT_NAME" environment variable is set to "OPEA_DATAPREP_REDIS". i.e: export DATAPREP_COMPONENT_NAME="OPEA_DATAPREP_REDIS"'
        )
        raise

    try:
        # Use the loader to invoke the component
        response = await loader.get_list_of_indices()

        # Log the result if logging is enabled
        if logflag:
            logger.debug(f"[ get ] list of indices: {response}")

        # Record statistics
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)

        return response
    except Exception as e:
        logger.error(f"Error during dataprep get list of indices: {e}")
        raise


if __name__ == "__main__":
    logger.info("OPEA Dataprep Microservice is starting...")
    create_upload_folder(upload_folder)
    opea_microservices["opea_service@dataprep"].start()
