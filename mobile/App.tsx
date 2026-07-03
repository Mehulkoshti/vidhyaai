import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * VidhyaAI mobile (Expo). A thin, native client for the same VidhyaAI backend
 * that powers the web app — so every AI call runs on Sarvam AI server-side and
 * no API key ever lives in the app. Point API_BASE at your deployed web app.
 */
const API_BASE = "https://vidhya-ai-01.netlify.app";

const C = {
  bg: "#07080d",
  card: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.10)",
  fg: "#eef0f6",
  muted: "#9aa3b8",
  primary: "#7c8cff",
  primary2: "#a78bfa",
  accent: "#38e0b0",
  rose: "#fb7185",
};

const MODES = [
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "explain", label: "Explain", icon: "💡" },
  { key: "quiz", label: "Quiz", icon: "🎯" },
  { key: "flashcards", label: "Flashcards", icon: "🃏" },
  { key: "mindmap", label: "Mind Map", icon: "🗺️" },
  { key: "planner", label: "Planner", icon: "📅" },
];

const LANGS = [
  "English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali",
  "Telugu", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Odia",
];

export default function App() {
  const [mode, setMode] = useState("summary");
  const [lang, setLang] = useState("English");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ mode: string; data: any } | null>(null);

  async function generate() {
    if (!topic.trim()) {
      setError("Enter a topic to study.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topic: topic.trim(), lang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setResult({ mode, data: json.data });
    } catch (e: any) {
      setError(e?.message || "Could not reach VidhyaAI. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>
            Vidhya<Text style={{ color: C.accent }}>AI</Text>
          </Text>
          <Text style={styles.brandSub}>AI Study Companion · Sarvam AI 🇮🇳</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Mode chips */}
          <Text style={styles.label}>Mode</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {MODES.map((m) => (
              <Chip key={m.key} active={mode === m.key} label={`${m.icon} ${m.label}`} onPress={() => setMode(m.key)} />
            ))}
          </ScrollView>

          {/* Language chips */}
          <Text style={styles.label}>Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {LANGS.map((l) => (
              <Chip key={l} active={lang === l} label={l} onPress={() => setLang(l)} small />
            ))}
          </ScrollView>

          {/* Topic input */}
          <Text style={styles.label}>Topic / notes</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Photosynthesis, Newton's laws…"
            placeholderTextColor={C.muted}
            value={topic}
            onChangeText={setTopic}
            multiline
          />

          {error ? <Text style={styles.error}>⚠️ {error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={generate} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>✨ Generate</Text>
            )}
          </TouchableOpacity>

          {result && (
            <View style={{ marginTop: 22 }}>
              <Result mode={result.mode} data={result.data} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, active && styles.chipActive, small && { paddingVertical: 6 }]}
    >
      <Text style={[styles.chipText, active && { color: C.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Result renderers ---------- */
function Result({ mode, data }: { mode: string; data: any }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{data.title}</Text>
      {mode === "summary" && <Summary data={data} />}
      {mode === "explain" && <Explain data={data} />}
      {mode === "quiz" && <Quiz data={data} />}
      {mode === "flashcards" && <Flashcards data={data} />}
      {mode === "mindmap" && <MindMap data={data} />}
      {mode === "planner" && <Planner data={data} />}
    </View>
  );
}

function Summary({ data }: { data: any }) {
  return (
    <View>
      {data.keyPoints?.map((p: string, i: number) => (
        <View key={i} style={styles.row}>
          <Text style={styles.bullet}>{i + 1}</Text>
          <Text style={styles.body}>{p}</Text>
        </View>
      ))}
      <Text style={styles.overviewLabel}>OVERVIEW</Text>
      <Text style={styles.muted}>{data.summary}</Text>
    </View>
  );
}

function Explain({ data }: { data: any }) {
  const blocks = [
    { label: "🧒 Explain like I'm 5", text: data.eli5 },
    { label: "📚 In depth", text: data.detailed },
    { label: "🔗 Analogy", text: data.analogy },
  ];
  return (
    <View>
      {blocks.map((b) => (
        <View key={b.label} style={styles.block}>
          <Text style={styles.blockLabel}>{b.label}</Text>
          <Text style={styles.body}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Quiz({ data }: { data: any }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <View>
      {data.questions?.map((q: any, qi: number) => {
        const chosen = picked[qi];
        const answered = chosen !== undefined;
        return (
          <View key={qi} style={styles.block}>
            <Text style={styles.qText}>{qi + 1}. {q.question}</Text>
            {q.options.map((opt: string, oi: number) => {
              const correct = oi === q.answerIndex;
              const isChosen = oi === chosen;
              let bg = C.card, bd = C.border, col = C.fg;
              if (answered) {
                if (correct) { bg = "rgba(56,224,176,0.12)"; bd = C.accent; col = C.accent; }
                else if (isChosen) { bg = "rgba(251,113,133,0.12)"; bd = C.rose; col = C.rose; }
                else { col = C.muted; }
              }
              return (
                <TouchableOpacity
                  key={oi}
                  disabled={answered}
                  onPress={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                  style={[styles.opt, { backgroundColor: bg, borderColor: bd }]}
                >
                  <Text style={{ color: col }}>{String.fromCharCode(65 + oi)}. {opt}</Text>
                </TouchableOpacity>
              );
            })}
            {answered && <Text style={styles.why}>Why: {q.explanation}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function Flashcards({ data }: { data: any }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <View>
      {data.cards?.map((c: any, i: number) => {
        const f = flipped[i];
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.85}
            onPress={() => setFlipped((p) => ({ ...p, [i]: !p[i] }))}
            style={[styles.flash, f && { backgroundColor: "rgba(124,140,255,0.12)", borderColor: C.primary }]}
          >
            <Text style={styles.flashSide}>{f ? "ANSWER" : "TAP TO FLIP"}</Text>
            <Text style={styles.body}>{f ? c.back : c.front}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MindMap({ data }: { data: any }) {
  return (
    <View>
      {data.branches?.map((b: any, i: number) => (
        <View key={i} style={styles.block}>
          <Text style={styles.blockLabel}>● {b.title}</Text>
          {b.nodes?.map((n: string, ni: number) => (
            <Text key={ni} style={[styles.body, { marginLeft: 10 }]}>– {n}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Planner({ data }: { data: any }) {
  return (
    <View>
      {data.days?.map((d: any) => (
        <View key={d.day} style={styles.block}>
          <Text style={styles.blockLabel}>Day {d.day} — {d.focus}</Text>
          {d.tasks?.map((t: string, ti: number) => (
            <Text key={ti} style={[styles.body, { marginLeft: 10 }]}>✓ {t}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  brand: { fontSize: 24, fontWeight: "700", color: C.primary },
  brandSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  label: { color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: { borderColor: C.primary, backgroundColor: "rgba(124,140,255,0.15)" },
  chipText: { color: C.muted, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 14,
    padding: 14,
    color: C.fg,
    minHeight: 54,
    fontSize: 15,
  },
  error: { color: C.rose, marginTop: 10, fontSize: 13 },
  btn: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
  },
  title: { color: C.fg, fontSize: 20, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  bullet: {
    color: C.accent,
    backgroundColor: "rgba(56,224,176,0.15)",
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 12,
    overflow: "hidden",
  },
  body: { color: "rgba(238,240,246,0.9)", fontSize: 15, flex: 1, lineHeight: 22 },
  overviewLabel: { color: C.primary2, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 21 },
  block: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  blockLabel: { color: C.fg, fontWeight: "600", marginBottom: 6 },
  qText: { color: C.fg, fontWeight: "600", marginBottom: 8 },
  opt: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 7 },
  why: { color: C.muted, fontSize: 13, marginTop: 4 },
  flash: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    minHeight: 90,
    justifyContent: "center",
  },
  flashSide: { color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 6 },
});
