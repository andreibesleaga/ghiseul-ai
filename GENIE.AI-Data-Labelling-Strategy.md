# Data Labeling Process for Hybrid RAG

This repository implements a **data labeling and enrichment pipeline** designed to maximize the accuracy and explainability of Retrieval-Augmented Generation (RAG) systems.  
Unlike conventional data labeling systems that prepare training sets for supervised learning, this process focuses on **labelling document chunks for ingestion into a RAG pipeline**, creating both semantic and structural signals that boost retrieval performance.

---

## Why This Approach?

Most RAG pipelines rely solely on **vector embeddings** for semantic similarity. While powerful, vector-only retrieval often suffers from:
- False positives (semantically similar but irrelevant chunks),
- Lack of interpretability (difficult to explain *why* a chunk was retrieved),
- Poor performance in domain-specific contexts where taxonomy and relationships matter.

Our approach solves these problems by combining:
1. **Domain-specific labeling**: Every dataset is analyzed for its domain characteristics, and a tailored labeling schema is created.
2. **Knowledge graph enrichment**: Labeled chunks and entities are stored in a knowledge graph (KG), capturing both hierarchical and relational knowledge.
3. **Hybrid retrieval**: Queries are answered using a combination of vector similarity, graph affinity, and label filters — producing more accurate, explainable, and context-aware results.

---

## High-Level Flow

### 1. Domain Analysis
- Before data ingestion, the domain of the incoming documents is analyzed.
- A **domain-specific labeling schema** is defined, reflecting the vocabulary, concepts, and relationships unique to that corpus.
- This ensures labels are **relevant, precise, and stable** over time.

### 2. Document Ingestion
- Each new document ingested into the system comes with:
  - Metadata about the domain,
  - A candidate set of labels (from the domain schema),
  - Entities detected during preprocessing.

### 3. Chunking
- Documents are split into semantically meaningful chunks (paragraphs, sections, or sliding windows).
- Each chunk is embedded into a vector space for semantic similarity search.

### 4. Label Assignment with LLM
- A large language model (LLM) is used to determine:
  - **Which labels from the domain schema apply to each chunk**,  
  - **Which entities from the KG are mentioned or implied in each chunk**.
- The LLM operates in a **bounded context** (restricted to the predefined label schema), which improves labeling accuracy and reduces drift.

### 5. Knowledge Graph Update
- Chunks, labels, and entities are written into the knowledge graph.
- Graph edges represent:
  - Relationships between entities,
  - Co-occurrence of labels,
  - Document-to-label and chunk-to-label mappings.
- The KG grows with every ingestion, creating a **rich, structured knowledge fabric**.

### 6. Hybrid Retrieval
When a user query arrives:
- **Vector Search**: Candidate chunks are retrieved based on semantic similarity.  
- **Graph Affinity**: Related nodes and edges in the KG are traversed to find contextually linked chunks.  
- **Label Filtering**: Labels provided in the query context constrain or refine retrieval results.  

The final set of retrieved chunks is **scored and ranked** by combining these three signals, ensuring both accuracy and interpretability.

---

## Benefits of This Approach

### 🎯 Precision
- Label-guided filtering reduces irrelevant results from vector-only retrieval.
- Hybrid scoring balances **semantic similarity** with **explicit relationships**.

### 🔎 Explainability
- Labels and graph links make it easy to explain *why* a chunk was retrieved.
- Supports compliance, auditing, and trust in enterprise use cases.

### 🏗 Domain Adaptability
- Tailored schemas for each dataset ensure robustness in specialized fields (finance, law, healthcare, etc.).
- Avoids “one-size-fits-all” taxonomies that don’t scale across domains.

### ⚡ Fast Cold-Start
- Even with a small corpus, domain-specific labels and entities ensure meaningful graph affinity and label-based retrieval.
- The system does not require massive data accumulation before becoming useful.

### 🧩 Flexible Querying
- Queries can be enriched with label filters to focus retrieval (e.g., *“only clinical guidelines about diabetes treatment”*).
- Enables more **fine-grained control** for power users and automated agents.

---

## Example Use Case

1. Ingest a set of legal contracts.
   - Schema includes labels like `Jurisdiction`, `Clause Type`, `Parties`, `Obligations`.  
   - Entities include named companies, individuals, and governing bodies.

2. LLM labels each chunk:
   - Clause A → `Jurisdiction: California`, `Clause Type: Arbitration`.  
   - Clause B → `Obligations: Payment Terms`, `Entity: Company X`.

3. Knowledge graph links these labels and entities.

4. User query: *“Show me all arbitration clauses involving Company X in California.”*
   - Vector similarity finds related clauses.  
   - KG traversal confirms links to Company X and California.  
   - Label filtering ensures only arbitration clauses are retrieved.

---

## In Summary

This data labeling process creates a **smarter, more explainable, and domain-aware RAG system**. By combining domain-specific schemas, LLM-driven labeling, and a knowledge graph, the pipeline goes beyond vector-only retrieval, delivering **higher accuracy and trustworthiness** for enterprise and specialized applications.

---
