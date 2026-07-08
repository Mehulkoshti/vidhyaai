/**
 * Sarvam AI client for VidhyaAI.
 *
 * Uses Sarvam's OpenAI-compatible Chat Completions API for all study-material
 * generation, with strict JSON-schema structured output so every mode returns
 * clean, parseable data. Sarvam is India's own multilingual LLM stack, which is
 * exactly what powers VidhyaAI's "study in your own language" promise.
 *
 * CREDIT SAFETY: set SARVAM_MOCK=1 (or leave SARVAM_API_KEY unset) to run the
 * whole app on canned sample data — zero API calls, zero credits. Use this for
 * all UI/logic development and only flip to real Sarvam for final verification
 * and the demo recording.
 */

import { geminiChat, GEMINI_AVAILABLE } from "./gemini";

const apiKey = process.env.SARVAM_API_KEY;

// Zero-credit development mode. On when explicitly asked, or whenever no key is
// configured (so the app never dies and never silently burns credits).
export const MOCK = process.env.SARVAM_MOCK === "1" || !apiKey;

// Model fallback chain: cheaper/faster 30B first (kind to our limited credits),
// flagship 105B only as backup if 30B is busy or errors.
const modelChain = (process.env.SARVAM_MODELS || "sarvam-30b,sarvam-105b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";

if (!apiKey) {
  console.warn(
    "[VidhyaAI] SARVAM_API_KEY not set — running in MOCK mode (no real AI, no credits used)."
  );
}

export type StudyMode =
  | "summary"
  | "quiz"
  | "flashcards"
  | "explain"
  | "mindmap"
  | "test"
  | "planner"
  | "course";

/** An uploaded image/PDF, base64-encoded (no data: prefix). */
export interface InlineFile {
  data: string;
  mimeType: string;
}

/* ------------------------------------------------------------------ *
 * Prompts. Each asks IN PLAIN TEXT for a specific JSON shape — we do NOT
 * send response_format json_schema (see chat() for why: strict schema makes
 * the reasoning model over-think past the 4096-token cap and return EMPTY
 * content, which times out on Netlify). parseJson() tolerantly extracts the
 * object from the reply, so the UI still gets the exact same shapes.
 * ------------------------------------------------------------------ */
const prompts: Record<StudyMode, (topic: string, lang: string) => string> = {
  summary: (t, lang) =>
    `Summarize the following topic/notes for a student, with a short title, 5-8 crisp key points, and a clear summary paragraph. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "keyPoints": string[], "summary": string}.\n\nTOPIC/NOTES:\n${t}`,
  quiz: (t, lang) =>
    `Create a 5-question multiple-choice quiz to test understanding of the topic/notes below. ` +
    `Each question has exactly 4 options, the correct answerIndex (0-3), and a one-line explanation. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "questions": [{"question": string, "options": string[4], "answerIndex": number, "explanation": string}]}.\n\nTOPIC/NOTES:\n${t}`,
  flashcards: (t, lang) =>
    `Create 6-10 study flashcards (front = question/term, back = concise answer) for the topic/notes below. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "cards": [{"front": string, "back": string}]}.\n\nTOPIC/NOTES:\n${t}`,
  explain: (t, lang) =>
    `Explain the topic/notes below in three ways. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "eli5": string (explain like I'm 5, very simple), "detailed": string (thorough but clear), "analogy": string (a memorable analogy)}.\n\nTOPIC/NOTES:\n${t}`,
  mindmap: (t, lang) =>
    `Build a mind map of the topic/notes below: a short central title and 4-6 main branches, each with a short title and 3-5 concise sub-point nodes (few words each). Respond in ${lang}. ` +
    `Return JSON: {"title": string, "branches": [{"title": string, "nodes": string[]}]}.\n\nTOPIC/NOTES:\n${t}`,
  // NOTE: capped at 5 questions — on the starter tier (4096-token output cap) the
  // reasoning model reliably fits 5 items but blows the cap at 6+, returning empty.
  test: (t, lang) =>
    `Create a 5-question multiple-choice mock test on the topic/notes below. ` +
    `Each question: exactly 4 options, the correct answerIndex (0-3), a one-line explanation, and a short "concept" tag naming the sub-topic it tests (used to flag weak areas). Mix easy, medium and hard. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "questions": [{"question": string, "options": string[4], "answerIndex": number, "explanation": string, "concept": string}]}.\n\nTOPIC/NOTES:\n${t}`,
  // Reasoning-heavy — served by the Gemini fallback (see generate()/runJson),
  // which handles the larger output easily, so we keep the full richer size.
  planner: (t, lang) =>
    `Create a day-by-day revision plan for the request below. If the user specifies a number of days or an exam date, honour it; otherwise plan for 7 days. For each day give the day number, a short focus theme, and 2-4 concrete tasks; set totalDays accordingly. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "totalDays": number, "days": [{"day": number, "focus": string, "tasks": string[]}]}.\n\nREQUEST:\n${t}`,
  course: (t, lang) =>
    `Build a structured course outline for the subject/syllabus below: a course title, a 1-2 sentence overview, and 5-8 chapters in a logical learning order. Each chapter has a title, a one-line summary, and 3-5 key topics. Respond in ${lang}. ` +
    `Return JSON: {"title": string, "overview": string, "chapters": [{"title": string, "summary": string, "topics": string[]}]}.\n\nSUBJECT/SYLLABUS:\n${t}`,
};

/* ------------------------------------------------------------------ *
 * Low-level Sarvam chat call with model fallback + transient retry.
 * ------------------------------------------------------------------ */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(status: number, msg: string): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /\b(overloaded|high demand|unavailable|too many requests|timeout)\b/i.test(msg)
  );
}

