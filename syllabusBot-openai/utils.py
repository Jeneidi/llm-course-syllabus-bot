import re
from pypdf import PdfReader

def readPdf(path):
    reader = PdfReader(path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text

def chunkText(text, max_chars=2000):
    paragraphs = re.split(r"\n\s*\n", text)
    chunks = []
    current = ""
    for p in paragraphs:
        if len(current) + len(p) < max_chars:
            current += p + "\n"
        else:
            chunks.append(current.strip())
            current = p + "\n"
    if current.strip():
        chunks.append(current.strip())
    return chunks
