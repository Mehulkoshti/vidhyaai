# 📚 VidhyaAI — Your AI Study Companion

> Built for **HACKHAZARDS '26** · Theme: 🎓 Learning & Knowledge Systems

VidhyaAI turns **any topic or your own notes** into instant, exam-ready study material — in **your language**. Paste a topic, pick a mode, and get AI-generated **summaries, quizzes, flashcards, and dead-simple explanations** in seconds.

## ✨ Features

- **📝 Summary** — crisp key points + a clean overview of any topic
- **🎯 Quiz** — 5 auto-graded MCQs with instant scoring & explanations
- **🃏 Flashcards** — flip-card revision deck (3D flip animation)
- **💡 Explain** — the same concept as *Explain-Like-I'm-5*, in-depth, and as a memorable analogy
- **🌐 Multilingual** — English, Hindi, Hinglish, Marathi, Tamil, Bengali
- **⚡ Structured AI** — uses Gemini's JSON schema mode for reliable, parseable output

## 🛠️ Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** + **Tailwind CSS v4**
- **Google Gemini** (`@google/generative-ai`) with structured JSON output
- Deployed on **Vercel**

## 🚀 Run Locally

```bash
npm install
# add your free Gemini key (see below) to .env.local
npm run dev
```

Open http://localhost:3000

### Get a free Gemini API key
1. Go to **https://aistudio.google.com/apikey**
2. Sign in with Google → **Create API key** (free tier)
3. Put it in `.env.local`:
   ```
   GEMINI_API_KEY=your_actual_key_here
   GEMINI_MODEL=gemini-2.0-flash
   ```

## 🌍 The Problem

Students drown in long notes and PDFs with no time to revise. Making quizzes and flashcards by hand is slow. VidhyaAI compresses hours of revision prep into seconds — and meets students in **their own language**, which most tools ignore.

## 🔮 Future Scope

- PDF / image (OCR) upload
- Spaced-repetition flashcard scheduling
- Save & share study decks
- Voice mode for revision on the go

---

Made with ❤️ for HACKHAZARDS '26
