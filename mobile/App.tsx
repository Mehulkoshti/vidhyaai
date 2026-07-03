import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  getProgress,
  loadLibrary,
  recordStudyDay,
  recordTest,
  removeItem,
  saveItem,
  type Progress,
  type SavedItem,
} from "./storage";

/**
 * VidhyaAI mobile (Expo) — native client for the same VidhyaAI backend that
 * powers the web app. Every AI call runs on Sarvam AI server-side, so no key
 * ships in the app. Point API_BASE at your deployed web app.
 */
const API_BASE = "https://vidhya-ai-01.netlify.app";

const C = {
  bg: "#07080d",
  nav: "#0b0d16",
  card: "rgba(255,255,255,0.035)",
  border: "rgba(255,255,255,0.10)",
  fg: "#eef0f6",
  muted: "#9aa3b8",
  primary: "#7c8cff",
  primary2: "#a78bfa",
  accent: "#38e0b0",
  rose: "#fb7185",
  amber: "#fbbf24",
};

const MODES = [
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "explain", label: "Explain", icon: "💡" },
  { key: "quiz", label: "Quiz", icon: "🎯" },
  { key: "flashcards", label: "Flashcards", icon: "🃏" },
  { key: "test", label: "Mock Test", icon: "🧪" },
  { key: "mindmap", label: "Mind Map", icon: "🗺️" },
  { key: "planner", label: "Planner", icon: "📅" },
  { key: "course", label: "Course", icon: "📖" },
  { key: "ask", label: "Ask", icon: "💬" },
];

const LANGS = [
  "English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali",
  "Telugu", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Odia",
];

