from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
import os
import uuid

app = FastAPI()

# Configure CORS to allow frontend access (adjust ports as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HISTORY_FILE = "chat_history.json"

def load_chats():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_chats(chats):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(chats, f, indent=2)

def get_chat_by_id(chats, chat_id):
    for chat in chats:
        if chat["id"] == chat_id:
            return chat
    return None

@app.get("/api/conversations")
def list_conversations():
    chats = load_chats()
    # Return only id and title for sidebar display
    return [{"id": c["id"], "title": c["title"]} for c in chats]

@app.get("/api/conversations/{chat_id}")
def get_conversation(chat_id: str):
    chats = load_chats()
    chat = get_chat_by_id(chats, chat_id)
    if chat:
        return chat["messages"]
    return []

@app.post("/api/conversations")
def create_conversation():
    chats = load_chats()
    new_id = str(uuid.uuid4())
    new_chat = {
        "id": new_id,
        "title": "New Chat",
        "messages": []
    }
    chats.append(new_chat)
    save_chats(chats)
    return {"id": new_id, "title": "New Chat"}

@app.post("/api/conversations/{chat_id}/message")
async def add_message(chat_id: str, request: Request):
    data = await request.json()
    user_message = data.get("message", "").strip()
    chats = load_chats()
    chat = get_chat_by_id(chats, chat_id)
    if not chat:
        return {"error": "Chat not found"}

    # Automatically update the chat title on first user message
    if chat["title"] == "New Chat" and len(chat["messages"]) == 0 and user_message:
        # Use first 6 words or up to 60 chars as the new title
        first_line = user_message.split('\n')[0]
        words = first_line.split()
        if len(words) > 6:
            new_title = " ".join(words[:6]) + "..."
        else:
            new_title = first_line[:60]
        chat["title"] = new_title

    # Append user message
    chat["messages"].append({"role": "user", "content": user_message})

    # Prepare system instruction for the model
    system_message = {
        "role": "system",
        "content": "Always answer in clear paragraphs and use bullet points when listing information."
    }

    # Build messages list for Ollama API
    messages_for_model = [system_message] + chat["messages"]

    ollama_payload = {
        "model": "llama3",
        "messages": messages_for_model,
        "stream": False
    }

    response = requests.post("http://localhost:11434/api/chat", json=ollama_payload)
    response.raise_for_status()
    ai_message = response.json()["message"]["content"]

    # Append AI response
    chat["messages"].append({"role": "assistant", "content": ai_message})

    # Save updated chat list
    save_chats(chats)

    # Return AI response for frontend
    return {"role": "assistant", "content": ai_message}
