# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
from langdetect import detect


class ChatTemplate:
    @staticmethod
    def generate_translation_prompt(source_text):
        source_text = source_text.strip()
        try:
            lang = detect(source_text)
        except:
            lang = "en"

        if lang == "en":
            return [
                {
                    "role": "user", 
                    "content": f"Translate this English text to Swahili. Return ONLY the translation:\n{source_text}"
                }
            ] 
        else:
            return [
                {
                    "role": "user",
                    "content": f"Tafsiri maandishi haya ya Kiswahili kwa Kiingereza. Toa tu tafsiri:\n{source_text}"
                }
            ]