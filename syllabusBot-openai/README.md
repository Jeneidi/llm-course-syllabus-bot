A retrieval and question-answering project using OpenAI’s vector stores.

Overview:
This version of the syllabus bot was my attempt to rebuild the same idea as Version 1, but using the official OpenAI ecosystem instead of manually wiring everything with Chroma and VoyageAI. I wanted to understand how retrieval, file uploads, vector stores, and assistant runs work in modern LLM pipelines. This version supports multiple courses, handles PDF ingestion more cleanly, and uses OpenAI’s file search tools instead of manually embedding text chunks. It feels much closer to how production-grade retrieval systems actually work.

Why I Built This:
The first version taught me the low-level mechanics of retrieval, but everything was manual: manually chunking, manually embedding, manually querying, and manually building the context. Once I understood that, I wanted to learn how OpenAI’s more automated retrieval workflow works. This meant learning how vector stores behave, how files get embedded, how assistants connect to retrieval tools, and how thread-based interactions work. I also needed to learn how to structure a multi-file LLM project cleanly and handle multiple courses at once instead of just a single syllabus.

Dataset:
The “dataset” for this project is just PDFs actual AI generated course syllabi, as I cannot use any real ones for privacy reasons. Each course gets its own folder of PDFs, and the system turns them into searchable vector stores.

What I Did (Step by Step):
1. I wrote a PDF loader that extracts raw text from each page using PyPDF. This step already taught me how inconsistent text extraction can be across different syllabi.

2. I split the extracted text into manageable chunks to prepare it for embedding. Instead of overcomplicating it, I kept the chunking simple but reliable so the vector store could index meaningful sections rather than huge blobs of text.

3. I uploaded all the chunks into OpenAI’s vector store system. This was my first time using file uploads as embeddings rather than making embedding API calls myself.

4. I stored the vector store ID locally so the system wouldn’t re-ingest the PDFs each time. This helped me understand why persistent storage matters in retrieval workflows.

5. I created a separate assistant for each course and connected that assistant to the correct vector store using OpenAI’s file_search tool. This taught me how retrieval tools attach to assistants and how the assistant uses them during a run.

6. I built a question loop using threads and runs. Every question gets its own thread, and the assistant retrieves context through the vector store instead of me manually passing it in. This let me see how OpenAI manages retrieval internally.

7. I built a simple command line interface so I can pick a course, type a question, and get an answer. This final step tied everything together and made the system feel like a complete application instead of separate scripts.

How to Run:
Install the required packages from requirements.txt, add your syllabi into the pdfFiles folder organized by course name, set your OpenAI API key in the .env file, and run main.py. The first run performs ingestion, and every run after that uses the saved vector store IDs.

What I Learned:
I learned how much easier vector-based retrieval becomes when the API handles chunking and embeddings for you. I learned the differences between manual and automated retrieval, and how OpenAI’s approach abstracts away most of the low-level details I had to handle in Version 1. I also learned the importance of structuring a multi-course, multi-file project cleanly, how to attach retrieval tools to assistants properly, and how thread-based workflows operate. Overall, this version taught me how real LLM applications are built when using official tools rather than building everything manually.