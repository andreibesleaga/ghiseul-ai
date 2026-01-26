# Copyright (C) 2025 International Telecommunication Union (ITU)
# SPDX-License-Identifier: Apache-2.0

"""
Custom Genie Dataprep Microservice

Extends the base OPEA Dataprep microservice with additional endpoints for
document repository ingestion and retraction, using ArangoDB as the backend.
"""

import base64
import os
import time
from typing import List, Optional, Union

from pydantic import BaseModel
from fastapi import Body

from genieai_dataprep_loader import GenieDataprepLoader
from integrations.genieai_dataprep_arangodb import GenieArangoDataprep

# --- Import the entire base dataprep microservice safely ---
import opea_dataprep_microservice as base

# --- Use same shared OPEA components ---
from comps import (
    CustomLogger, # Added this as it is referenced later (David)
    ServiceType,
    register_microservice,
    register_statistics,
    statistics_dict,
)

# --- Import custom Pydantic model from our overlay protocol ---
from comps.cores.proto.genieai_api_protocol import ArangoDBDataprepRequestFromDocRepo


logger = CustomLogger("genie_dataprep_microservice")
logflag = os.getenv("LOGFLAG", False)
upload_folder = "./uploaded_files/" #################################################

dataprep_component_name = os.getenv("DATAPREP_COMPONENT_NAME", "GENIE_DATAPREP_ARANGODB")
# Initialize OpeaComponentLoader
loader = GenieDataprepLoader(
    dataprep_component_name,
    description=f"OPEA DATAPREP Component: {dataprep_component_name}",
)


# --- Pull shared logger, loader, and constants from the base module ---
# logger = base.logger
# logflag = base.logflag
# upload_folder = base.upload_folder
# dataprep_component_name = base.dataprep_component_name
# loader = base.loader  # inherits OpeaDataprepLoader setup
# create_upload_folder = base.create_upload_folder


# ------------------------------------------------------------------------------
# Custom request payload models
# ------------------------------------------------------------------------------
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


