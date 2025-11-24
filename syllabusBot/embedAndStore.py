import os
import chromadb
from voyageai import Client
from loadPdfText import loadPdfText
from dotenv import load_dotenv

load_dotenv()

def embedAndStore(pdfFolderPath, collectionName):
    client = Client(api_key=os.getenv("VOYAGE_API_KEY"))
    text = loadPdfText(pdfFolderPath)
    textChunks = text.split("\n")
    chromaClient = chromadb.PersistentClient(path="/Users/jeneidi/Desktop/LLM Projects/syllabusBot/chromaStore")
    collection = chromaClient.get_or_create_collection(
        name=collectionName,
        metadata={"hnsw:space": "cosine"},
        embedding_function=None
    )


    for index, chunk in enumerate(textChunks):
        if chunk.strip():
            embedding = client.embed(
                texts=[chunk],
                model="voyage-large-2"
            ).embeddings[0]
            collection.add(
                documents=[chunk],
                embeddings=[embedding],
                ids=[str(index)]
            )
