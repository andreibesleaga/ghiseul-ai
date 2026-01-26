# **GENIE.AI Installation and Configuration Guide**

### **Introduction**

Welcome to the GENIE.AI framework. This guide will walk you through the necessary steps to set up, configure, and deploy your own Retrieval-Augmented Generation (RAG) solution. The success of any AI-driven knowledge system lies in the quality and structure of its data. Therefore, the first and most critical phase is to define, curate, and structure the data that will form the backbone of your system's knowledge. This cannot be over-emphasized. It is the most critical aspect. Our suggestion is that you establish an initial MVP with the framework by simply curating the data, defining the knowledge hierarchy, configuring your quickhelp buttons with prompts and then labeling and ingesting your curated data prior to modifying any code. This way, you will get used to how the framework operates, before you delve into deeper issues and extensions. This approach can also be used to deliver a rapid solution to a RAG problem, without any coding at all (just implementing a knowledge base design and the associated configuration). The application title and theme can also be modified by configuration in JSON without changing code. The suggested approach for this is to utilize something like ChatGOT, Gemini Pro or Grok etc. to build a new configuration for color theme and title etc. This can be done in minutes.

For a high-level understanding of the system architecture before beginning any work, please refer to the [**Architecture Overview**](https://osaips.atlassian.net/wiki/external/N2U5ZjkwM2FhOTgyNDZlZjk3MWRlODY5Mzk5OTBhNjE). This will give you an insight into most of the high level components and how they are assembled.

---

### **Step 1: Data Curation and Knowledge Hierarchy (Conceptual Design)**

Before any data is ingested into GENIE.AI, you must first establish the scope of knowledge for your application and organize it logically. This process involves a strategic design of your knowledge core, the curation and verification of source documents, and the creation of an associated two-level labeling system that serves as the knowledge hierarchy within the framework's user interface (i.e., the Knowledge Hierarchy displayed on the left sidebar). Ingested data is tagged with these labels, and queries can also select the same labels, which enhances RAG accuracy as we have utilized labeling as part of the hybrid-retrieval strategy for RAG at the backend.

#### **1.1 Designing the Knowledge Core with Domain Analysis**

A powerful RAG solution is built on a well-designed data model. We recommend using a conceptual Venn diagram exercise with your subject matter experts to map your information landscape before you even start. This helps you visualize the relationships between different data sets and define the boundaries of your knowledge base. It helps you to identify the specific data sets you need and to ascertain the specific relationships between these data sets.

This process involves identifying three tiers of data:

* **Primary Data Sets (Core):** This is the essential information that directly addresses the most critical and frequent user queries. It forms the central circles of your diagram \- this totally depends on the scope of your solution. You can address as many facets of this central core set of data as required to serve the specific use case that you have in mind.  
* **Secondary Data Sets (Supporting):** This data provides necessary context and is often required to give a more complete answer. It is the second ring of your diagram circles and it overlaps significantly with the primary set. There could also be many bubbles in this secondary tier.  
* **Tertiary Data Sets (Peripheral):** This information is supplementary/peripheral and enhances the user's understanding, but may not be essential for every query. It has a minor overlap with the primary and secondary sets in specific areas. The Venn diagram is your best allie to get this right up front.

**Example Domain Analysis using Venn Diagrams:**

**1\. Agriculture**

* **Primary:** "Corn Crop Management Guide." This is the core document farmers need.  
* **Secondary:** "Approved Pesticides & Herbicides," "Chemical Fertilizer Specifications," "Soil Sample Analysis Protocols." These are directly referenced by the crop guide.  
* **Tertiary:** "Regional Weather Data," "Historical Market Prices," "Local Agricultural Equipment Suppliers." This data provides valuable context for decision-making.

**2\. Government Services**

* **Primary:** "Official Passport Application Process & Forms."  
* **Secondary:** "Schedule of Fees & Payment Options," "Civil Registry Database (for birth certificate verification)."  
* **Tertiary:** "List of Authorized Photo Studios," "Post Office Locations & Operating Hours."

**3\. Healthcare**

* **Primary:** "Clinical Guidelines for Type 2 Diabetes Management."  
* **Secondary:** "Pharmaceutical Database (Metformin, Insulin dosages)," "Nutritional & Dietary Plans for Diabetics."  
* **Tertiary:** "Directory of Endocrinologists," "Information on Local Support Groups," "Recommended Fitness Routines."

#### **1.2 Impact on the Labeling System Design**

This domain analysis directly informs the structure of your 2-level labeling system. The clear relationships and boundaries identified in the Venn diagrams translate naturally into a logical hierarchy. We suggest that you also use an AI-driven approach to assemble the labeling system design. You can use any of the common RAG tools like ChatGPT, Gemini or Grok for example to accomplish this in minutes. Once this is done, you will need to verify it with subject matter experts to ensure that it meets the needs of indexing the required data sets.

* **Categories (Level 1\)** often emerge from the overarching themes that group your primary and secondary data sets. For example, in Agriculture, the primary set "Corn Crop Management" and secondary sets like "Pesticides" and "Fertilizers" all fall under the logical **Category** of Crop Management.  
* **Services/Topics (Level 2\)** are the primary, secondary, and even tertiary data sets themselves. They become the specific, actionable knowledge points within a category.

**Tier-Based Design Strategy:** To translate your data tiers into a functional hierarchy, apply the following strategy:

1. **Primary Data MUST have dedicated labels:** Every primary data set represents a core user need and must have a distinct, clear Service (Level 2\) label.  
2. **Secondary Data usually needs dedicated labels:** These should generally have their own Service (Level 2\) labels, typically grouped under the same Category (Level 1\) as the primary data they support.  
3. **Group Tertiary Data to avoid clutter:** Avoid creating granular labels for every piece of tertiary data. Instead, group them into broader "Reference" or "General Information" Service labels. This prevents the hierarchy from becoming overwhelming while still making the data accessible.

**AVOID USING THE SAME LABELS FOR SERVICES IN MULTIPLE CATEGORIES**

**Common Sense Design Principles:**

* **User-Centric Naming:** Labels should reflect *user intent*, not internal organizational structures. A user looking for "Pesticides" does not care which government sub-department manages them.  
* **Mutually Exclusive, Collectively Exhaustive (MECE):** Aim for categories that don't overlap significantly. While documents can have multiple labels, the hierarchy itself should be clean and logical.  
* **Strict 2-Level Limit:** GENIE.AI uses a shallow hierarchy. Do not try to force a third level by creating overly complex names (e.g., avoid Crops \- Corn \- Pests \- Beetles; instead use Category: Crop Management, Service: Pest Control).

**Applying this to the Agriculture example:**

| Category (Level 1\) | Service/Topic (Level 2\) | Data Source Origin |
| :---- | :---- | :---- |
| **Crop Management** | Corn Planting & Harvest Guide | Primary |
|  | Soil Health and Fertilization | Secondary |
|  | Pest and Disease Control | Secondary |
| **Market & Logistics** | Historical Market Prices | Tertiary (Grouped) |
|  | Approved Equipment Suppliers | Tertiary (Grouped) |

This method ensures your knowledge hierarchy is not arbitrary but is a direct reflection of how the information is interrelated, making the system more intuitive for both the AI and the end-user.

#### **1.3 Data Curation and Verification Process**

To deliver an accurate, trustworthy, and useful RAG solution, the underlying data must be meticulously curated and verified. Ingesting inaccurate, outdated, or poorly formatted data is the primary cause of poor performance and "hallucinations" in RAG systems. The GENIE.AI framework supports a wide range of file formats for the ingestion process.

**Supported Formats:**

* Web pages (.html, via URL links) \- note that depth of crawling for web sites can be controlled as well as the language accepted.  
* Documents (.pdf, .docx) \- .doc HAS been removed as it is legacy and problematic (conversion to .docx or .pdf is recommended)  
* Spreadsheets (.xlsx) \- .xls has been removed for the same problametic legacyt reasons. You can use .xlsx sparingly. We suggest this is done sparingly as there are limitations related to multiple tabs and some of the other salient aspects of spreadsheets (such as calculations and charts etc.) that are problematic.  
* Markdown (.md)  
* Plain Text (.txt)

**Supported Language for Ingestion**

* GENIE-AI is set up to support a single language for ingestion purposes.  
* The single language is configurable \- our default configuration is EN.  
* File uploads will be constrained to the single configured language (by language detection).  
* Language detection technology is not perfect (especially with URL links)... you can always convert the required information to a supported file type.  
* Translations are performed on the fly in and out of the backend by an LLM (also configurable).

**Curation Best Practices:**

1. **Source Vetting:** Always prioritize authoritative and official sources. For government services, this means official government websites and publications. For healthcare, use peer-reviewed medical journals, clinical guidelines from recognized health organizations, and regulatory bodies. **You will need a team of experts to validate and curate this knowledge and it will need to be agreed and signed-off before ingestion.**  
2. **Data Cleaning:** \* **Standardize Terminology:** Ensure consistent use of terms (e.g., "Type 2 Diabetes" vs. "T2D").  
   * **Remove Duplicates & Noise:** Eliminate redundant documents, boilerplate text (headers, footers, irrelevant ads), and artifacts from the conversion process.  
   * **Verify OCR Accuracy:** When converting scanned PDFs, manually review the resulting text for Optical Character Recognition (OCR) errors, as these can introduce factual inaccuracies.  
3. **Logical Chunking:** Ensure that data is ingested and split into semantically meaningful chunks. A chunk should ideally represent a complete idea or paragraph. A split in the middle of a sentence can cause the system to lose context.

**Verification Workflow:**

1. **Subject Matter Expert (SME) Review:** This is the most critical step. Once data is curated, it must be reviewed by experts in the relevant domain. An agronomist should verify the crop data, and a doctor should verify the healthcare guidelines. SMEs check for factual accuracy, completeness, and relevance.  
2. **Version Control:** Your knowledge base is not static. Regulations, guidelines, and data change. Implement a system to track document versions and schedule regular reviews (e.g., annually) to update or retire outdated information. The sources for these documents should be version controlled. Note that documents can be retracted and ingested again as and when they change.  
3. **Establish a Feedback Loop:** The GENIE.AI framework includes capabilities for users to provide feedback on responses. This user feedback is an invaluable, continuous source of verification. A process must be in place to review flagged responses, trace them back to the source document, and make corrections as needed.

By following this rigorous process of designing, curating, and verifying your data, you will build a robust and reliable knowledge base that allows GENIE.AI to perform at its full potential.

---

### **Step 2: Prerequisites**

Before attempting installation, ensure your infrastructure meets the necessary requirements.

#### **2.1 Hardware Requirements**

GENIE.AI requires significant computational resources, particularly for AI model inference (LLMs, embeddings, rerankers). This is critical and the solution will potentially not even run without the required resources.

* Please refer to the [**T-Shirt Sizing Guide**](https://osaips.atlassian.net/wiki/external/ODg2YmZmZTJjNGMyNGQzYzgwZWUzNTk2NWI3NjdiMDk) to determine the appropriate hardware for your deployment scale. Even for development and MVP work, you will need to meet the minimum requirements outlined in the small tee shirt size.

#### **2.2 Software Prerequisites**

* **Ubuntu Linux 22.04:** Everything has been tested on Ubuntu 22.04. It is OK to use variant Linux distributions but that is something you need to resolve.  
* **Docker & Docker Compose:** Required for orchestrating the containerized services.  
* **NVIDIA Drivers & CUDA:** Required for GPU acceleration of the AI services (vLLM, TEI).  
  * Follow the [**NVIDIA Driver Installation Guide**](https://osaips.atlassian.net/wiki/external/NTY1ZGY1N2RmYzkzNGRiMGIxMzc1ZDM4ZjI4NmNlOTE) to ensure your host is ready for GPU workloads.  
* **Node.js:** Required for the JavaScript components

#### **2.3 Install and Verify Docker on Every Host**

Bash

##### 1\. Update and install prerequisites

sudo apt-get update

sudo apt-get install \-y ca-certificates curl gnupg

##### 2\. Add Docker's official GPG key

sudo install \-m 0755 \-d /etc/apt/keyrings

curl \-fsSL [https://download.docker.com/linux/ubuntu/gpg](https://download.docker.com/linux/ubuntu/gpg) | sudo gpg \--dearmor \-o /etc/apt/keyrings/docker.gpg

sudo chmod a+r /etc/apt/keyrings/docker.gpg

##### 3\. Set up the official Docker repository

echo  
"deb \[arch="$(dpkg \--print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg\] [https://download.docker.com/linux/ubuntu](https://download.docker.com/linux/ubuntu)  
"$(. /etc/os-release && echo "$VERSION\_CODENAME")" stable" |  
sudo tee /etc/apt/sources.list.d/docker.list \> /dev/null

##### 4\. Install Docker Engine

###### *(This also removes conflicting older versions like docker.io if present)*

sudo apt-get update

sudo apt-get install \-y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

##### 5\. Start and enable the Docker daemon

###### *(Necessary if the installer fails to start it automatically)*

sudo systemctl start docker

sudo systemctl enable docker

##### 6\. Grant your user standard Docker permissions

sudo usermod \-aG docker $USER

newgrp docker

##### 7\. Verify Docker

docker run hello-world

---

#### **2.4 Install Node.js on Every Host and Verify**

Bash

curl \-fsSL [https://deb.nodesource.com/setup\_lts.x](https://deb.nodesource.com/setup_lts.x) | sudo \-E bash \-

sudo apt-get install \-y nodejs

node \-v

npm \-v

---

### **Step 3: Base Installation**

You must complete one of these base docker compose based installations before configuring the application services (single node or three node) \- Kubernetes will be added later. The way that the 2 docker compose based deployent options are organized in the repository is as follows:

Plaintext

repository-root/  
├── docker-compose.yaml           \# Single-node docker compose deployment model  
├── env                           \# .env file for the single-node docker compose  
├── components/  
│   ├── docker-compose.yaml       \# Docker compose for infrastructure tier (three node model)  
│   ├── gov-chat-backend/  
│   │   └── env                   \# .env file for the node.js backend service  
│   ├── gov-chat-frontend/  
│   │   └── env                   \# .env file for the Vue 3 application  
│   └── document-repository/  
│       └── env                   \# .env file for the document repository service  
├── api-gateway-solution/  
│   ├── docker-compose.yaml       \# Docker compose for bastion host tier  
│   └── env                       \# .env file for the bastion tier  
└── genie-ai-overlay/       \# This is the folder where all the build overlay files exist  
│   ├── build-patches       \# Shell scripts to patch the build  
│   ├── chatqna                \# Overlay files for the chatqna server extensions  
│   ├── core                      \# Overlay files for the OPEA core extensions  
│   ├── dataprep              \# Overlay files for the dataprep service extensions  
│   ├── http-service          \# Overlay files for the http-service service extensions  
     └── retriever                \# Overlay files for the retriever service extensions  
├── docker-compose.yaml       \# Docker compose for customized GENIE.AI OPEA  
└── env                       \# .env file for the OPEA tier

Following are the details for configuring both the single-node deployment model and the three node deployment model (Options A and B):

#### **Option A: Single-Node Installation (MVP/Dev)**

This method deploys all services onto a single host using Docker Compose.

1\. Clone the Repository

Clone the appropriate repository to your local machine:

* *Public Replica:* [https://gitlab.com/fordendk/genie-ai-replica](https://gitlab.com/fordendk/genie-ai-replica)  
* *Internal UNICC GitLab:* (Check with administrator)

Bash

git clone [https://gitlab.com/fordendk/genie-ai-replica](https://gitlab.com/fordendk/genie-ai-replica)  
cd genie-ai-replica

#### 2\. Environment Configuration (.env)

The docker-compose.yaml file sources its configuration from an .env file located in the root of the repository (named env in the repo). You must create this file (e.g., by copying the existing env example to .env) and populate it with your specific settings.

The following tables document the key variables found in the .env file1, grouped by the service they configure.

**Kong (API Gateway) & Database**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| POSTGRES\_USER | Username for the Kong database. | kong |
| POSTGRES\_DB | Name of the Kong database. | kong |
| POSTGRES\_PASSWORD | Password for the Kong database. | k1ngk0ng |
| KONG\_DATABASE | Tells Kong which database type to use. | postgres |
| KONG\_PG\_HOST | Hostname for the Kong database service. | kong-database |
| KONG\_ADMIN\_LISTEN | Kong admin API listen address. | 0.0.0.0:8001, 0.0.0.0:8444 ssl |
| KONG\_DNS\_RESOLVER | DNS resolver for Kong (e.g., Docker's internal). | 127.0.0.11 |

**Frontend & Backend (Shared)**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| FRONTEND\_PORT | The port that the frontend Vue 3 app will run on. | 8090 |
| VUE\_APP\_API\_URL | Path for the frontend to reach the backend API. | https://\<your-reverse-proxy\>/api |
| VUE\_PROXY\_HOST | Target for the Vue development proxy. | kong:8010 |
| CSP\_CONNECT\_SRC | Content Security Policy connect-src directive. | 'self' http://localhost... |
| CORS\_ALLOWED\_ORIGINS | Allowed origins for CORS. | http://localhost,https://genie-ai... |

**Backend Service**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| NODE\_ENV | Sets the application environment. | development or production |
| BACKEND\_PORT | Internal port the Node.js app listens on. | 3000 |
| API\_PREFIX | Global prefix for all API routes. | /api |
| JWT\_SECRET | Secret key for signing JSON Web Tokens. | UJeFROw+yRJeVOPiUTgdcXzl... |
| JWT\_EXPIRES\_IN | Expiration time for JWTs. | 24h |
| TRANSLATION\_CACHE | Switch on/off translation caching. | on |
| TRANSLATION\_CACHE\_HOST | Redis host for translation caching. | redis-cache |
| TRANSLATION\_CACHE\_PORT | Redis port. | 6379 |
| TRANSLATION\_CACHE\_PASSWORD | Password for the Redis cache. | \!@\#$$5678 |
| EMAIL\_HOST | SMTP server for sending emails. | your-smtp-host |
| EMAIL\_USER | SMTP username. | your-email-user |
| EMAIL\_PASSWORD | SMTP password. | your-smtp-password |
| EMAIL\_FROM | Noreply email address. | noreply@your-domain-name |
| OPEA\_HOST | Hostname for the OPEA backend service. | chatqna-xeon-backend-server |

**ArangoDB (Knowledge Base)**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| ARANGO\_PASSWORD | Root password for ArangoDB. | test |
| ARANGO\_DB\_NAME | Database name used by the backend. | genie-backend |
| ARANGO\_DB | Database name used by the frontend. | genie-frontend |
| ARANGO\_URL | Connection URL for ArangoDB. | http://arango-vector-db:8529 |
| ARANGO\_USER | Username for ArangoDB. | root |

**Document Repository Service**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| DOC\_REPO\_PORT | Internal port for the document service. | 3001 |
| DATAPREP\_HOST | Hostname for the Dataprep service. | http://localhost |
| DATAPREP\_PORT | Port for the Dataprep service. | 6007 |
| MAX\_FILE\_SIZE | Maximum file upload size in bytes (e.g., 50MB). | 52428800 |
| VIRUS\_SCANNING | Enable/disable ClamAV virus scanning. | true |
| CLAMSCAN\_HOST | Hostname for the ClamAV service. | 127.0.0.1 |
| CLAMSCAN\_PORT | Port for the ClamAV service. | 3310 |

**Dataprep & Retriever Services**

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| DATAPREP\_CHUNK\_SIZE | Size of document chunks for ingestion. | 500 |
| DATAPREP\_CHUNK\_OVERLAP | Overlap between document chunks. | 50 |
| DATAPREP\_ARANGO\_GRAPH\_NAME | Graph name for Dataprep to write to. | graph\_el\_salvador |
| RETRIEVER\_ARANGO\_GRAPH\_NAME | Graph name for Retriever to read from. | graph\_el\_salvador |
| RETRIEVER\_OPENAI\_EMBED\_MODEL | Embedding model used by the retriever. | text-embedding-3-small |
| ARANGO\_FILTER\_STRATEGY | Strategy for applying filters (e.g., OR, AND). | OR |

**AI Models & Inference Configuration**

These variables control the specific AI models used for generation, embeddings, and reranking.

| Variable | Description | Example Value |
| :---- | :---- | :---- |
| HUGGINGFACEHUB\_API\_TOKEN | API key for Hugging Face (Required for gated models). | hf\_... |
| VLLM\_API\_KEY | API key for the VLLM service. | eyJhb... |
| VLLM\_ENDPOINT | URL for the VLLM inference server. | http://vllm:80 |
| **Main Inference (vLLM)** |  |  |
| VLLM\_LLM\_MODEL\_ID | Model ID for the main chat/generation. | ibm-granite/granite-3.3-2b-instruct |
| VLLM\_GPU\_UTIL | GPU Memory Utilization for main model (0.0 \- 1.0). | 0.65 (Standard) / 0.5 (T4) |
| VLLM\_MAX\_MODEL\_LEN | Context window size for main model. | 4096 (Standard) / 2048 (T4) |
| VLLM\_DTYPE | Data type for model weights (half, bfloat16). | half (T4), bfloat16 (Ampere+) |
| **Guardrails (Translation)** |  |  |
| VLLM\_TRANSLATION\_MODEL\_ID | Model ID for guardrails/translation tasks. | google/gemma-3-1b-it |
| VLLM\_TRANSLATION\_GPU\_UTIL | GPU Memory Utilization for guardrail model. | 0.15 (Standard) / 0.2 (T4) |
| VLLM\_TRANSLATION\_MAX\_MODEL\_LEN | Context window for guardrail model. | 2048 |
| VLLM\_TRANSLATION\_DTYPE | Data type for guardrail model. | bfloat16 |
| **Embeddings & Reranking** |  |  |
| EMBEDDING\_MODEL\_ID | Model ID for embeddings. | BAAI/bge-base-en-v1.5 |
| TEI\_EMBED\_MODEL | TEI embedding model (must match above). | BAAI/bge-base-en-v1.5 |
| RERANKER\_MODEL\_ID | Model ID for reranking. | cross-encoder/ms-marco-MiniLM-L-6-v2 |

#### 3\. Model Selection and GPU Compatibility

The GENIE.AI framework relies on four distinct AI models working in concert. Configuring these correctly in your .env file is the single most important factor for system stability and performance.

**The Four Key Model Parameters:**

1. **VLLM\_LLM\_MODEL\_ID**: The main "brain" of the chatbot (e.g., Granite 3B). It generates the final answer based on retrieved context.  
2. **VLLM\_TRANSLATION\_MODEL\_ID**: A smaller, specialized model (e.g., Gemma 2B) used for guardrails and translation tasks to offload work from the main model.  
3. **EMBEDDING\_MODEL\_ID**: Converts documents and queries into mathematical vectors. This determines search accuracy.  
4. **RERANKER\_MODEL\_ID**: A specialized model that double-checks search results for relevance. This is the "quality control" step.

**Hardware Profiles and Recommended Configurations:**

Select the profile below that matches your GPU hardware to avoid "Out of Memory" (OOM) crashes or architecture incompatibility errors.

**Profile A: The "Entry Level" Profile (NVIDIA Tesla T4 \- 16GB VRAM)**

* **Status:** Restricted / Legacy.  
* **Challenge:** The T4 has limited memory (16GB) and older compute architecture (Turing). It does **not** support bfloat16, requiring float16 (half precision) which impacts stability.  
* **Recommended Configuration:**  
  * **LLM:** ibm-granite/granite-3.3-2b-instruct (Small enough to fit alongside other services).  
  * **Embeddings:** BAAI/bge-base-en-v1.5.  
  * **Reranker:** cross-encoder/ms-marco-MiniLM-L-6-v2.  
    * **CRITICAL:** Do not run BAAI/bge-reranker-v2-m3 on a T4. It uses an XLM-RoBERTa architecture that may cause compatibility issues with the T4-optimized TEI images, and its memory footprint is too large for a shared 16GB card.  
  * **Env Settings:** Ensure VLLM\_DTYPE=half and keep VLLM\_MAX\_MODEL\_LEN at 2048\.

After launching services and waiting for the service startup: the following is about how the entry level profile should look in the GPU:

`+-----------------------------------------------------------------------------------------+`  
`| NVIDIA-SMI 550.163.01             Driver Version: 550.163.01     CUDA Version: 12.4     |`  
`|-----------------------------------------+------------------------+----------------------+`  
`| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |`  
`| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |`  
`|                                         |                        |               MIG M. |`  
`|=========================================+========================+======================|`  
`|   0  Tesla T4                       Off |   00000000:01:01.0 Off |                    0 |`  
`| N/A   33C    P0             26W /   70W |   14099MiB /  15360MiB |      0%      Default |`  
`|                                         |                        |                  N/A |`  
`+-----------------------------------------+------------------------+----------------------+`

`+-----------------------------------------------------------------------------------------+`  
`| Processes:                                                                              |`  
`|  GPU   GI   CI        PID   Type   Process name                              GPU Memory |`  
`|        ID   ID                                                               Usage      |`  
`|=========================================================================================|`  
`|    0   N/A  N/A     14319      C   VLLM::EngineCore                             7774MiB |`  
`|    0   N/A  N/A     16411      C   /usr/bin/python3                             5480MiB |`  
`|    0   N/A  N/A     17763      C   text-embeddings-router                        370MiB |`  
`|    0   N/A  N/A     17810      C   text-embeddings-router                        210MiB |`  
`|    0   N/A  N/A     18355      C   python                                        248MiB |`  
`+-----------------------------------------------------------------------------------------+`

***GPU memory profile: Entry Level***

**Profile B: The "Enterprise" Profile (RTX 6000 Ada, L40S, A100 \- 48GB+ VRAM)**

* **Status:** Production Ready.  
* **Advantage:** These cards support bfloat16 for higher precision and stability. 48GB allows for larger context windows and concurrent processing.  
* **Recommended Configuration:**  
  * **LLM:** ibm-granite/granite-3.3-2b-instruct or meta-llama/Meta-Llama-3.1-70B-Instruct-AWQ (Quantized).  
  * **Embeddings:** BAAI/bge-base-en-v1.5 or BAAI/bge-m3.  
  * **Reranker:** cross-encoder/ms-marco-MiniLM-L-6-v2.  
  * **Env Settings:** Use VLLM\_DTYPE=bfloat16 and enable VLLM\_ATTENTION\_BACKEND=FLASH\_ATTN (if supported) for maximum throughput.

After launching services and waiting for the service startup: the following is about how the enterprise profile should look in the GPU:

`+-----------------------------------------------------------------------------------------+`  
`| NVIDIA-SMI 580.95.05              Driver Version: 580.95.05      CUDA Version: 13.0     |`  
`+-----------------------------------------+------------------------+----------------------+`  
`| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |`  
`| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |`  
`|                                         |                        |               MIG M. |`  
`|=========================================+========================+======================|`  
`|   0  NVIDIA RTX 6000 Ada Gene...    On  |   00000000:00:05.0 Off |                  Off |`  
`| 31%   47C    P8             34W /  300W |   43359MiB /  49140MiB |      0%      Default |`  
`|                                         |                        |                  N/A |`  
`+-----------------------------------------+------------------------+----------------------+`

`+-----------------------------------------------------------------------------------------+`  
`| Processes:                                                                              |`  
`|  GPU   GI   CI              PID   Type   Process name                        GPU Memory |`  
`|        ID   ID                                                               Usage      |`  
`|=========================================================================================|`  
`|    0   N/A  N/A          829239      C   VLLM::EngineCore                      33060MiB |`  
`|    0   N/A  N/A          831611      C   VLLM::EngineCore                       8402MiB |`  
`|    0   N/A  N/A          833589      C   text-embeddings-router                  540MiB |`  
`|    0   N/A  N/A          833600      C   text-embeddings-router                  700MiB |`  
`|    0   N/A  N/A          834222      C   python                                  626MiB |`  
`+-----------------------------------------------------------------------------------------+`

***GPU memory profile: Enterprise***

#### 4\. Launch Services

Prerequisite: Download OCR Models  
Because the framework uses EasyOCR during data prep and model downloads inside containers can be slow or unreliable, you must download these files to the root of your project folder first.

Bash

wget \-O craft\_mlt\_25k.zip https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft\_mlt\_25k.zip  
wget \-O english\_g2.zip https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/english\_g2.zip

Launch Option A: Standard Launch (RTX 6000 Ada / A100 / H100)  
Use this command if you are running on modern Ampere or Ada generation hardware with sufficient VRAM (24GB+). This uses the standard docker-compose.yaml.

Bash

docker compose up \-d \--build

Launch Option B: Legacy Launch (NVIDIA Tesla T4)  
Use this command only if you are running on a Tesla T4 (16GB). This uses docker-compose-t4.yaml, which applies specific overrides:

* **Precision:** Forces dtype=half (float16).  
* **Images:** Uses specific turing tags for TEI containers to ensure CUDA 7.5 compatibility.  
* **Memory Safety:** Reduces batch tokens and GPU utilization limits to prevent system crashes.

Bash

docker compose \-f docker-compose-t4.yaml up \-d \--build

5\. Initial Verification  
After the containers launch, check their status. It may take several minutes for the large AI models (vLLM) to download and initialize.

Bash

\# Check container status  
docker ps

\# Monitor the vLLM initialization (wait for "Application startup complete")  
docker logs \-f vllm-vllm-2

⚠️ **IMPORTANT: EXPECTED ERRORS**  
At this stage, while the containers are running, they are not yet configured. If you inspect the backend logs now, you will see errors related to missing databases (ArangoDB) and unconfigured routes (Kong). This is normal. Do NOT attempt to debug these errors yet. Proceed immediately to Step 4 to complete the necessary infrastructure configuration.  
**This is normal. Do NOT attempt to debug these errors yet.**

Proceed immediately to **Step 4** to complete the necessary infrastructure configuration.

---

### **Step 4: Infrastructure Configuration**

Once the base services are running (Step 3), you must configure the core infrastructure components before the system is usable.

#### **4.1 ArangoDB Database Initialization**

While the arango-vector-db service is running, the specific application databases must be created.

1. Access the ArangoDB web interface at [http://localhost:8529](http://localhost:8529) (login with root and the password defined in your .env).  
2. Create the necessary databases as defined in your environment variables (default: genie-ai) \- ensure both the frontend and backend services use the same database.

#### **4.2 NGINX and Kong API Gateway Configuration**

There are Nginx default.conf files available for both three-node and single-node deployments:

1. For three-node deployments, use the default default.conf and modify the upstream addresses  
2. for single-node deployments, use the default.conf-single-node

Kong requires specific initialization and configuration to route traffic correctly.

1. **Initialize Database:** Execute these commands to prepare the Kong postgres database:

Bash

docker compose exec kong-database psql \-U kong postgres \-c "CREATE DATABASE kong;"

docker compose exec kong-database psql \-U kong postgres \-c "GRANT ALL PRIVILEGES ON DATABASE kong TO kong;"

docker compose run \--rm kong kong migrations bootstrap docker compose restart kong

2. **Apply Configuration:** Navigate to the config directory, stage the correct configuration file (overwriting the default kong\_config.json), and run the apply script (ensure that curl and jq are installed).  
   For Single-Node installation: 

Bash

cd api-gateway-solution/new-config/

cp kong\_config.json-single-node kong\_config.json

chmod \+x [manage-kong-config.sh](http://manage-kong-config.sh)

sudo apt update sudo apt install jq

./manage-kong-config.sh \-a

\*(For Three-Node installation, simply run ./manage-kong-config.sh \\-a as kong\\\_config.json is the default).\*

**Enter the correct hosts and expect the following output**:

Bash

govstack@bb-ai-gpu-01:\~/genie-ai-replica-single-node/api-gateway-solution/new-config$ ./manage-kong-config.sh \-a  
This script will configure your Kong instance.  
Please provide the required connection details.

\--- Kong Admin API Details \---  
Enter Kong host \[default: localhost\]:  
Enter Kong admin port \[default: 8001\]:

\--- Backend Service Details \---  
Enter 'express-api' service host \[default: localhost\]: backend  
Enter 'express-api' service port \[default: 3000\]:

Enter 'document-repository' service host \[default: localhost\]: document-repository  
Enter 'document-repository' service port \[default: 3001\]:

\[2025-11-08 14:12:02\] Applying configuration from kong\_config.json  
\[2025-11-08 14:12:02\] Using Kong Admin API at: [http://localhost:8001](http://localhost:8001)  
\[2025-11-08 14:12:02\] Setting 'express-api' to: backend:3000  
\[2025-11-08 14:12:02\] Setting 'document-repository' to: document-repository:3001  
\[2025-11-08 14:12:02\] Processing service: express-api  
\[2025-11-08 14:12:02\] Service 'express-api' applied successfully.  
...

#### **4.3 Nginx Configuration**

Nginx acts as the reverse proxy and SSL termination point.

1\. Navigate to api-gateway-solution/nginx.  
2\. Select the appropriate configuration file:  
\* For \*\*Single-Node\*\*, use: default.conf-single-node (rename to default.conf if necessary for volume mapping, or adjust mapping).  
\* For \*\*Three-Node\*\*, use: default.conf.  
3\. Ensure your SSL certificates are placed in the mapped volumes defined in docker-compose.yaml (nginx\\\_certs volume or ./api-gateway-solution/nginx/certs bind mount).

---

### **Step 5: Knowledge Base Population & User Setup**

With the infrastructure configured, you can now instantiate the knowledge hierarchy designed in Step 1 and create the required system accounts.

#### **Method 1: Automated Script Approach (Recommended for Initial Setup)**

This method is ideal for initial deployments, migrating an existing instance, or automated CI/CD workflows.

##### **5.1 Prepare Script Environment** You must source the environment configuration before running schema scripts to set necessary variables like database URLs and credentials: i.e. modify the set\_env.sh script for the correct database environment

Bash

cd components/gov-chat-backend/scripts/new-schema-scripts

chmod \+x set-env.sh source set-env.sh

5.2 Create Database Schema

Use the arango-schema-creator.js script to generate the collections, indexes, and graphs.

Bash

\# Ensure you are still in the new-schema-scripts directory and environment is set  
npm install arangojs node arango-schema-creator.js ./arango-schema.json

##### 5.3 Create Initial User Accounts

You must create the default Admin and Manager accounts. These are required for the application to load correctly and for full integration with the Document Repository.

Bash

\# Create the Admin account  
node create-genie-ai-admin-account.js

\# Create the Manager account  
node create-genie-ai-manager-account.js

**Note:** These scripts create accounts with default credentials. It is highly recommended to change these passwords immediately after first login via the Admin Dashboard.

##### 5.4 Populate Hierarchy

Use the create-knowledge-hierarchy.js script to import your Category/Service structure.

* *Note:* Ensure schema validation is temporarily disabled on serviceCategories, services, and categoryServices collections if using an older schema version.

Bash

\# Return to the parent scripts directory if the hierarchy file is there, or adjust the path.  
cd ..  
node create-knowledge-hierarchy.js \--file ./my-hierarchy.json

##### 5.5 Generate Translations

(Optional) Use create-translations.js to auto-generate labels for other supported languages (requires Google Cloud credentials).

#### **Method 2: Manual Admin Dashboard Approach**

This method is ideal for users who prefer a visual interface, or for making incremental changes after an initial setup. This can be done after you have completed **Step 6** and logged into the application.

---

### **Step 6: Final Verification and Launch**

After all configuration steps are complete, you must restart the services to ensure they pick up the new configurations and verify the system is healthy.

1. Restart Services: \`\`\`bash  
   docker-compose down  
   docker-compose up \-d

2\. Verify Service Health:  
Check that all containers are running and healthy.

Bash

docker ps

*Look for (healthy) status next to critical services like kong, kong-database, vllm, and arango-vector-db.* 3\. Check Logs for Errors:

Inspect the logs again to ensure no new critical errors have appeared after the restart.

Bash

docker-compose logs \-f

4. Initial Login:  
   Access the application in your browser (e.g., [https://localhost](https://localhost) or your configured domain). Log in using the default Admin credentials created in Step 5.3:  
   * **Username:** Admin  
   * **Password:** ADMINadmin (admin123)

---

### **Step 7: Post-Launch Configuration (Manual Dashboard)**

Once you have logged in as Admin, you can use the visual dashboard to manage your knowledge base.

#### **7.1 Manage the Knowledge Hierarchy**

Navigate to the **Knowledge Hierarchy** tab in the Admin Dashboard.

* **Add Categories:** Click "+ Add New Category" for top-level entries.  
* **Add Services:** Hover over a category and click the plus icon for nested services.  
* **Edit/Delete:** Use hover icons to modify entries.  
* **Translations:** Use the form to add display translations for different languages.

#### **7.2 Upload and Ingest Documents**

Navigate to the **Document Management** tab.

1. **Upload:** Click "+ Upload Files" or "+ Add from Link". Status will be "Pending".  
2. **Apply Labels:** Click the document, and use the "Labels" multi-select dropdown to apply relevant categories/services from your hierarchy.  
3. **Ingest:** Click "Ingest" to trigger chunking, embedding, and storage. Status will update to "Ingested".

