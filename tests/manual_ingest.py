
import json
import base64
import os

file_path = "/home/andrei/work/genie-ai-replica/temp/Romanian_Authorities_Services_Guide.md"
file_name = os.path.basename(file_path)

with open(file_path, "rb") as f:
    file_content = f.read()
    file_b64 = base64.b64encode(file_content).decode("utf-8")

payload = {
    "fileId": "test-manual-001",
    "fileName": file_name,
    "fileBase64": file_b64,
    "fileType": "md",
    "uploadDate": "2026-01-25",
    "fileLabels": [],
    "chunk_size": 150,
    "chunk_overlap": 20
}

with open("ingest_payload.json", "w") as f:
    json.dump(payload, f)

print("Generated ingest_payload.json")
