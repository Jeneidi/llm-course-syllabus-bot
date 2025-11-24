import os
import chromadb
from chromadb.config import Settings
from groq import Groq
from embedAndStore import embedAndStore
from dotenv import load_dotenv
load_dotenv()

def askQuestion(question, collectionName):
    chromaClient = chromadb.PersistentClient(path="/Users/jeneidi/Desktop/LLM Projects/syllabusBot/chromaStore")
    collection = chromaClient.get_or_create_collection(
        name="syllabusCollection",
        metadata={"hnsw:space": "cosine"},
        embedding_function=None
    )
    results = collection.query(query_texts=[question], n_results=3)
    context = "\n".join(results["documents"][0])
    client = Groq(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[
            {"role": "system", "content": "Use the provided context to answer the question accurately."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
        ]
    )
    return response.choices[0].message.content

def main():
    print("Embedding PDFs... (only needed the first time)")
    embedAndStore("pdfFiles", "syllabusCollection")
    print("Done.\n")
    while True:
        userInput = input("Ask a question about your syllabus (or type 'exit'): ")
        if userInput.lower() == "exit":
            break
        answer = askQuestion(userInput, "syllabusCollection")
        print("\nAnswer:")
        print(answer)
        print("\n")

if __name__ == "__main__":
    main()
