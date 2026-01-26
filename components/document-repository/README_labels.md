# Document Repository Labelling Design

This document outlines the labelling system for document ingestion, chunking, and retrieval in the document repository and related microservices.

## Overview

The labelling system enables precise categorization and retrieval of documents and chunks. Users define and manage labels, which are used throughout the dataprep and retrieval pipeline to ensure relevant and accurate chunk selection.

## Workflow

### 1. Label Definition

- Users create a label tree with two levels: **category labels** and **service labels**.
- Each label has attributes:
    - `_id`: a unique id for the label
    - `name`: the label itself
    - `level`: category or service
    - `status`: pending or active
    - `parent_id`: id of the category label that a service label belongs to; `null` for category labels.
    - `publish`: true or false. Default is false.

### 2. File Ingestion

- Users upload files and assign labels from the predefined label tree, which means that the label attributes of a file contains an array of labelId (_key). No need to validate if the labelId is in the label collection. 
- File metadata, including selected labels, is stored in the database.

### 3. Chunk Labelling

- During ingestion, files are chunked.
- The LLM assigns labels to each chunk based on the file's labels.
- If no existing label fits, the LLM suggests new labels (status: "pending").
- New labels are added to the label collection for user review.

### 4. Label Review and Editing

- Users review and edit chunk labels via the UI.
- Pending and active labels are visually distinguished.
- Users can activate pending labels or modify chunk labels as needed.

### 5. Label Tree Management

- The label tree can be updated at any time.
- All labels in the tree are managed in the label collection.
- Supported operations: add, delete, update, search.

### 6. Retrieval

- Chunks and their labels are used for retrieval.
- Two filtering strategies:
    - **Hard Filtering**: Only chunks with at least one selected label are considered.
    - **Soft Filtering**: Chunks are scored based on label overlap and embedding similarity. Users can adjust the weighting between strict and flexible filtering.

## Usage

1. Get Label Information by Id (_key) ✅

```bash
curl -X GET "http://localhost:3000/api/labels/768202" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json"
```

2. Get All Labels or Filter by Level/Status/ParentId/Publish ✅

```bash
curl -X GET "http://localhost:3000/api/labels?" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json"
```

```bash
curl -X GET "http://localhost:3000/api/labels?name=health&level=category&status=active&parentId=<parentId>&publish=true" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json"
```

3. Create a New Label ✅

```bash
curl -X POST "http://localhost:3000/api/labels" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json" \
-d '{
  "name": "Homeownership",
  "level": "service",
  "status": "active",
  "publish": false,
  "parentId": "772554"
}'
```

4. Update a Label by ID ✅

```bash
curl -X PATCH "http://localhost:3000/api/labels/768264" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json" \
-d '{
  "level": "service",
  "publish": true
}'
```

5. Delete a Label by ID ✅

```bash
curl -X DELETE "http://localhost:3000/api/labels/768102" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json"
```

6. Delete a Category Label and Its Children ✅

```bash
curl -X DELETE "http://localhost:3000/api/labels/766794/with-children" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json"
```

7. Get Related Labels (Parent and Children) ✅

```bash
curl -X GET "http://localhost:3000/api/labels/767715/related" \
-H "Authorization: Bearer <accessToken>" \
-H "Content-Type: application/json"
```


## Responsibilities

- **Users**: Define and manage labels, review and approve chunk labels, ensure label accuracy.
- **System**: Assist with label suggestions, manage label status, support efficient retrieval using labels.

## Database Collections

- **Labels Collection**: Stores all labels with their attributes and status.
- **Files Collection**: Stores file metadata, including assigned labels.

## UI Features

- Label tree management
- File upload with label selection
- Chunk and label review/editing
- Retrieval with adjustable filtering

## Extending

Different Label filtering approaches:

**a. Hard Filtering:**  
Retrieve only those chunks, nodes, or edges that contain at least one of the user-selected labels. All others are excluded from further processing, including during graph traversal. This filtering can be set at the beginning(before similarity search)/middle(after similarity search but before graph traversal)/end(after graph traversal) of the retrieval process.

**b. Soft Filtering:**  
During similarity search, assign each chunk, node, or edge a relevance score based on both label overlap and embedding similarity. Example scoring methods include:
- `label_score = (number of overlapping labels) / (number of selected labels)`
- `label_score = cosine similarity between the average of query label embeddings and chunk label embeddings`
- `cosine_similarity_score = cosine similarity between query and chunk embeddings`
- `cosine_similarity_score = cosine similarity between embedding(query + query_labels) and embedding(chunk + chunk labels)`
- `cosine_similarity_score = cosine similarity between (a * query_embedding + b * label_embedding) and embedding(chunk)`
- Combined score: `score = w1 * cosine_similarity_score + w2 * label_score`, where `w1` and `w2` are user-adjustable weights for strictness or flexibility. Results are sorted by descending score. 