"""
One-time script to create the Azure AI Search index and upload ArchMind IQ documents.

Usage:
    cd /path/to/AzureAgentLeague
    pip install azure-search-documents python-dotenv
    python scripts/setup_iq_index.py

Requires in .env (or environment):
    AZURE_SEARCH_ENDPOINT=https://archmind.search.windows.net
    AZURE_SEARCH_API_KEY=<your-admin-key>
    AZURE_SEARCH_INDEX_NAME=archmind-iq
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SimpleField,
    SearchableField,
)

ENDPOINT = os.environ.get("AZURE_SEARCH_ENDPOINT", "")
API_KEY = os.environ.get("AZURE_SEARCH_API_KEY", "")
INDEX_NAME = os.environ.get("AZURE_SEARCH_INDEX_NAME", "archmind-iq")

if not ENDPOINT or not API_KEY:
    print("ERROR: AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY must be set in .env")
    sys.exit(1)

credential = AzureKeyCredential(API_KEY)

# ── Create or update index ────────────────────────────────────────────────────

index_client = SearchIndexClient(endpoint=ENDPOINT, credential=credential)

fields = [
    SimpleField(name="id", type=SearchFieldDataType.String, key=True),
    SearchableField(name="title", type=SearchFieldDataType.String),
    SearchableField(name="content", type=SearchFieldDataType.String),
    SimpleField(name="service", type=SearchFieldDataType.String, filterable=True),
    SimpleField(name="category", type=SearchFieldDataType.String, filterable=True),
]

index = SearchIndex(name=INDEX_NAME, fields=fields)

try:
    index_client.create_or_update_index(index)
    print(f"Index '{INDEX_NAME}' created/updated.")
except Exception as e:
    print(f"ERROR creating index: {e}")
    sys.exit(1)

# ── Upload documents ──────────────────────────────────────────────────────────

docs_path = Path(__file__).parent / "iq_documents.json"
with open(docs_path) as f:
    documents = json.load(f)

search_client = SearchClient(
    endpoint=ENDPOINT,
    index_name=INDEX_NAME,
    credential=credential,
)

try:
    result = search_client.upload_documents(documents)
    succeeded = sum(1 for r in result if r.succeeded)
    failed = sum(1 for r in result if not r.succeeded)
    print(f"Uploaded {succeeded} documents. Failed: {failed}.")
    if failed:
        for r in result:
            if not r.succeeded:
                print(f"  FAILED: {r.key} — {r.error_message}")
except Exception as e:
    print(f"ERROR uploading documents: {e}")
    sys.exit(1)

print("Done. Run a test query:")
print(f'  python -c "')
print(f'from azure.search.documents import SearchClient')
print(f'from azure.core.credentials import AzureKeyCredential')
print(f'c = SearchClient(\\"{ENDPOINT}\\", \\"{INDEX_NAME}\\", AzureKeyCredential(\\"{API_KEY}\\"))')
print(f'for r in c.search(\\"image processing azure\\", top=2): print(r[\\"title\\"])')
print(f'"')
