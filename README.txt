# WhatsApp Daily Motivational Quote Sender

A Node.js app that sends daily motivational quotes + images via WhatsApp using local LLM (Ollama).

## Features

- 🧠 AI-generated quotes using `Llama3` (via Ollama)
- 🖼️ Sends a different image every day
- 📬 Supports multiple contacts/groups
- 🕒 Runs daily at scheduled time
- 🚫 No OpenAI API key needed

## How to Run

1. Make sure Ollama is running: `ollama run llama3`
2. Add your contact IDs in `contacts.json`
3. Place images in `/images`
4. Run: `node whatsapp-crypto-sender.js`