interface ChatOptions {
  system?: string;
  maxTokens?: number;
  signal?: AbortSignal; // lets the caller time-box Sarvam so the Gemini fallback still fits Netlify's ~30s window
}

async function chat(userContent: string, opts: ChatOptions = {}): Promise<string> {
  const body: Record<string, unknown> = {
    messages: [
      {
        role: "system",
        content:
          opts.system ||
          // IMPORTANT: we deliberately do NOT use response_format json_schema.
          // sarvam-30b is a reasoning model on the starter tier (max_tokens
          // capped at 4096); strict schema makes it reason until it blows that
          // cap and returns EMPTY content → the app then times out on Netlify.
          // A terse "just output the JSON" instruction + parseJson() completes
          // ~2-3x faster, spends fewer credits, and actually returns data.
          "You are an expert study assistant. Respond with ONLY one valid JSON object matching the requested shape — no markdown, no code fences, no commentary. Begin immediately with the opening brace { and do not think step by step.",
      },
      { role: "user", content: userContent },
    ],
    // reasoning_effort "low" keeps hidden reasoning tokens (billed as output)
    // to a minimum — important for conserving our limited credits.
    reasoning_effort: "low",
    temperature: 0.3,
    max_tokens: opts.maxTokens ?? 4096, // starter-tier hard ceiling
  };

  let lastErr = "Sarvam request failed";

  for (const model of modelChain) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ ...body, model }),
          signal: opts.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          lastErr = `Sarvam ${res.status}: ${text.slice(0, 200)}`;
          if (isTransient(res.status, text) && attempt < maxAttempts) {
            await sleep(600 * attempt);
            continue;
          }
          // Non-transient (e.g. 401 bad key, 400 bad body) → try next model once,
          // then give up. Transient after max attempts → fall through to next model.
          break;
        }

        const json = await res.json();
        const content: string | undefined = json?.choices?.[0]?.message?.content;
        if (!content) {
          lastErr = "Sarvam returned an empty response";
          break;
        }
        return content;
      } catch (err) {
        // Caller-triggered timeout (AbortController) — stop immediately so the
        // Gemini fallback gets its share of the request budget.
        if (opts.signal?.aborted) throw new Error("Sarvam timed out");
        lastErr = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts) {
          await sleep(600 * attempt);
          continue;
        }
      }
    }
    console.warn(`[VidhyaAI] ${model} failed (${lastErr}); trying next model…`);
  }

  throw new Error(lastErr);
}

/** Extract a JSON object from the model's reply, tolerant of stray text/fencing. */
function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Strip ```json fences or surrounding prose and grab the outermost braces.
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse AI response as JSON");
  }
}

/* ------------------------------------------------------------------ *
 * Public API — same shape the app already expects.
 * ------------------------------------------------------------------ */
export async function generate(
  mode: StudyMode,
  topic: string,
  lang = "English",
  file?: InlineFile
) {
  if (MOCK) {
    await sleep(500); // simulate latency so the UI feels real in dev
    return mockStudy(mode, topic || "Sample Topic", lang);
  }

  // If a document/image was attached, OCR it with Sarvam Vision first, then
  // feed the extracted text into the normal study-material prompt.
  let source = topic;
  if (file) {
    const extracted = await extractDocumentText(file, lang);
    source = topic.trim()
      ? `${topic}\n\nSTUDENT'S UPLOADED NOTES:\n${extracted}`
      : extracted;
  }

  // planner & course are reasoning-heavy and don't fit Sarvam's 4096-token cap,
  // so they go straight to the Gemini fallback; everything else is Sarvam-first.
  const heavy = mode === "planner" || mode === "course";
  return runJson(prompts[mode](source, lang), !heavy);
}

/**
 * Fetch JSON study data: Sarvam-first (time-boxed to ~18s so the fallback still
 * fits Netlify's ~30s window), then Gemini if Sarvam fails, returns unparseable
 * JSON, or is unavailable. Pass sarvamFirst=false to skip straight to Gemini.
 */
async function runJson<T = unknown>(promptStr: string, sarvamFirst: boolean): Promise<T> {
  if (sarvamFirst) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    try {
      const raw = await chat(promptStr, { signal: ctrl.signal });
      return parseJson<T>(raw);
    } catch (err) {
      if (!GEMINI_AVAILABLE) throw err;
      console.warn(
        "[VidhyaAI] Sarvam failed, using Gemini fallback:",
        err instanceof Error ? err.message : err
      );
    } finally {
      clearTimeout(timer);
    }
  }
  if (!GEMINI_AVAILABLE) throw new Error("Sarvam unavailable and no Gemini fallback configured");
  return parseJson<T>(await geminiChat(promptStr));
}

