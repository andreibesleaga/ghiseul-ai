from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google_translator import GoogleTranslator
import os

app = FastAPI()

# Initialize Google Translator
translator = GoogleTranslator()

class TranslationRequest(BaseModel):
    text: str
    source_language: str
    target_language: str

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    """
    Translates text using Google Translate API instead of an LLM.
    """
    try:
        translated_text = translator.translate_text(
            text=request.text,
            target_language=request.target_language,
            source_language=request.source_language
        )
        return {"translated_text": translated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8001)
