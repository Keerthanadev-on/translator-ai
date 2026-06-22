import { useState, useRef, useEffect, useCallback } from "react";
import { LANGUAGES, getFlag } from "./languages";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const STORAGE_KEY = "translator_v2";

const COMMON_PHRASES = [
  "Hello, how are you?",
  "Thank you very much",
  "Where is the bathroom?",
  "How much does this cost?",
  "I don't understand",
  "Can you speak slower?",
  "Please help me",
  "I need a doctor",
  "Where is the nearest hotel?",
  "What time is it?",
];

type Message = {
  id: number;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
};

type Conversation = {
  id: number;
  title: string;
  messages: Message[];
};

type StorageData = {
  conversations: Conversation[];
  idCounter: number;
  convCounter: number;
  favorites: string[];
};

function loadStorage(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error();
    const p = JSON.parse(raw);
    if (!p.conversations?.length) throw new Error();
    return p;
  } catch {
    return {
      conversations: [{ id: 1, title: "New chat", messages: [] }],
      idCounter: 0,
      convCounter: 1,
      favorites: [],
    };
  }
}

const init = loadStorage();
let idCounter = init.idCounter;
let convCounter = init.convCounter;

function makeConv(): Conversation {
  convCounter += 1;
  return { id: convCounter, title: "New chat", messages: [] };
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(init.conversations);
  const [activeId, setActiveId] = useState(init.conversations[0].id);
  const [favorites, setFavorites] = useState<string[]>(init.favorites || []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const [sourceLanguage, setSourceLanguage] = useState("English");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [conversationMode, setConversationMode] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryBlob, setRetryBlob] = useState<Blob | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showPhrases, setShowPhrases] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [volume, setVolume] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const activeConv = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const filteredConvs = search.trim()
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.messages.some(
            (m) =>
              m.originalText.toLowerCase().includes(search.toLowerCase()) ||
              m.translatedText.toLowerCase().includes(search.toLowerCase())
          )
      )
    : conversations;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length, activeId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, idCounter, convCounter, favorites }));
  }, [conversations, favorites]);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  function swapLanguages() {
    if (sourceLanguage === "Auto") return;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  }

  function startNewChat() {
    const conv = makeConv();
    setConversations((p) => [conv, ...p]);
    setActiveId(conv.id);
    setSidebarOpen(false);
  }

  function deleteConv(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (!filtered.length) {
        const fresh = makeConv();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(filtered[0].id);
      return filtered;
    });
  }

  function handleSpeak(text: string, langName?: string) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = LANGUAGES.find((l) => l.code === (langName || targetLanguage));
    if (lang) utterance.lang = lang.bcp47;
    utterance.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      setError(`Voice failed: ${e.error}`);
    };
    window.speechSynthesis.speak(utterance);
  }

  function copyText(text: string, id: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function toggleFavorite(phrase: string) {
    setFavorites((prev) =>
      prev.includes(phrase) ? prev.filter((f) => f !== phrase) : [...prev, phrase]
    );
  }

  const processTranslation = useCallback(
    async (text: string) => {
      if (isOffline) { setError("You're offline. Check your connection and retry."); return; }
      setLoading(true);
      setError(null);
      setRetryText(text);
      setRetryBlob(null);
      try {
        const form = new FormData();
        form.append("text", text);
        form.append("target_language", targetLanguage);
        form.append("source_language", sourceLanguage === "Auto" ? "auto" : sourceLanguage);

        const res = await fetch(`${API_BASE}/api/translate`, { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Translation failed");
        }
        const { translated_text } = await res.json();

        idCounter += 1;
        const msg: Message = {
          id: idCounter,
          originalText: text,
          translatedText: translated_text,
          sourceLanguage: sourceLanguage,
          targetLanguage,
          timestamp: Date.now(),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? { ...c, title: c.messages.length === 0 ? text.slice(0, 32) : c.title, messages: [...c.messages, msg] }
              : c
          )
        );
        setRetryText(null);
        setLoading(false);
        if (autoSpeak) handleSpeak(translated_text, targetLanguage);
        if (conversationMode && sourceLanguage !== "Auto") {
          setSourceLanguage(targetLanguage);
          setTargetLanguage(sourceLanguage);
        }
      } catch (err: any) {
        setError(err.message || "Something went wrong");
        setLoading(false);
      }
    },
    [activeId, sourceLanguage, targetLanguage, autoSpeak, conversationMode, isOffline]
  );

  function handleSend() {
    const text = inputText.trim();
    if (!text || loading) return;
    setInputText("");
    setShowPhrases(false);
    processTranslation(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(100, avg * 2));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        setVolume(0);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendVoice(blob);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function sendVoice(blob: Blob) {
    if (isOffline) { setError("You're offline."); return; }
    setLoading(true);
    setError(null);
    setRetryBlob(blob);
    setRetryText(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch(`${API_BASE}/api/transcribe`, { method: "POST", body: form });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Transcription failed"); }
      const { text } = await res.json();
      if (!text?.trim()) { setError("Didn't catch that — try again."); setLoading(false); return; }
      setRetryBlob(null);
      await processTranslation(text.trim());
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }

  async function startEditMessage(msg: Message) {
    setEditingId(msg.id);
    setEditText(msg.originalText);
  }

  async function saveEdit(msg: Message) {
    const text = editText.trim();
    if (!text) { setEditingId(null); return; }
    if (isOffline) { setError("You're offline."); return; }
    setEditingId(null);
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("text", text);
      form.append("target_language", msg.targetLanguage);
      form.append("source_language", msg.sourceLanguage === "Auto" ? "auto" : msg.sourceLanguage);
      const res = await fetch(`${API_BASE}/api/translate`, { method: "POST", body: form });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Translation failed"); }
      const { translated_text } = await res.json();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, messages: c.messages.map((m) => m.id === msg.id ? { ...m, originalText: text, translatedText: translated_text, timestamp: Date.now() } : m) }
            : c
        )
      );
      setLoading(false);
      if (autoSpeak) handleSpeak(translated_text, msg.targetLanguage);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }

  const dm = darkMode;
  const bg = dm ? "bg-[#1a0510]" : "bg-[#F5F0FF]";
  const sidebar = dm ? "bg-[#2a0818]" : "bg-[#4F0C28]";
  const card = dm ? "bg-[#2a0818] border-[#C5D2F8]/10" : "bg-white border-[#4F0C28]/10";
  const headerBg = dm ? "bg-[#1a0510]/80" : "bg-white/60";
  const textMain = dm ? "text-[#C5D2F8]" : "text-[#3a0920]";
  const textSub = dm ? "text-[#C5D2F8]/50" : "text-[#4F0C28]/50";
  const inputBg = dm ? "bg-[#2a0818] border-[#C5D2F8]/20" : "bg-white border-[#4F0C28]/15";
  const phrasesBg = dm ? "bg-[#2a0818] border-[#C5D2F8]/20" : "bg-white border-[#4F0C28]/10";

  const allPhrases = [...new Set([...favorites, ...COMMON_PHRASES])];

  return (
    <div className={`h-screen w-screen flex ${bg} ${textMain} overflow-hidden transition-colors duration-200`}>
      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-72 ${sidebar} text-[#C5D2F8] flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-3 flex items-center gap-2">
          <button onClick={startNewChat} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#C5D2F8]/30 hover:bg-[#C5D2F8]/10 transition-colors text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New chat
          </button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#C5D2F8]/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 bg-[#C5D2F8]/10 rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="bg-transparent text-xs text-[#C5D2F8] placeholder-[#C5D2F8]/40 focus:outline-none flex-1"
            />
            {search && <button onClick={() => setSearch("")} className="opacity-50 hover:opacity-100 text-xs">✕</button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-1">
          {filteredConvs.length === 0 && (
            <p className="text-xs text-[#C5D2F8]/40 text-center py-4">No chats found</p>
          )}
          {filteredConvs.map((conv) => (
            <button
              key={conv.id}
              onClick={() => { setActiveId(conv.id); setSidebarOpen(false); }}
              className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${conv.id === activeId ? "bg-[#C5D2F8]/20" : "hover:bg-[#C5D2F8]/10"}`}
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">{conv.title}</span>
                <span className="text-[10px] text-[#C5D2F8]/40">{conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""}</span>
              </div>
              <span onClick={(e) => deleteConv(conv.id, e)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 shrink-0" role="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-[#C5D2F8]/15 flex items-center justify-between">
          <p className="text-xs text-[#C5D2F8]/50">Real-Time Translator</p>
          <p className="text-[10px] text-[#C5D2F8]/30">{conversations.length} chat{conversations.length !== 1 ? "s" : ""}</p>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className={`flex flex-col gap-2 px-3 sm:px-5 py-3 border-b ${dm ? "border-[#C5D2F8]/10" : "border-[#4F0C28]/10"} ${headerBg} backdrop-blur`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#4F0C28]/5 shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/></svg>
            </button>

            <div className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 ${dm ? "bg-[#C5D2F8]/10" : "bg-[#4F0C28]/5"} rounded-full px-2 sm:px-4 py-1.5 max-w-md mx-auto`}>
              <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} className={`text-xs sm:text-sm font-medium bg-transparent border-none focus:outline-none ${dm ? "text-[#C5D2F8]" : "text-[#4F0C28]"} cursor-pointer min-w-0`}>
                <option value="Auto">Auto-detect</option>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
              <button onClick={swapLanguages} disabled={sourceLanguage === "Auto"} className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${dm ? "bg-[#C5D2F8]/10 hover:bg-[#C5D2F8]/20" : "bg-[#4F0C28]/10 hover:bg-[#4F0C28]/20"} transition-colors disabled:opacity-30`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="2"><path d="M7 16V4M7 4L3 8M7 4l4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className={`text-xs sm:text-sm font-medium bg-transparent border-none focus:outline-none ${dm ? "text-[#C5D2F8]" : "text-[#4F0C28]"} cursor-pointer min-w-0`}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </div>

            <button onClick={() => setDarkMode((v) => !v)} className={`w-9 h-9 flex items-center justify-center rounded-lg ${dm ? "hover:bg-[#C5D2F8]/10" : "hover:bg-[#4F0C28]/5"} shrink-0`} aria-label="Toggle dark mode">
              {dm ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C5D2F8" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F0C28" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={() => setConversationMode((v) => !v)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${conversationMode ? "bg-[#4F0C28] text-[#F5F0FF] border-[#4F0C28]" : dm ? "text-[#C5D2F8]/60 border-[#C5D2F8]/20 hover:border-[#C5D2F8]/40" : "text-[#4F0C28]/60 border-[#4F0C28]/20 hover:border-[#4F0C28]/40"}`}>
              Conversation mode {conversationMode ? "on" : "off"}
            </button>
            <button onClick={() => setAutoSpeak((v) => !v)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${autoSpeak ? "bg-[#4F0C28] text-[#F5F0FF] border-[#4F0C28]" : dm ? "text-[#C5D2F8]/60 border-[#C5D2F8]/20 hover:border-[#C5D2F8]/40" : "text-[#4F0C28]/60 border-[#4F0C28]/20 hover:border-[#4F0C28]/40"}`}>
              Auto-speak {autoSpeak ? "on" : "off"}
            </button>
            <button onClick={() => setShowPhrases((v) => !v)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${showPhrases ? "bg-[#C5D2F8] text-[#4F0C28] border-[#C5D2F8]" : dm ? "text-[#C5D2F8]/60 border-[#C5D2F8]/20 hover:border-[#C5D2F8]/40" : "text-[#4F0C28]/60 border-[#4F0C28]/20 hover:border-[#4F0C28]/40"}`}>
              ⭐ Phrases
            </button>
          </div>
        </header>

        {isOffline && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-700 text-center">
            ⚠️ You're offline — translation unavailable until connection is restored
          </div>
        )}

        {showPhrases && (
          <div className={`border-b ${dm ? "border-[#C5D2F8]/10" : "border-[#4F0C28]/10"} ${phrasesBg} px-4 py-3`}>
            <div className="max-w-2xl mx-auto">
              <p className={`text-xs font-medium ${textSub} mb-2`}>Common phrases — click to translate</p>
              <div className="flex flex-wrap gap-2">
                {allPhrases.map((phrase) => (
                  <div key={phrase} className="flex items-center gap-1">
                    <button
                      onClick={() => { processTranslation(phrase); setShowPhrases(false); }}
                      className={`text-xs px-3 py-1.5 rounded-full ${dm ? "bg-[#C5D2F8]/10 hover:bg-[#C5D2F8]/20 text-[#C5D2F8]" : "bg-[#4F0C28]/8 hover:bg-[#4F0C28]/15 text-[#4F0C28]"} transition-colors`}
                    >
                      {phrase}
                    </button>
                    <button
                      onClick={() => toggleFavorite(phrase)}
                      className={`text-xs opacity-60 hover:opacity-100 transition-opacity ${favorites.includes(phrase) ? "text-yellow-500" : ""}`}
                      aria-label={favorites.includes(phrase) ? "Remove from favorites" : "Add to favorites"}
                    >
                      {favorites.includes(phrase) ? "★" : "☆"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-3 sm:px-5">
          <div className="max-w-2xl mx-auto py-6 flex flex-col gap-2 min-h-full">
            {(!activeConv || activeConv.messages.length === 0) && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-20">
                <div className={`w-14 h-14 rounded-full ${dm ? "bg-[#C5D2F8]/10" : "bg-[#4F0C28]/5"} flex items-center justify-center`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="1.5" opacity="0.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <p className={`text-sm ${textSub}`}>Type or speak a message to start translating</p>
                <button onClick={() => setShowPhrases(true)} className={`text-xs px-4 py-2 rounded-full border ${dm ? "border-[#C5D2F8]/30 text-[#C5D2F8]/60 hover:bg-[#C5D2F8]/10" : "border-[#4F0C28]/20 text-[#4F0C28]/50 hover:bg-[#4F0C28]/5"} transition-colors`}>
                  ⭐ Browse common phrases
                </button>
              </div>
            )}

            {activeConv?.messages.map((msg, idx) => {
              const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const isEditing = editingId === msg.id;
              return (
                <div key={msg.id} className="flex flex-col gap-1">
                  <div className="self-end flex items-end gap-2 max-w-[90%] sm:max-w-[80%]">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-medium ${textSub} px-1`}>
                        You · {msg.sourceLanguage} · {time}
                      </span>
                      {isEditing ? (
                        <div className={`${card} border rounded-2xl rounded-tr-sm px-3 py-2 flex items-center gap-2 min-w-[180px]`}>
                          <input
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(msg); if (e.key === "Escape") setEditingId(null); }}
                            className={`flex-1 bg-transparent text-sm focus:outline-none ${textMain}`}
                          />
                          <button onClick={() => saveEdit(msg)} className="text-[10px] bg-[#4F0C28] text-white rounded-full px-2 py-0.5">Save</button>
                          <button onClick={() => setEditingId(null)} className={`text-[10px] ${textSub}`}>✕</button>
                        </div>
                      ) : (
                        <div className="group relative bg-[#4F0C28] text-[#F5F0FF] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                          <p className="text-sm">{msg.originalText}</p>
                          <button
                            onClick={() => startEditMessage(msg)}
                            className="absolute -left-7 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#4F0C28]/10 hover:bg-[#4F0C28]/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Edit message"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="w-7 h-7 shrink-0 rounded-full bg-[#4F0C28] flex items-center justify-center text-sm mb-5">
                      {getFlag(msg.sourceLanguage)}
                    </div>
                  </div>

                  <div className="self-start flex items-end gap-2 max-w-[90%] sm:max-w-[80%]">
                    <div className="w-7 h-7 shrink-0 rounded-full bg-[#C5D2F8] flex items-center justify-center text-sm mb-5">
                      {getFlag(msg.targetLanguage)}
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className={`text-[10px] font-medium ${textSub} px-1`}>
                        Translation · {msg.targetLanguage}
                      </span>
                      <div className={`${card} border rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm font-medium ${textMain}`}>{msg.translatedText}</p>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            <button onClick={() => copyText(msg.translatedText, msg.id)} className={`w-6 h-6 rounded-full flex items-center justify-center ${dm ? "bg-[#C5D2F8]/10 hover:bg-[#C5D2F8]/20" : "bg-[#4F0C28]/10 hover:bg-[#4F0C28]/20"} transition-colors`} aria-label="Copy">
                              {copiedId === msg.id ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              )}
                            </button>
                            <button onClick={() => handleSpeak(msg.translatedText, msg.targetLanguage)} className={`w-6 h-6 rounded-full flex items-center justify-center ${dm ? "bg-[#C5D2F8]/10 hover:bg-[#C5D2F8]/20" : "bg-[#4F0C28]/10 hover:bg-[#4F0C28]/20"} transition-colors`} aria-label="Play">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill={dm ? "#C5D2F8" : "#4F0C28"}><path d="M8 5v14l11-7z"/></svg>
                            </button>
                            <button onClick={() => toggleFavorite(msg.originalText)} className={`w-6 h-6 rounded-full flex items-center justify-center ${dm ? "bg-[#C5D2F8]/10 hover:bg-[#C5D2F8]/20" : "bg-[#4F0C28]/10 hover:bg-[#4F0C28]/20"} transition-colors text-[10px] ${favorites.includes(msg.originalText) ? "text-yellow-500" : textSub}`} aria-label="Save to favorites">
                              {favorites.includes(msg.originalText) ? "★" : "☆"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {idx < (activeConv?.messages.length ?? 0) - 1 && (
                    <div className={`h-px ${dm ? "bg-[#C5D2F8]/5" : "bg-[#4F0C28]/5"} my-2 mx-8`} />
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="self-start flex items-center gap-2 px-4 py-2.5">
                <span className={`text-xs ${textSub}`}>Translating</span>
                <span className="flex gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${dm ? "bg-[#C5D2F8]/40" : "bg-[#4F0C28]/40"} animate-bounce [animation-delay:-0.3s]`}/>
                  <span className={`w-1.5 h-1.5 rounded-full ${dm ? "bg-[#C5D2F8]/40" : "bg-[#4F0C28]/40"} animate-bounce [animation-delay:-0.15s]`}/>
                  <span className={`w-1.5 h-1.5 rounded-full ${dm ? "bg-[#C5D2F8]/40" : "bg-[#4F0C28]/40"} animate-bounce`}/>
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        {error && (
          <div className={`mx-3 sm:mx-5 mb-2 max-w-2xl sm:mx-auto w-full ${dm ? "bg-red-900/30 border-red-800/40 text-red-300" : "bg-red-50 border-red-200 text-red-600"} border rounded-lg px-4 py-2 text-sm flex items-center justify-between gap-2`}>
            <span>{error}</span>
            <div className="flex items-center gap-2 shrink-0">
              {(retryText || retryBlob) && (
                <button
                  onClick={() => { if (retryText) processTranslation(retryText); else if (retryBlob) sendVoice(retryBlob); }}
                  className="text-xs underline font-medium"
                >
                  Retry
                </button>
              )}
              <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          </div>
        )}

        <div className="px-3 sm:px-5 pb-4 pt-2">
          <div className={`max-w-2xl mx-auto flex items-center gap-2 ${inputBg} border rounded-full px-2 py-1.5 shadow-sm`}>
            <button onClick={() => setInputMode((m) => m === "text" ? "voice" : "text")} className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${dm ? "hover:bg-[#C5D2F8]/10" : "hover:bg-[#4F0C28]/10"} transition-colors`}>
              {inputMode === "text" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dm ? "#C5D2F8" : "#4F0C28"} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M17 4h3v3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>

            {inputMode === "text" ? (
              <>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sourceLanguage === "Auto" ? "Type a message..." : `Type in ${sourceLanguage}...`}
                  disabled={loading}
                  className={`flex-1 bg-transparent border-none focus:outline-none text-sm ${textMain} placeholder-[#4F0C28]/40 px-3 py-1.5 disabled:opacity-50 min-w-0`}
                />
                <button onClick={handleSend} disabled={loading || !inputText.trim()} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-[#4F0C28] hover:opacity-90 transition-opacity disabled:opacity-30">
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#F5F0FF] border-t-transparent rounded-full animate-spin"/>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F0FF" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center gap-3 px-2">
                {recording && (
                  <div className="flex items-end gap-0.5 h-6">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const barVolume = Math.max(4, (volume / 100) * 24 * (0.4 + Math.sin(i * 0.8) * 0.6));
                      return (
                        <div
                          key={i}
                          className="w-1 bg-red-500 rounded-full transition-all duration-75"
                          style={{ height: `${recording ? barVolume : 4}px` }}
                        />
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={loading}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${recording ? "text-red-500" : textSub}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-red-500 animate-pulse" : dm ? "bg-[#C5D2F8]/30" : "bg-[#4F0C28]/30"}`}/>
                  {loading ? "Processing..." : recording ? "Recording — tap to stop" : "Tap to speak"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
