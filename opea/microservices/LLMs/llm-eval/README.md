LLM Testing Pipeline
====================

This repository provides a codebase for testing and evaluating large language models (LLMs) on a selected dataset, focusing on question answering using retrieval augmented generation (RAG). The goal is to aid in model selection and evaluation for specific use cases.

**Overview**
The code conducts evaluations on sets of question-context-answer triplets. Each tested model takes a question and context as input and returns an answer that's compared with the reference answer, then scored by a larger model.

**Test Dataset**
The quality of the evaluation heavily relies on the quality of the dataset. To assemble the dataset, we suggest combining general questions and questions specific to the use case the selected model is intended for.