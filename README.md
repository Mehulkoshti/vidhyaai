# 📚 VidhyaAI — Your AI Study Companion

> Built for **HACKHAZARDS '26** · Theme: 🎓 Learning & Knowledge Systems · Track: 🇮🇳 **Sarvam AI**

VidhyaAI turns **any topic, your own notes, or a photo/PDF** into instant, exam-ready study material — in **your language**. Paste a topic, pick a mode, and get AI-generated **summaries, quizzes, flashcards, mind maps, mock tests, and dead-simple explanations** in seconds.

Powered end-to-end by **Sarvam AI**, India's own multilingual AI stack — which is exactly why VidhyaAI can genuinely teach in Hindi, Marathi, Tamil and Bengali, not just translate.

## ✨ Features (8 study modes)

- **📝 Summary** — crisp key points + a clean overview of any topic
- **🎯 Quiz** — 5 auto-graded MCQs with instant scoring & explanations
- **🃏 Flashcards** — flip-card revision deck (3D flip animation)
- **💡 Explain** — the same concept as *Explain-Like-I'm-5*, in-depth, and as a memorable analogy
- **🗺️ Mind Map** — the whole topic as a visual, branching concept map
- **📝 Mock Test** — timed 10-question exam, scored report card & weak-area detection
- **🏆 Certificate** — pass the test and download a branded certificate (rendered on canvas)
- **📅 Study Planner** — a day-by-day revision plan up to your exam date
- **💬 Ask a doubt** — chat with an AI tutor that remembers your whole session
- **🔊 Listen aloud** — natural Indian-language voices via Sarvam **Bulbul** TTS

## 🇮🇳 How we use Sarvam AI

| Capability | Sarvam product | Where in the app |
|---|---|---|
| All study-material generation | **Chat Completions** (`sarvam-30b` → `sarvam-105b` fallback) with strict JSON-schema structured output | every study mode + "Ask a doubt" |
| Read-aloud in native voices | **Bulbul v3** Text-to-Speech | the 🔊 Listen button |
| Photo / PDF → notes *(optional)* | **Sarvam Vision** document OCR | attach a file in any study mode |

The multilingual LLM is what makes "study in your own language" real — Sarvam is trained India-first, so Hindi/Marathi/Tamil/Bengali output actually reads naturally.

## 🛠️ Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** + **Tailwind CSS v4**
- **Sarvam AI** — OpenAI-compatible Chat Completions, Bulbul TTS, Sarvam Vision
- Deployed on **Netlify**

## 🚀 Run Locally

```bash
npm install
npm run dev            # runs in MOCK mode by default — zero API calls, zero credits
```

Open http://localhost:3000

### Turning on real Sarvam AI

1. Get a key at **https://dashboard.sarvam.ai** → Settings → API Keys
2. In `.env.local`:
   ```
   SARVAM_API_KEY=your_actual_key_here
   SARVAM_MOCK=0
   SARVAM_MODELS=sarvam-30b,sarvam-105b
   ```

> **Credit note:** Text generation is per-token and very cheap (~1–2 paise per call). TTS/Vision are billed per character/page, so they run only on explicit user actions and are cached. Keep `SARVAM_MOCK=1` while developing to spend **nothing**.

## 🌍 The Problem

Students drown in long notes and PDFs with no time to revise. Making quizzes and flashcards by hand is slow — and almost every tool assumes you study in English. VidhyaAI compresses hours of revision prep into seconds and meets students **in their own language**, powered by an Indian LLM built for exactly that.

## 🔮 Future Scope

- Spaced-repetition flashcard scheduling
- Save & share study decks
- Voice-in doubts (Sarvam Saaras speech-to-text)
- Deeper Sarvam Vision integration for handwriting

---

Made with ❤️ for HACKHAZARDS '26 · Powered by 🇮🇳 Sarvam AI