export async function ask(context: string, question: string, lang = "English") {
  if (MOCK) {
    await sleep(400);
    return {
      answer: `(Mock answer in ${lang}) Great question about "${question}". In the real app, Sarvam AI tutors you here with a clear, simple explanation.`,
    };
  }

  const prompt =
    `You are a friendly, patient tutor. A student is studying this topic:\n"${context}"\n\n` +
    `They asked the following doubt. Answer clearly and concisely (use simple language, ` +
    `examples if helpful). If the question is unrelated to studying, gently steer back.\n\n` +
    `Respond in ${lang}.\n\nQUESTION: ${question}\n\n` +
    `Return JSON: {"answer": string}.`;

  return runJson<{ answer: string }>(prompt, true);
}

/* ------------------------------------------------------------------ *
 * Sarvam Vision (document OCR). In MOCK mode returns sample text so the
 * photo/PDF flow works end-to-end in dev; in real mode runs the async job.
 * ------------------------------------------------------------------ */
export async function extractDocumentText(file: InlineFile, lang = "English"): Promise<string> {
  if (MOCK) {
    await sleep(500);
    return "Photosynthesis is the process by which green plants use sunlight, water and carbon dioxide to make glucose and release oxygen. It occurs in the chloroplasts using the pigment chlorophyll.";
  }
  const { ocrDocument } = await import("./vision");
  return ocrDocument(file, lang);
}

/* ------------------------------------------------------------------ *
 * Mock data (zero-credit dev). Realistic enough to build/style the UI.
 * ------------------------------------------------------------------ */
function mockStudy(mode: StudyMode, topic: string, lang: string): unknown {
  const tag = lang === "English" ? "" : ` [${lang}]`;
  switch (mode) {
    case "summary":
      return {
        title: `${topic}: Key Ideas${tag}`,
        keyPoints: [
          "First core idea about the topic, stated crisply.",
          "Second important point a student must remember.",
          "A common misconception, corrected.",
          "A real-world example that makes it click.",
          "The single most exam-relevant fact.",
        ],
        summary: `This is a mock overview of ${topic}. Flip on real Sarvam AI to get an actual, exam-ready summary in ${lang}.`,
      };
    case "quiz":
      return {
        title: `${topic} — Quick Quiz${tag}`,
        questions: Array.from({ length: 5 }, (_, i) => ({
          question: `Sample question ${i + 1} about ${topic}?`,
          options: ["Option A", "Option B (correct)", "Option C", "Option D"],
          answerIndex: 1,
          explanation: "Mock explanation of why option B is correct.",
        })),
      };
    case "flashcards":
      return {
        title: `${topic} — Flashcards${tag}`,
        cards: Array.from({ length: 6 }, (_, i) => ({
          front: `Term / question ${i + 1}`,
          back: `Concise answer ${i + 1} about ${topic}.`,
        })),
      };
    case "explain":
      return {
        title: `Understanding ${topic}${tag}`,
        eli5: `Imagine ${topic} explained so simply a 5-year-old gets it. (mock)`,
        detailed: `A thorough but clear explanation of ${topic} would appear here from Sarvam AI. (mock)`,
        analogy: `${topic} is like a familiar everyday thing — a memorable analogy. (mock)`,
      };
    case "mindmap":
      return {
        title: topic,
        branches: Array.from({ length: 4 }, (_, i) => ({
          title: `Branch ${i + 1}`,
          nodes: ["Sub-point one", "Sub-point two", "Sub-point three"],
        })),
      };
    case "test":
      return {
        title: `${topic} — Mock Test${tag}`,
        questions: Array.from({ length: 5 }, (_, i) => ({
          question: `Exam question ${i + 1} on ${topic}?`,
          options: ["A", "B (correct)", "C", "D"],
          answerIndex: 1,
          explanation: "Mock explanation.",
          concept: `Sub-topic ${((i % 3) + 1)}`,
        })),
      };
    case "planner":
      return {
        title: `${topic} — 7-Day Revision Plan${tag}`,
        totalDays: 7,
        days: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          focus: `Day ${i + 1} focus theme`,
          tasks: ["First concrete task", "Second concrete task"],
        })),
      };
    case "course":
      return {
        title: `${topic} — Full Course${tag}`,
        overview: `A mock structured course on ${topic}. Turn on real Sarvam AI to get a proper chapter-by-chapter syllabus in ${lang}.`,
        chapters: Array.from({ length: 6 }, (_, i) => ({
          title: `Chapter ${i + 1}: Key area ${i + 1}`,
          summary: `What Chapter ${i + 1} of ${topic} covers, in one line.`,
          topics: ["Topic A", "Topic B", "Topic C"],
        })),
      };
  }
}
