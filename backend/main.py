import os
import io
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Real-Time Translator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

TRANSLATE_MODEL = "llama-3.1-8b-instant"
STT_MODEL = "whisper-large-v3-turbo"
TTS_MODEL = "canopylabs/orpheus-v1-english"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Speech-to-text with language auto-detection."""
    try:
        audio_bytes = await audio.read()
        result = client.audio.transcriptions.create(
            file=(audio.filename, audio_bytes),
            model=STT_MODEL,
            response_format="verbose_json",
        )
        return {
            "text": result.text,
            "detected_language": getattr(result, "language", "unknown"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/detect-language")
async def detect_language(text: str = Form(...)):
    """Detect the language of input text."""
    try:
        prompt = (
            f"Identify the language of this text. Respond with ONLY the language name "
            f"in English (e.g. 'Spanish', 'Japanese'), nothing else.\n\nText: {text}"
        )
        completion = client.chat.completions.create(
            model=TRANSLATE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        detected = completion.choices[0].message.content.strip()
        return {"detected_language": detected}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/translate")
async def translate(text: str = Form(...), target_language: str = Form(...), source_language: str = Form("auto")):
    """Translate text to target language using LLM."""
    try:
        prompt = (
            f"Translate the following text into {target_language}. "
            f"Source language: {source_language}. "
            f"Return ONLY the translated text, no explanations, no quotes, no preamble.\n\n"
            f"Text: {text}"
        )
        completion = client.chat.completions.create(
            model=TRANSLATE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        translated = completion.choices[0].message.content.strip()
        return {"translated_text": translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/speak")
async def speak(text: str = Form(...), voice: str = Form("troy")):
    """Text-to-speech for the translated text."""
    try:
        response = client.audio.speech.create(
            model=TTS_MODEL,
            voice=voice,
            input=text,
            response_format="wav",
        )
        audio_bytes = response.read()
        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
        return {"audio_base64": b64_audio, "format": "wav"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pipeline")
async def pipeline(
    audio: UploadFile = File(...),
    target_language: str = Form(...),
):
    """Full pipeline: audio -> transcript -> translation -> speech."""
    try:
        audio_bytes = await audio.read()
        stt_result = client.audio.transcriptions.create(
            file=(audio.filename, audio_bytes),
            model=STT_MODEL,
            response_format="verbose_json",
        )
        original_text = stt_result.text
        detected_lang = getattr(stt_result, "language", "unknown")

        prompt = (
            f"Translate the following text into {target_language}. "
            f"Return ONLY the translated text, no explanations, no quotes.\n\n"
            f"Text: {original_text}"
        )
        completion = client.chat.completions.create(
            model=TRANSLATE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        translated_text = completion.choices[0].message.content.strip()

        tts_response = client.audio.speech.create(
            model=TTS_MODEL,
            voice="troy",
            input=translated_text,
            response_format="wav",
        )
        audio_out = tts_response.read()
        b64_audio = base64.b64encode(audio_out).decode("utf-8")

        return {
            "original_text": original_text,
            "detected_language": detected_lang,
            "translated_text": translated_text,
            "audio_base64": b64_audio,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
