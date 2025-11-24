import os
from pypdf import PdfReader

def loadPdfText(pdfFolderPath):
    allText = ""
    for fileName in os.listdir(pdfFolderPath):
        if fileName.lower().endswith(".pdf"):
            filePath = os.path.join(pdfFolderPath, fileName)
            reader = PdfReader(filePath)
            for page in reader.pages:
                pageText = page.extract_text()
                if pageText:
                    allText += pageText + "\n"
    return allText