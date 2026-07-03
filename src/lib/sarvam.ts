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
 * JSON schemas (OpenAI-compatible, strict mode).
 * Strict mode requires additionalProperties:false and every property
 * listed in `required`.
 * ------------------------------------------------------------------ */
type JsonSchema = Record<string, unknown>;

const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str: JsonSchema = { type: "string" };
const num: JsonSchema = { type: "number" };
const arr = (items: JsonSchema): JsonSchema => ({ type: "array", items });

const schemas: Record<StudyMode, JsonSchema> = {
  summary: obj({
    title: str,
    keyPoints: arr(str),
    summary: str,
  }),
  quiz: obj({
    title: str,
    questions: arr(
      obj({
        question: str,
        options: arr(str),
        answerIndex: num,
        explanation: str,
      })
    ),
  }),
  flashcards: obj({
    title: str,
    cards: arr(obj({ front: str, back: str })),
  }),
  explain: obj({
    title: str,
    eli5: str,
    detailed: str,
    analogy: str,
  }),
  mindmap: obj({
    title: str,
    branches: arr(obj({ title: str, nodes: arr(str) })),
  }),
  test: obj({
    title: str,
    questions: arr(
      obj({
        question: str,
        options: arr(str),
        answerIndex: num,
        explanation: str,
        concept: str,
      })
    ),
  }),
  planner: obj({
    title: str,
    totalDays: num,
    days: arr(obj({ day: num, focus: str, tasks: arr(str) })),
  }),
  course: obj({
    title: str,
    overview: str,
    chapters: arr(obj({ title: str, summary: str, topics: arr(str) })),
  }),
};

const prompts: Record<StudyMode, (topic: string, lang: string) => string> = {
  summary: (t, lang) =>
    `You are an expert teacher. Summarize the following topic/notes for a student. ` +
    `Give a short title, 5-8 crisp key points, and a clear summary paragraph. ` +
    `Respond in ${lang}.\n\nTOPIC/NOTES:\n${t}`,
  quiz: (t, lang) =>
    `You are an expert teacher. Create a 5-question multiple-choice quiz to test understanding of the topic/notes below. ` +
    `Each question must have exactly 4 options, the correct answerIndex (0-3), and a one-line explanation. ` +
    `Respond in ${lang}.\n\nTOPIC/NOTES:\n${t}`,
  flashcards: (t, lang) =>
    `You are an expert teacher. Create 6-10 study flashcards (front = question/term, back = concise answer) ` +
    `for the topic/notes below. Respond in ${lang}.\n\nTOPIC/NOTES:\n${t}`,
  explain: (t, lang) =>
    `You are an expert teacher. Explain the topic/notes below in three ways: ` +
    `eli5 (explain like I'm 5, very simple), detailed (thorough but clear), and a memorable analogy. ` +
    `Respond in ${lang}.\n\nTOPIC/NOTES:\n${t}`,
  mindmap: (t, lang) =>
    `You are an expert teacher. Build a mind map of the topic/notes below. ` +
    `Give a short central title and 4-6 main branches; each branch has a short title and 3-5 concise sub-point nodes (few words each). ` +
    `Respond in ${lang}.\n\nTOPIC/NOTES:\n${t}`,
  test: (t, lang) =>
    `You are an exam setter. Create a 10-question multiple-choice mock test on the topic/notes below. ` +
    `Each question: exactly 4 options, the correct answerIndex (0-3), a one-line explanation, and a short "concept" tag naming the sub-topic it tests (used to flag weak areas). ` +
    `Mix easy, medium and hard questions. Respond in ${lang}.\n\nTOPIC/NOTES:\n${t}`,
  planner: (t, lang) =>
    `You are a study coach. Create a day-by-day revision plan for the request below. ` +
    `If the user specifies a number of days or an exam date, honour it; otherwise plan for 7 days. ` +
    `For each day give the day number, a short focus theme, and 2-4 concrete tasks. Set totalDays accordingly. ` +
    `Respond in ${lang}.\n\nREQUEST:\n${t}`,
  course: (t, lang) =>
    `You are a curriculum designer. Build a structured course outline for the subject/syllabus below. ` +
    `Give a course title, a 1-2 sentence overview, and 5-8 chapters in a logical learning order. ` +
    `Each chapter has a title, a one-line summary, and 3-5 key topics it covers. ` +
    `Respond in ${lang}.\n\nSUBJECT/SYLLABUS:\n${t}`,
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
  schema?: JsonSchema;
  schemaName?: string;
  system?: string;
  maxTokens?: number;
}

async function chat(userContent: string, opts: ChatOptions = {}): Promise<string> {
  const body: Record<string, unknown> = {
    messages: [
      {
        role: "system",
        content:
          opts.system ||
          "You are a helpful, expert study assistant. When a JSON schema is provided, respond ONLY with a valid JSON object that matches it — no extra commentary.",
      },
      { role: "user", content: userContent },
    ],
    // reasoning_effort "low" keeps hidden reasoning tokens (billed as output)
    // to a minimum — important for conserving our limited credits.
    reasoning_effort: "low",
    temperature: 0.5,
    max_tokens: opts.maxTokens ?? 3000,
  };
  if (opts.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schemaName || "response", strict: true, schema: opts.schema },
    };
  }

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

  const raw = await chat(prompts[mode](source, lang), {
    schema: schemas[mode],
    schemaName: mode,
  });
  return parseJson(raw);
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
    `Respond in ${lang}.\n\nQUESTION: ${question}`;

  const raw = await chat(prompt, {
    schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false },
    schemaName: "answer",
    maxTokens: 1500,
  });
  return parseJson<{ answer: string }>(raw);
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
        questions: Array.from({ length: 10 }, (_, i) => ({
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
