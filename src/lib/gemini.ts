import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

// Fallback chain: lite models first (higher free-tier quota, less "high demand"
// 503s), heavier models as backup. If one model is busy/rate-limited we move to
// the next so the demo never dies on a transient spike.
const modelChain = (
  process.env.GEMINI_MODELS ||
  "gemini-2.5-flash-lite,gemini-2.0-flash-lite,gemini-2.5-flash,gemini-flash-lite-latest"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

if (!apiKey) {
  // We don't throw at import time so the build doesn't fail; the API route checks this.
  console.warn("[VidyaAI] GEMINI_API_KEY is not set in .env.local");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export type StudyMode =
  | "summary"
  | "quiz"
  | "flashcards"
  | "explain"
  | "mindmap"
  | "test"
  | "planner";

// JSON schema per mode so Gemini returns clean, parseable structured output.
const schemas = {
  summary: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      keyPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      summary: { type: SchemaType.STRING },
    },
    required: ["title", "keyPoints", "summary"],
  },
  quiz: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      questions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING },
            options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            answerIndex: { type: SchemaType.NUMBER },
            explanation: { type: SchemaType.STRING },
          },
          required: ["question", "options", "answerIndex", "explanation"],
        },
      },
    },
    required: ["title", "questions"],
  },
  flashcards: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      cards: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            front: { type: SchemaType.STRING },
            back: { type: SchemaType.STRING },
          },
          required: ["front", "back"],
        },
      },
    },
    required: ["title", "cards"],
  },
  explain: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      eli5: { type: SchemaType.STRING },
      detailed: { type: SchemaType.STRING },
      analogy: { type: SchemaType.STRING },
    },
    required: ["title", "eli5", "detailed", "analogy"],
  },
  mindmap: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      branches: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            nodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ["title", "nodes"],
        },
      },
    },
    required: ["title", "branches"],
  },
  test: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      questions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING },
            options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            answerIndex: { type: SchemaType.NUMBER },
            explanation: { type: SchemaType.STRING },
            concept: { type: SchemaType.STRING },
          },
          required: ["question", "options", "answerIndex", "explanation", "concept"],
        },
      },
    },
    required: ["title", "questions"],
  },
  planner: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      totalDays: { type: SchemaType.NUMBER },
      days: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            day: { type: SchemaType.NUMBER },
            focus: { type: SchemaType.STRING },
            tasks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ["day", "focus", "tasks"],
        },
      },
    },
    required: ["title", "totalDays", "days"],
  },
} satisfies Record<StudyMode, Schema>;

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
};

// Schema for the conversational "ask a follow-up doubt" feature.
const askSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: { answer: { type: SchemaType.STRING } },
  required: ["answer"],
};

// An uploaded image/PDF, base64-encoded, that Gemini reads natively (OCR-free).
export interface InlineFile {
  data: string; // base64 (no data: prefix)
  mimeType: string; // e.g. image/png, image/jpeg, application/pdf
}

type Part = string | { inlineData: { data: string; mimeType: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini 2.5 Flash occasionally returns 503 (high demand). Retry transient
// errors with exponential backoff so a single demand spike doesn't break the UX.
function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(503|429|overloaded|high demand|UNAVAILABLE|Too Many Requests)\b/i.test(msg);
}

// Generic call with model fallback + per-model retry. Accepts content parts
// (text and/or an inline image/PDF) and a response schema.
async function runWithFallback(schema: Schema, parts: Part[]) {
  let lastErr: unknown;

  for (const modelName of modelChain) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.6,
      },
    });

    const maxAttempts = 3;
    let modelFailed = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await model.generateContent(parts);
        return JSON.parse(result.response.text());
      } catch (err) {
        lastErr = err;
        if (!isTransient(err)) throw err; // hard error → don't waste other models
        if (attempt === maxAttempts) {
          modelFailed = true;
          break;
        }
        await sleep(600 * attempt); // 0.6s, 1.2s
      }
    }
    if (modelFailed) {
      console.warn(`[VidyaAI] ${modelName} unavailable, trying next model…`);
    }
  }
  throw lastErr;
}

function buildParts(prompt: string, file?: InlineFile): Part[] {
  const parts: Part[] = [prompt];
  if (file) parts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
  return parts;
}

export async function generate(
  mode: StudyMode,
  topic: string,
  lang = "English",
  file?: InlineFile
) {
  // When a file is attached, tell the model to work from the attached document.
  const source = file
    ? (topic.trim()
        ? `${topic}\n\n(Also use the attached document/image as the primary source.)`
        : "Use the attached document/image as the source material.")
    : topic;
  const prompt = prompts[mode](source, lang);
  return runWithFallback(schemas[mode], buildParts(prompt, file));
}

export async function ask(context: string, question: string, lang = "English") {
  const prompt =
    `You are a friendly, patient tutor. A student is studying this topic:\n"${context}"\n\n` +
    `They asked the following doubt. Answer clearly and concisely (use simple language, ` +
    `examples if helpful). If the question is unrelated to studying, gently steer back.\n\n` +
    `Respond in ${lang}.\n\nQUESTION: ${question}`;
  return runWithFallback(askSchema, [prompt]);
}
