import os
import tempfile
from openai import OpenAI
from dotenv import load_dotenv
from utils import readPdf, chunkText

load_dotenv()
client = OpenAI()

def ingestData():
    basePdf = "pdfFiles"
    storeBase = "vectorStores"

    for course in os.listdir(basePdf):
        coursePath = os.path.join(basePdf, course)
        if not os.path.isdir(coursePath):
            continue

        pdfs = [f for f in os.listdir(coursePath) if f.endswith(".pdf")]
        if not pdfs:
            continue

        fullText = ""
        for pdf in pdfs:
            fullText += readPdf(os.path.join(coursePath, pdf)) + "\n"

        chunks = chunkText(fullText)

        # vector stores live on client.vector_stores
        vectorStore = client.vector_stores.create(name=f"{course}_store")
        storeId = vectorStore.id

        os.makedirs(os.path.join(storeBase, course), exist_ok=True)
        with open(os.path.join(storeBase, course, "store_id.txt"), "w") as f:
            f.write(storeId)

        # upload chunks
        for chunk in chunks:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="w") as tmp:
                tmp.write(chunk)
                tmpPath = tmp.name
            
            # OPEN THE FILE — required in 2.8.1
            with open(tmpPath, "rb") as f:
                client.vector_stores.file_batches.upload_and_poll(
                    vector_store_id=storeId,
                    files=[f]
                )

            os.remove(tmpPath)
