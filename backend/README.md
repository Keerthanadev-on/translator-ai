---
title: Real-Time Translator API
emoji: 🌐
colorFrom: purple
colorTo: pink
sdk: docker
pinned: false
---

<div align="center">

# 🌸 Real-Time Translator API

*breaking language barriers, one message at a time* ✨

![Python](https://img.shields.io/badge/Python-3.11-c5d2f8?style=for-the-badge&logo=python&logoColor=white&labelColor=4f0c28)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-c5d2f8?style=for-the-badge&logo=fastapi&logoColor=white&labelColor=4f0c28)
![Groq](https://img.shields.io/badge/Powered%20by-Groq-c5d2f8?style=for-the-badge&logoColor=white&labelColor=4f0c28)

</div>

---

## ✨ what it does

a lightweight translation API that lets you speak, type, and be understood anywhere in the world 🌍

- 🎙️ **speech-to-text** — powered by Whisper large v3 turbo
- 🌐 **translation** — accurate, natural translations via Llama
- 🔍 **auto language detection** — no need to specify the source language
- ⚡ **fast** — minimal overhead, straight to the point

---

## 🌸 endpoints

| method | route | what it does |
|--------|-------|-------------|
| `GET` | `/health` | check if the API is alive 💓 |
| `POST` | `/api/transcribe` | audio → text |
| `POST` | `/api/translate` | text → translated text |
| `POST` | `/api/speak` | text → speech audio |
| `POST` | `/api/pipeline` | audio → transcript → translation → speech |

---

## 🔑 setup

you'll need a [Groq API key](https://console.groq.com) — it's free 🎉

set it as a secret in your Space settings:
```
GROQ_API_KEY=your_key_here
```

---

## 💌 example

```python
import requests

res = requests.post("https://your-space.hf.space/api/translate", data={
    "text": "hello, how are you?",
    "target_language": "Spanish",
    "source_language": "English"
})

print(res.json())
# { "translated_text": "hola, ¿cómo estás?" }
```

---

<div align="center">

made with 💜 and a little bit of plum

</div>