# ------------------------------------------------------------------------------
# Ingest file from document repository
# ------------------------------------------------------------------------------
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
    Accepts JSON:
    {
        "fileId": "...",
        "fileName": "...",
        "fileBase64": "...",
        "fileType": "...",
        "uploadDate": "...",
        "fileLabels": [...],
        "storagePath": "..."
    }
    """

    start = time.time()
    logger.info(f"[ ingest ] file_id: {payload.fileId}")
    logger.info(f"[ ingest ] file_name: {payload.fileName}")
    logger.info(f"[ ingest ] file_type: {payload.fileType}")

    # --- Environment-specific Arango config (set via env vars or defaults) ---
    ARANGO_GRAPH_NAME = os.getenv("ARANGO_GRAPH_NAME", "GRAPH_TEST")
    #ARANGO_GRAPH_NAME = os.getenv("ARANGO_GRAPH_NAME", "genie_graph")
    ARANGO_INSERT_ASYNC = os.getenv("ARANGO_INSERT_ASYNC", "false").lower() == "true"
    #ARANGO_INSERT_ASYNC = os.getenv("ARANGO_INSERT_ASYNC", True)
    ARANGO_BATCH_SIZE = int(os.getenv("ARANGO_BATCH_SIZE", 1000))
    #ARANGO_BATCH_SIZE = int(os.getenv("ARANGO_BATCH_SIZE", 100))
    ALLOWED_NODE_TYPES = os.getenv("ALLOWED_NODE_TYPES", "").split(",") if os.getenv("ALLOWED_NODE_TYPES") else []
    #ALLOWED_NODE_TYPES = os.getenv("ALLOWED_NODE_TYPES", "Document,Entity").split(",")
    ALLOWED_EDGE_TYPES = os.getenv("ALLOWED_EDGE_TYPES", "").split(",") if os.getenv("ALLOWED_EDGE_TYPES") else []
    #ALLOWED_EDGE_TYPES = os.getenv("ALLOWED_EDGE_TYPES", "Relation,Contains").split(",")
    NODE_PROPERTIES = os.getenv("NODE_PROPERTIES", "description").split(",")
    #NODE_PROPERTIES = os.getenv("NODE_PROPERTIES", "name,type").split(",")
    EDGE_PROPERTIES = os.getenv("EDGE_PROPERTIES", "description").split(",")
    #EDGE_PROPERTIES = os.getenv("EDGE_PROPERTIES", "type,weight").split(",")
    TEXT_CAPITALIZATION_STRATEGY = os.getenv("TEXT_CAPITALIZATION_STRATEGY", "upper")
    #TEXT_CAPITALIZATION_STRATEGY = os.getenv("TEXT_CAPITALIZATION_STRATEGY", "preserve")
    INCLUDE_CHUNKS = os.getenv("INCLUDE_CHUNKS", "true").lower() == "true"
    #INCLUDE_CHUNKS = os.getenv("INCLUDE_CHUNKS", "true").lower() == "true"

    try:
        # --- Decode and temporarily save file ---
        file_bytes = base64.b64decode(payload.fileBase64)
        save_path = os.path.join(upload_folder, payload.fileName)
        with open(save_path, "wb") as f:
            f.write(file_bytes)
        logger.info(f"[ ingest ] File saved to: {save_path}")

        # --- Construct Arango-specific dataprep request ---
        # ** FIXED: Removed 'base.' prefix and 'storage_path' argument **
        input_req = ArangoDBDataprepRequestFromDocRepo(
            file_id=payload.fileId,
            file_name=payload.fileName,
            file_path=save_path,
            file_type=payload.fileType,
            file_labels=payload.fileLabels,
            upload_date=payload.uploadDate,
            storage_path=payload.storagePath,
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

        # --- Perform ingestion using the loader ---
        response = await loader.ingest_file_with_guardrail(input_req)

        if logflag:
            logger.debug(f"[ ingest ] Output generated: {response}")
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)

        return response

    except Exception as e:
        logger.error(f"Error during dataprep ingest invocation from document repository: {e}")
        raise

    finally:
        # --- Cleanup temporary file ---
        try:
            if os.path.exists(save_path):
                os.remove(save_path)
                logger.info(f"[ ingest ] Temporary file removed: {save_path}")
        except Exception as cleanup_error:
            logger.error(f"[ ingest ] Failed to remove temporary file {save_path}: {cleanup_error}")


# ------------------------------------------------------------------------------
# Retract (delete) a file from graph
# ------------------------------------------------------------------------------
@register_microservice(
    name="opea_service@dataprep",
    service_type=ServiceType.DATAPREP,
    endpoint="/v1/dataprep/retract_file",
    host="0.0.0.0",
    port=5000,
)
@register_statistics(names=["opea_service@dataprep"])
async def retract_file(payload: DocRepoRetractPayload):
    """Deletes a file and its entities/relations from the graph."""
    start = time.time()
    file_id = payload.fileId
    graph_name = os.getenv("ARANGO_GRAPH_NAME", "genie_graph")

    logger.info(f"[ retract ] Start to delete ingested file {file_id} (graph, chunks, entities, relations)")

    try:
        if dataprep_component_name == "GENIE_DATAPREP_ARANGODB":
            response = await loader.retract_file(file_id=file_id, graph_name=graph_name)
        else:
            logger.error(f"dataprep_component_name is not set or invalid: {dataprep_component_name}")
            raise RuntimeError("Unsupported dataprep_component_name")

        if logflag:
            logger.debug(f"[ retract ] retracted result: {response}")
        statistics_dict["opea_service@dataprep"].append_latency(time.time() - start, None)
        return response

    except Exception as e:
        logger.error(f"Error during dataprep retract invocation: {e}")
        raise


# ------------------------------------------------------------------------------
# Launch microservice (inherits base service registry)
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("GENIE Dataprep Microservice is starting...")
    base.create_upload_folder(upload_folder)
    base.opea_microservices["opea_service@dataprep"].start()