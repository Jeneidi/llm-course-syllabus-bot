A retrieval-based question-answering tool for course syllabi.

Overview:
This was the very first version of my syllabus question-answering project. I didn’t use OpenAI at all here. Instead, I built everything manually using VoyageAI for embeddings, Chroma as my vector database, and Groq’s LLaMA-3.1 model for the actual responses. I made this version before I even knew how vector stores or retrieval pipelines really worked, and building it forced me to understand each step instead of relying on automated tools.

Why I Built This:
I wanted a simple script where I could upload my syllabus and ask questions like “When are the exams?” or “How many assignments are there?” But I also wanted to actually learn how document-based AI retrieval works underneath the surface. This version only supports one document at a time, but that limitation turned out to be useful because it kept the workflow easy to understand while I was learning.

What I Did (Step by Step):
1. I loaded the entire PDF using a custom loader that extracts plain text. I didn’t use anything fancy like structured extraction — just raw text, which already taught me how messy PDFs can be.

2. I split the text into chunks by newline characters. This wasn’t the best chunking strategy, but it forced me to think about how context breaks affect retrieval.

3. I used VoyageAI’s embedding API to embed each chunk individually. This showed me what embedding latency feels like and why batching or better preprocessing matters.

4. I stored every chunk and its embedding inside ChromaDB using a persistent client. This was my first experience with a real vector database and understanding how IDs, documents, and embeddings work together.

5. When the user asked a question, I embedded the question using VoyageAI again and used Chroma’s .query() to find the closest chunks based on cosine similarity.

6. I took the top retrieved chunks, merged them into one context block, and sent that to Groq’s LLaMA-3.1 model along with the question. This was the first time I manually handled retrieval-augmented generation (RAG) instead of relying on a built-in solution.

7. I wrapped everything in a simple loop that lets me ask multiple questions. Nothing fancy, but it made the system feel like an actual tool instead of disconnected scripts.

Why This Project Matters:
This version is extremely manual, but that helped me understand how retrieval works at a low level: how to chunk text, how embeddings are generated, how vector stores store and retrieve information, and how an LLM uses the retrieved context. All of that made Version 2 much easier later on.