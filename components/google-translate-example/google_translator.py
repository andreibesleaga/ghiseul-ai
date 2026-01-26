from google.cloud import translate_v2 as translate
import os

class GoogleTranslator:
    def __init__(self):
        """
        Initialize Google Translate client using Google Cloud default credentials.
        Ensure GOOGLE_APPLICATION_CREDENTIALS is set to a valid JSON key file.
        """
        self.client = translate.Client()  # No api_key parameter needed

    def translate_text(self, text, target_language="en", source_language=None):
        """
        Translates text using Google Cloud Translate API.

        :param text: The text to translate.
        :param target_language: The target language code (e.g., 'en' for English).
        :param source_language: Optional source language (e.g., 'id' for Bahasa Indonesia).
        :return: Translated text.
        """
        result = self.client.translate(text, target_language=target_language, source_language=source_language)
        return result["translatedText"]

# Test module functionality
def main():
    """Test the module when run directly."""
    translator = GoogleTranslator()

    text = "Halo, bagaimana kabarmu?"
    translated = translator.translate_text(text, target_language="en", source_language="id")
    print(f"Translated Text: {translated}")

if __name__ == "__main__":
    main()
