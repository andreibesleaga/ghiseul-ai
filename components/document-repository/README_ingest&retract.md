# Document Repository - Ingest and Retract

## What should be handled by the document repository?

**Ingest**

Expose an endpoint (e.g. `POST /api/files/:fileId/ingest`) that:
1. Finds the file and its metadata.
2. Sends the file (or its path, or a download URL) and metadata to the dataprep microservice (via HTTP request, e.g. using `axios`).
3. Waits for a response from dataprep (success/failure).
4. On success, updates the file’s metadata:
* dataprep.status = "ingested"
* dataprep.ingest_date = <current_time>

**Retract**

Expose an endpoint (e.g. `POST /api/files/:fileId/retract`) that:

1. Sends a request to the dataprep microservice to delete all related chunks, embeddings, entities, and relations for that file.
2. Waits for a response from dataprep (success/failure).
3. On success, updates the file’s metadata:
* dataprep.status = "retracted"
* dataprep.retract_date = <current_time>

## What should be handled by the dataprep microservice?

**Ingest**

* Receives the file (or file path/URL) and metadata.
* Performs text extraction and chunking of the file content.
* Call guardrail microservices for content checking for each chunk
    * If fails, return an error response.
    * If successful:
        * Performs embedding, entity and relation extraction for each chunk.
        * Stores results in its own collections (chunks, embeddings, entities, relations).
        * Returns a success/failure response.

**Retract**

* Receives a file ID (or other identifier).
* Deletes all related chunks, embeddings, entities, and relations from its database.
* Returns a success/failure response.