const TABS = [
  { key: "study", label: "Study", icon: "✨" },
  { key: "saved", label: "Saved", icon: "📚" },
  { key: "progress", label: "Progress", icon: "📊" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/* ---------- Sarvam TTS playback ---------- */
let currentPlayer: ReturnType<typeof createAudioPlayer> | null = null;
async function playTTS(text: string, lang: string, setBusy: (b: boolean) => void) {
  try {
    setBusy(true);
    if (currentPlayer) {
      try { currentPlayer.remove(); } catch {}
      currentPlayer = null;
    }
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2500), lang }),
    });
    const json = await res.json();
    if (!res.ok || json.mock || !json.audio) {
      Alert.alert("Listen", "Voice needs the live Sarvam key — it works once deployed with the key.");
      return;
    }
    const uri = FileSystem.cacheDirectory + `tts-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, json.audio, { encoding: FileSystem.EncodingType.Base64 });
    const player = createAudioPlayer({ uri });
    currentPlayer = player;
    player.play();
  } catch {
    Alert.alert("Listen", "Couldn't play audio on this device.");
  } finally {
    setBusy(false);
  }
}

function toText(mode: string, d: any): string {
  if (mode === "summary") return `${d.title}\n\n${(d.keyPoints || []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}\n\n${d.summary}`;
  if (mode === "explain") return `${d.title}\n\nELI5: ${d.eli5}\n\nIn depth: ${d.detailed}\n\nAnalogy: ${d.analogy}`;
  if (mode === "answer") return d.answer;
  if (mode === "mindmap") return `${d.title}\n\n${(d.branches || []).map((b: any) => `• ${b.title}\n${(b.nodes || []).map((n: string) => `  - ${n}`).join("\n")}`).join("\n\n")}`;
  if (mode === "planner") return `${d.title}\n\n${(d.days || []).map((x: any) => `Day ${x.day} — ${x.focus}\n${(x.tasks || []).map((t: string) => `  • ${t}`).join("\n")}`).join("\n\n")}`;
  if (mode === "course") return `${d.title}\n\n${d.overview}\n\n${(d.chapters || []).map((c: any, i: number) => `${i + 1}. ${c.title}\n   ${c.summary}`).join("\n\n")}`;
  return d.title || "";
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("study");

  // study state
  const [mode, setMode] = useState("summary");
  const [lang, setLang] = useState("English");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ mode: string; data: any } | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // library + progress
  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);

  const isAsk = mode === "ask";

  useEffect(() => { loadLibrary().then(setLibrary); }, []);

  function selectTab(t: Tab) {
    if (t === "saved") loadLibrary().then(setLibrary);
    if (t === "progress") getProgress().then(setProgress);
    setTab(t);
  }

  async function generate() {
    if (!topic.trim()) { setError(isAsk ? "Type your question." : "Enter a topic to study."); return; }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const body = isAsk
        ? { mode: "ask", question: topic.trim(), context: "general studies", lang }
        : { mode, topic: topic.trim(), lang };
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setResult({ mode: isAsk ? "answer" : mode, data: json.data });
      recordStudyDay();
    } catch (e: any) {
      setError(e?.message || "Could not reach VidhyaAI. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleMic() {
    try {
      if (recording) {
        setRecording(false);
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) return;
        setTranscribing(true);
        const fd = new FormData();
        fd.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as any);
        fd.append("lang", lang);
        const res = await fetch(`${API_BASE}/api/stt`, { method: "POST", body: fd });
        const json = await res.json();
        if (res.ok && json.transcript) setTopic((t) => (t ? `${t} ${json.transcript}` : json.transcript));
      } else {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { Alert.alert("Microphone", "Please allow microphone access for voice input."); return; }
        await setAudioModeAsync({ allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      }
    } catch {
      Alert.alert("Voice input", "Couldn't capture audio on this device.");
      setRecording(false);
    } finally {
      setTranscribing(false);
    }
  }

  async function onSave(item: SavedItem) {
    setLibrary(await saveItem(item));
  }
  async function onDelete(id: string) {
    setLibrary(await removeItem(id));
  }
  function openSaved(it: SavedItem) {
    setResult({ mode: it.mode, data: it.data });
    setLang(it.lang);
    setTab("study");
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.brand}>Vidhya<Text style={{ color: C.accent }}>AI</Text></Text>
        <Text style={styles.brandSub}>{TABS.find((t) => t.key === tab)?.label} · Sarvam AI 🇮🇳</Text>
      </View>

      {/* Body */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {tab === "study" && (
          <StudyScreen
            mode={mode} setMode={setMode}
            lang={lang} setLang={setLang}
            topic={topic} setTopic={setTopic}
            loading={loading} error={error} result={result}
            recording={recording} transcribing={transcribing}
            onGenerate={generate} onMic={toggleMic} onSave={onSave}
            isAsk={isAsk}
            bottomPad={insets.bottom + 78}
          />
        )}
        {tab === "saved" && (
          <SavedScreen items={library} onOpen={openSaved} onDelete={onDelete} bottomPad={insets.bottom + 78} />
        )}
        {tab === "progress" && (
          <ProgressScreen progress={progress} bottomPad={insets.bottom + 78} />
        )}
      </KeyboardAvoidingView>

      {/* Bottom navigation */}
      <View style={[styles.nav, { paddingBottom: insets.bottom + 8 }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.navItem} onPress={() => selectTab(t.key)} activeOpacity={0.7}>
              <Text style={[styles.navIcon, { opacity: active ? 1 : 0.5 }]}>{t.icon}</Text>
              <Text style={[styles.navLabel, active && { color: C.primary }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- Study screen ---------- */
function StudyScreen(p: any) {
  const activeMode = MODES.find((m) => m.key === p.mode);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: p.bottomPad }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Mode</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {MODES.map((m) => (
          <Chip key={m.key} active={p.mode === m.key} label={`${m.icon} ${m.label}`} onPress={() => { p.setMode(m.key); }} />
        ))}
      </ScrollView>

      <Text style={styles.label}>Language</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {LANGS.map((l) => (
          <Chip key={l} active={p.lang === l} label={l} onPress={() => p.setLang(l)} small />
        ))}
      </ScrollView>

      <View style={styles.labelRow}>
        <Text style={[styles.label, { marginBottom: 0 }]}>{p.isAsk ? "Your question" : "Topic / notes"}</Text>
        <TouchableOpacity onPress={p.onMic} disabled={p.transcribing} style={[styles.micBtn, p.recording && styles.micActive]}>
          {p.transcribing ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <Text style={[styles.micText, p.recording && { color: C.rose }]}>{p.recording ? "⏺ Stop" : "🎤 Speak"}</Text>
          )}
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        placeholder={p.isAsk ? "Ask a doubt…" : "e.g. Photosynthesis, Newton's laws…"}
        placeholderTextColor={C.muted}
        value={p.topic}
        onChangeText={p.setTopic}
        multiline
      />

      {p.error ? <Text style={styles.error}>⚠️ {p.error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={p.onGenerate} disabled={p.loading} activeOpacity={0.85}>
        {p.loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{p.isAsk ? "💬 Ask" : `✨ Generate ${activeMode?.label}`}</Text>}
      </TouchableOpacity>

      {p.result && (
        <View style={{ marginTop: 22 }}>
          <Result mode={p.result.mode} data={p.result.data} lang={p.lang} onSave={p.onSave} />
        </View>
      )}
    </ScrollView>
  );
}

/* ---------- Saved screen ---------- */
function SavedScreen({ items, onOpen, onDelete, bottomPad }: { items: SavedItem[]; onOpen: (i: SavedItem) => void; onDelete: (id: string) => void; bottomPad: number }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>📚</Text>
          <Text style={[styles.muted, { textAlign: "center", marginTop: 10 }]}>
            Nothing saved yet. Tap ☆ Save on any result to keep it here — it stays even after you close the app.
          </Text>
        </View>
      ) : (
        items.map((it) => {
          const m = MODES.find((x) => x.key === it.mode);
          return (
            <View key={it.id} style={styles.savedCard}>
              <Text style={styles.savedTitle} numberOfLines={2}>{it.title}</Text>
              <Text style={styles.muted}>{m?.icon} {m?.label || it.mode} · {it.lang}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={[styles.action, { borderColor: C.primary, backgroundColor: "rgba(124,140,255,0.12)" }]} onPress={() => onOpen(it)}>
                  <Text style={[styles.actionText, { color: C.fg }]}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={() => onDelete(it.id)}>
                  <Text style={[styles.actionText, { color: C.rose }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

/* ---------- Progress screen ---------- */
function ProgressScreen({ progress, bottomPad }: { progress: Progress | null; bottomPad: number }) {
  const cards = progress
    ? [
        { label: "Day streak", value: `${progress.streak}🔥` },
        { label: "Tests taken", value: `${progress.attempts}` },
        { label: "Avg score", value: `${progress.avg}%` },
        { label: "Best score", value: `${progress.best}%` },
      ]
    : [];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
      <View style={styles.statGrid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.statCard}>
            <Text style={styles.statValue}>{c.value}</Text>
            <Text style={styles.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.label, { marginTop: 20 }]}>Recent tests</Text>
      {!progress || progress.recent.length === 0 ? (
        <Text style={styles.muted}>Take a Mock Test to start tracking your progress.</Text>
      ) : (
        progress.recent.map((a, i) => (
          <View key={i} style={styles.attemptRow}>
            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{a.topic}</Text>
            <Text style={{ color: a.percent >= 60 ? C.accent : C.amber, fontWeight: "700" }}>{a.percent}%</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.chip, active && styles.chipActive, small && { paddingVertical: 6 }]}>
      <Text style={[styles.chipText, active && { color: C.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionBar({ mode, data, lang, onSave }: { mode: string; data: any; lang: string; onSave: (i: SavedItem) => void }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const text = toText(mode, data);
  async function save() {
    if (saved) return;
    await onSave({ id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, title: data.title || (mode === "answer" ? "Doubt answer" : "VidhyaAI"), mode, data, lang, savedAt: Date.now() });
    setSaved(true);
  }
  return (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.action} onPress={() => playTTS(text, lang, setBusy)} disabled={busy}>
        {busy ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={styles.actionText}>🔊 Listen</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => Share.share({ message: text })}>
        <Text style={styles.actionText}>↗ Share</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.action, saved && { borderColor: C.accent }]} onPress={save}>
        <Text style={[styles.actionText, saved && { color: C.accent }]}>{saved ? "★ Saved" : "☆ Save"}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Result renderers ---------- */
function Result({ mode, data, lang, onSave }: { mode: string; data: any; lang: string; onSave: (i: SavedItem) => void }) {
  if (mode === "test") return <View style={styles.card}><TestView data={data} /></View>;
  return (
    <View style={styles.card}>
      {mode !== "answer" && <Text style={styles.title}>{data.title}</Text>}
      <ActionBar mode={mode} data={data} lang={lang} onSave={onSave} />
      {mode === "summary" && <Summary data={data} />}
      {mode === "explain" && <Explain data={data} />}
      {mode === "quiz" && <Quiz data={data} />}
      {mode === "flashcards" && <Flashcards data={data} />}
      {mode === "mindmap" && <MindMap data={data} />}
      {mode === "planner" && <Planner data={data} />}
      {mode === "course" && <Course data={data} />}
      {mode === "answer" && <Text style={styles.body}>{data.answer}</Text>}
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
  return <QuestionList questions={data.questions} picked={picked} setPicked={setPicked} />;
}

function TestView({ data }: { data: any }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const total = data.questions?.length || 0;
  const answered = Object.keys(picked).length;
  const score = (data.questions || []).reduce((a: number, q: any, i: number) => a + (picked[i] === q.answerIndex ? 1 : 0), 0);
  const percent = total ? Math.round((score / total) * 100) : 0;
  return (
    <View>
      <Text style={styles.title}>{data.title}</Text>
      {submitted && (
        <View style={[styles.block, { borderColor: percent >= 60 ? C.accent : C.amber, alignItems: "center" }]}>
          <Text style={{ fontSize: 32 }}>{percent >= 60 ? "🎉" : "💪"}</Text>
          <Text style={[styles.title, { marginTop: 4 }]}>{score}/{total} ({percent}%)</Text>
          <Text style={styles.muted}>{percent >= 60 ? "Great job!" : "Keep practising!"}</Text>
        </View>
      )}
      <QuestionList questions={data.questions} picked={picked} setPicked={setPicked} reveal={submitted} />
      {!submitted && (
        <TouchableOpacity
          style={[styles.btn, answered < total && { opacity: 0.5 }]}
          disabled={answered < total}
          onPress={() => { recordTest(data.title, score, total); setSubmitted(true); }}
        >
          <Text style={styles.btnText}>{answered < total ? `Answer all ${total}` : "Submit ✓"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function QuestionList({ questions, picked, setPicked, reveal }: { questions: any[]; picked: Record<number, number>; setPicked: (f: any) => void; reveal?: boolean }) {
  return (
    <View>
      {questions?.map((q: any, qi: number) => {
        const chosen = picked[qi];
        const answered = chosen !== undefined || reveal;
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
                <TouchableOpacity key={oi} disabled={chosen !== undefined} onPress={() => setPicked((p: any) => ({ ...p, [qi]: oi }))} style={[styles.opt, { backgroundColor: bg, borderColor: bd }]}>
                  <Text style={{ color: col }}>{String.fromCharCode(65 + oi)}. {opt}</Text>
                </TouchableOpacity>
              );
            })}
            {answered && q.explanation ? <Text style={styles.why}>Why: {q.explanation}</Text> : null}
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
          <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setFlipped((p) => ({ ...p, [i]: !p[i] }))} style={[styles.flash, f && { backgroundColor: "rgba(124,140,255,0.12)", borderColor: C.primary }]}>
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

function Course({ data }: { data: any }) {
  return (
    <View>
      <Text style={[styles.muted, { marginBottom: 10 }]}>{data.overview}</Text>
      {data.chapters?.map((c: any, i: number) => (
        <View key={i} style={styles.block}>
          <Text style={styles.blockLabel}>{i + 1}. {c.title}</Text>
          <Text style={styles.body}>{c.summary}</Text>
          {c.topics?.length > 0 && (
            <View style={styles.topicWrap}>
              {c.topics.map((t: string) => <Text key={t} style={styles.topicChip}>{t}</Text>)}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.nav },
  brand: { fontSize: 22, fontWeight: "800", color: C.primary },
  brandSub: { fontSize: 12, color: C.muted, marginTop: 1 },

  nav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.nav, paddingTop: 8 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },

  label: { color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  micBtn: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  micActive: { borderColor: C.rose, backgroundColor: "rgba(251,113,133,0.12)" },
  micText: { color: C.muted, fontSize: 12 },
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipActive: { borderColor: C.primary, backgroundColor: "rgba(124,140,255,0.15)" },
  chipText: { color: C.muted, fontSize: 13 },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 14, color: C.fg, minHeight: 54, fontSize: 15 },
  error: { color: C.rose, marginTop: 10, fontSize: 13 },
  btn: { marginTop: 16, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  card: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 18, padding: 16 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 14 },
  action: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { color: C.muted, fontSize: 13 },
  title: { color: C.fg, fontSize: 20, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  bullet: { color: C.accent, backgroundColor: "rgba(56,224,176,0.15)", width: 22, height: 22, borderRadius: 11, textAlign: "center", lineHeight: 22, fontSize: 12, overflow: "hidden" },
  body: { color: "rgba(238,240,246,0.9)", fontSize: 15, flex: 1, lineHeight: 22 },
  overviewLabel: { color: C.primary2, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 21 },
  block: { borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 12, marginBottom: 10 },
  blockLabel: { color: C.fg, fontWeight: "600", marginBottom: 6 },
  qText: { color: C.fg, fontWeight: "600", marginBottom: 8 },
  opt: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 7 },
  why: { color: C.muted, fontSize: 13, marginTop: 4 },
  flash: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, minHeight: 90, justifyContent: "center" },
  flashSide: { color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  topicWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  topicChip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, color: C.muted, fontSize: 12 },

  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  savedCard: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  savedTitle: { color: C.fg, fontWeight: "600", fontSize: 15, marginBottom: 3 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  statValue: { color: C.primary, fontSize: 26, fontWeight: "800" },
  statLabel: { color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  attemptRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 8 },
});
