from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os

# Initialize FastAPI
app = FastAPI()

# Define the OPEA Google Translate Microservice URL
TRANSLATION_SERVICE_URL = "http://localhost:8001/translate"

# Define the OPEA Retrieval API endpoint (replace with actual endpoint)
OPEA_RETRIEVER_URL = "https://opea.example.com/api/retrieve"

# Define request model
class QueryRequest(BaseModel):
    text: str
    source_language: str  # e.g., "id" (Indonesian), "jv" (Javanese), "su" (Sundanese)
    target_language: str = "en"  # Default to English for retrieval


def translate_text(text: str, source_language: str, target_language: str) -> str:
    """Calls the OPEA Google Translate Microservice to translate text."""
    payload = {"text": text, "source_language": source_language, "target_language": target_language}
    response = requests.post(TRANSLATION_SERVICE_URL, json=payload)
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Translation service failed.")
    
    return response.json().get("translated_text", "")


@app.post("/retrieve")
async def retrieve_data(request: QueryRequest):
    """
    Pre-processes user input by translating it, retrieves data from OPEA, and translates response back.
    """
    try:
        # Step 1: Translate user query to English
        translated_query = translate_text(request.text, request.source_language, request.target_language)

        # Step 2: Send translated query to OPEA's retrieval system
        opea_payload = {"query": translated_query}
        response = requests.post(OPEA_RETRIEVER_URL, json=opea_payload)

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to retrieve data from OPEA.")

        retrieved_text = response.json().get("response", "")

        # Step 3: Translate OPEA's response back to the original language
        final_response = translate_text(retrieved_text, "en", request.source_language)

        return {
            "original_query": request.text,
            "translated_query": translated_query,
            "retrieved_text": retrieved_text,
            "final_response": final_response,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run the microservice (for local development)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
