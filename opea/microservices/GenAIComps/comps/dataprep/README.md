# Dataprep microservice

This repository contains code derived from the [OPEA Dataprep Microservice](https://github.com/opea-project/GenAIComps/tree/main/comps/dataprep) (see [opea-project](https://github.com/opea-project) on GitHub for more details). The microservice aims to preprocess the data from various sources (either structured or unstructured data) to text data, and ingest that data into a searchable database.

## First-phase Modifications

Several modifications have been introduced to adapt the original OPEA microservice to the needs and requirements of the ITU Initiative on Open-Source GenAI for Public Services, specifically for the [Multilingual Chatbot for Public Services Discovery use case](https://osaips.atlassian.net/wiki/external/Y2QzYmIyODljZmMzNDBhOGI2NzA5MzBkODUyZDk1NmU):

*   The [utils.py](https://github.com/opea-project/GenAIComps/blob/main/comps/dataprep/src/utils.py) file in dataprep/src has been modified to:
	*	adapt the workflow for extracting text from PDF files, including by adding a workflow to remove content from headers and footers and by replacing pytesseract with easyocr for processing images in PDFs;
	*	adapt the workflow for extracting text from html by complementing the UnstructuredHTMLLoader with structured extraction using Beautiful Soup. 
    
*   Integrations with database solutions that are not fully open-source (i.e. licensed under Apache 2.0 or MIT) have been removed. 

## Second-phase Modifications (for the integration of document repository)

### ingest

When receiving the request from doc-repo ingest endpoint:

```javascript
router.post('/:fileId/ingest', fileController.ingestFile);

...

// Send file info to dataprep microservice
const dataprepUrl = `${config.dataprep.host}:${config.dataprep.port}${config.dataprep.ingestPath}`;
const response = await axios.post(dataprepUrl, {
    fileId: file.file_id,
    filePath: file.storage_path,
    // or provide a download URL if needed
});
```

It will:

1. Chunk text ✅
2. Deploy guardrail endpoint to check each chunk ✅
3. For each file, generate one graph, and assign related metadata (file_id, file_path) to the chunk ✅
4. Send results to doc-repo ✅
5. Doc-repo update certain metadata ✅


Call the `ingest_file_from_repo`, which calls `ingest_file_with_guardrail`, which again calls `ingest_file_with_guardrail` and `ingest_data_to_arango_with_guardrail`.

### retract

1. Doc-repo POST retract (send the file_id that needs to be retracted) ✅
2. Dataprep receive the file_id, and delete the corresponding graph, which contains chunks, entities and relations. ✅
3. Return the result to doc-repo ✅
	a. if deletion successes, update related metadata; 
	b. if fails, let it be...