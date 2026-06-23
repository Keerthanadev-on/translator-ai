<div align="center">

# 🌸 translator-ai

*speak. translate. be understood anywhere in the world* ✨

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-translator--ai-C5D2F8?style=for-the-badge&labelColor=4F0C28)](https://translator-ai-gk.netlify.app)
[![Backend](https://img.shields.io/badge/⚡_API-Render-C5D2F8?style=for-the-badge&labelColor=4F0C28)](https://translator-ai-d78x.onrender.com)
[![React](https://img.shields.io/badge/React-TypeScript-C5D2F8?style=for-the-badge&logo=react&labelColor=4F0C28)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-C5D2F8?style=for-the-badge&logo=fastapi&labelColor=4F0C28)](https://fastapi.tiangolo.com)

<img src="https://img.shields.io/github/last-commit/Keerthanadev-on/translator-ai?style=flat-square&color=C5D2F8&labelColor=4F0C28" />
<img src="https://img.shields.io/github/languages/top/Keerthanadev-on/translator-ai?style=flat-square&color=C5D2F8&labelColor=4F0C28" />

</div>

---

## 💜 what is this?

a real-time AI translation app that breaks language barriers — type or speak in any language, get instant translations with voice playback so the other person can actually *hear* it 🌍

built with a dreamy **dark plum + periwinkle** aesthetic because why not make your tools pretty ✨

---

## ✨ features

- 💬 **chat-style interface** — feels like messaging, not a boring tool
- 🌐 **15+ languages** with flag avatars per message
- 🔄 **conversation mode** — auto-swaps languages for back-and-forth chats
- 🔊 **auto-speak** — translations play aloud instantly
- 🎙️ **voice input** — speak instead of type, with live waveform
- ⭐ **favorites & common phrases** — save phrases for quick access
- 📝 **edit messages** — fix a typo and re-translate inline
- 🔍 **search chat history** — find anything across all conversations
- 💾 **persistent history** — chats survive page refresh
- 🌙 **dark mode** — already gorgeous, even more gorgeous dark
- 📱 **fully responsive** — works on mobile, tablet, desktop
- ⚡ **retry on failure** — offline detection + one-click retry

---

## 🛠️ tech stack

| layer | tech |
|-------|------|
| frontend | React 19 + TypeScript + Vite |
| styling | Tailwind CSS v3 |
| backend | FastAPI + Python 3.11 |
| speech-to-text | Groq Whisper large-v3-turbo |
| translation | Groq Llama (openai/gpt-oss-120b) |
| voice output | Browser SpeechSynthesis API |
| deploy (fe) | Netlify |
| deploy (be) | Render |

---

## 🚀 run locally

**backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # add your GROQ_API_KEY
uvicorn main:app --reload
```

**frontend**
```bash
cd frontend
npm install
cp .env.example .env  # set VITE_API_BASE=http://localhost:8000
npm run dev
```

get a free Groq API key at [console.groq.com](https://console.groq.com) 🔑

---

## 🌸 palette

| color | hex | use |
|-------|-----|-----|
| 🟣 dark plum | `#4F0C28` | background, bubbles, buttons |
| 💜 periwinkle | `#C5D2F8` | text, accents, translation cards |

---

<div align="center">

made with 💜 by [Keerthana](https://github.com/Keerthanadev-on)

*breaking language barriers, one message at a time* 🌸

</div>
