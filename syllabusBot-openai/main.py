import os
from openai import OpenAI
from dotenv import load_dotenv
from ingest import ingestData

load_dotenv()
client = OpenAI()

def getCourses():
    base = "vectorStores"
    return [c for c in os.listdir(base) if os.path.isdir(os.path.join(base, c))]

def loadStoreId(course):
    path = os.path.join("vectorStores", course, "store_id.txt")
    with open(path, "r") as f:
        return f.read().strip()

def getOrCreateAssistant(course, storeId):
    return client.beta.assistants.create(
        name=f"{course}_assistant",
        model="gpt-4o-mini",
        description="Syllabus assistant",
        tools=[{"type": "file_search"}],
        tool_resources={
            "file_search": {
                "vector_store_ids": [storeId]
            }
        }
    )

def askQuestion(question, course):
    storeId = loadStoreId(course)
    assistant = getOrCreateAssistant(course, storeId)

    thread = client.beta.threads.create()

    client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=question
    )

    run = client.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id=assistant.id
    )

    while True:
        status = client.beta.threads.runs.retrieve(
            thread_id=thread.id,
            run_id=run.id
        )
        if status.status == "completed":
            break

    messages = client.beta.threads.messages.list(
        thread_id=thread.id
    )

    return messages.data[0].content[0].text

def main():
    ingestData()

    while True:
        courses = getCourses()
        print("\nAvailable Courses:")
        for i, c in enumerate(courses, 1):
            print(f"{i}) {c}")

        choice = input("\nSelect a course number (or type exit): ")
        if choice.lower() == "exit":
            break

        course = courses[int(choice) - 1]
        question = input("\nAsk a question: ")

        answer = askQuestion(question, course)

        print("\nAnswer:")
        print(answer)
        print("\n")


if __name__ == "__main__":
    main()
