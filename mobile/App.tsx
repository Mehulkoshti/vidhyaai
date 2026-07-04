import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
  isOnboarded,
  loadLibrary,
  recordStudyDay,
  recordTest,
  removeItem,
  saveItem,
  setOnboarded,
  type Progress,
  type SavedItem,
} from "./storage";

/**
 * VidhyaAI mobile (Expo) — a ChatGPT-style native client for the same VidhyaAI
 * backend that powers the web app. Every AI call runs on Sarvam AI server-side,
 * so no key ships in the app.
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
  { key: "ask", label: "Ask", icon: "💬" },
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "explain", label: "Explain", icon: "💡" },
  { key: "quiz", label: "Quiz", icon: "🎯" },
  { key: "flashcards", label: "Flashcards", icon: "🃏" },
  { key: "test", label: "Mock Test", icon: "🧪" },
  { key: "mindmap", label: "Mind Map", icon: "🗺️" },
  { key: "planner", label: "Planner", icon: "📅" },
  { key: "course", label: "Course", icon: "📖" },
];

const LANGS = [
  "English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali",
  "Telugu", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Odia",
];

const EXAMPLES = ["Photosynthesis", "Newton's laws", "French Revolution", "OOP concepts"];

const TABS = [
  { key: "study", label: "Study", icon: "✨" },
  { key: "saved", label: "Saved", icon: "📚" },
  { key: "progress", label: "Progress", icon: "📊" },
  { key: "about", label: "About", icon: "ℹ️" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Msg =
  | { id: string; role: "user"; mode: string; topic: string }
  | { id: string; role: "assistant"; mode: string; data: any }
  | { id: string; role: "assistant"; error: true; text: string };

function newId() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

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

  // chat state
  const [mode, setMode] = useState("ask");
  const [lang, setLang] = useState("English");
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // library + progress
  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);

  // keyboard height (to lift the composer above the keyboard) + onboarding
  const [kb, setKb] = useState(0);
  const [onboarded, setOnb] = useState<boolean | null>(null);

  const isAsk = mode === "ask";

  useEffect(() => { loadLibrary().then(setLibrary); }, []);
  useEffect(() => { isOnboarded().then(setOnb); }, []);
  useEffect(() => {
    // Compute the exact keyboard overlap from its top edge (screenY) rather than
    // endCoordinates.height, which over-reports under Android edge-to-edge and
    // caused the composer to jump too high.
    const onFrame = (e: any) => {
      const winH = Dimensions.get("window").height;
      const overlap = winH - e.endCoordinates.screenY;
      setKb(overlap > 0 ? overlap : 0);
    };
    const showEvt = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const subs = [
      Keyboard.addListener(showEvt, onFrame),
      Keyboard.addListener("keyboardDidChangeFrame", onFrame),
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  function selectTab(t: Tab) {
    if (t === "saved") loadLibrary().then(setLibrary);
    if (t === "progress") getProgress().then(setProgress);
    setTab(t);
  }

  async function send() {
    const t = topic.trim();
    if (!t || loading) return;
    const userMsg: Msg = { id: newId(), role: "user", mode, topic: t };
    setMessages((m) => [...m, userMsg]);
    setTopic("");
    setLoading(true);
    try {
      const body = isAsk
        ? { mode: "ask", question: t, context: "general studies", lang }
        : { mode, topic: t, lang };
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setMessages((m) => [...m, { id: newId(), role: "assistant", mode: isAsk ? "answer" : mode, data: json.data }]);
      recordStudyDay();
    } catch (e: any) {
      setMessages((m) => [...m, { id: newId(), role: "assistant", error: true, text: e?.message || "Could not reach VidhyaAI." }]);
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

  async function onSave(item: SavedItem) { setLibrary(await saveItem(item)); }
  async function onDelete(id: string) { setLibrary(await removeItem(id)); }
  function openSaved(it: SavedItem) {
    setMessages((m) => [...m, { id: newId(), role: "assistant", mode: it.mode, data: it.data }]);
    setLang(it.lang);
    setTab("study");
  }

  const activeMode = MODES.find((m) => m.key === mode)!;

  if (onboarded === null) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (onboarded === false) {
    return <Onboarding onDone={() => { setOnboarded(); setOnb(true); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.nav} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Vidhya<Text style={{ color: C.accent }}>AI</Text></Text>
          <Text style={styles.brandSub}>{TABS.find((t) => t.key === tab)?.label} · Sarvam AI 🇮🇳</Text>
        </View>
        {tab === "study" && messages.length > 0 && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setMessages([])}>
            <Text style={styles.newBtnText}>＋ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body — marginBottom lifts everything above the keyboard */}
      <View style={{ flex: 1, marginBottom: kb }}>
        {tab === "study" && (
          <ChatScreen
            messages={messages}
            loading={loading}
            lang={lang}
            onSave={onSave}
            onExample={(ex: string) => setTopic(ex)}
            mode={mode}
            setMode={setMode}
            topic={topic}
            setTopic={setTopic}
            onSend={send}
            onMic={toggleMic}
            recording={recording}
            transcribing={transcribing}
            onOpenLang={() => setLangOpen(true)}
            activeMode={activeMode}
            keyboardUp={kb > 0}
            bottomInset={insets.bottom}
          />
        )}
        {tab === "saved" && <SavedScreen items={library} onOpen={openSaved} onDelete={onDelete} bottomPad={insets.bottom + 80} />}
        {tab === "progress" && <ProgressScreen progress={progress} bottomPad={insets.bottom + 80} />}
        {tab === "about" && <AboutScreen bottomPad={insets.bottom + 80} />}
      </View>

      {/* Bottom nav — hidden while typing so it doesn't crowd the keyboard */}
      {kb === 0 && (
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
      )}

      {/* Language picker */}
      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>🌐 Language</Text>
              <TouchableOpacity onPress={() => setLangOpen(false)}><Text style={styles.close}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {LANGS.map((l) => (
                <TouchableOpacity key={l} style={[styles.langRow, lang === l && styles.langRowActive]} onPress={() => { setLang(l); setLangOpen(false); }}>
                  <Text style={{ color: lang === l ? C.accent : C.fg, fontSize: 16 }}>{l}</Text>
                  {lang === l && <Text style={{ color: C.accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Chat screen ---------- */
function ChatScreen(p: any) {
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (p.keyboardUp) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [p.keyboardUp]);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {p.messages.length === 0 ? (
          <View style={styles.welcome}>
            <Text style={{ fontSize: 44 }}>📚</Text>
            <Text style={styles.welcomeTitle}>What are we studying today?</Text>
            <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>
              Pick a mode below, type a topic (or use 🎤), and hit send. Ask follow-up doubts anytime.
            </Text>
            <View style={styles.exampleWrap}>
              {EXAMPLES.map((ex) => (
                <TouchableOpacity key={ex} style={styles.exampleChip} onPress={() => p.onExample(ex)}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          p.messages.map((m: Msg) => <MessageBubble key={m.id} m={m} lang={p.lang} onSave={p.onSave} />)
        )}
        {p.loading && (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={styles.muted}>Thinking…</Text>
          </View>
        )}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: 10 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} keyboardShouldPersistTaps="handled">
          {MODES.map((m) => (
            <Chip key={m.key} active={p.mode === m.key} label={`${m.icon} ${m.label}`} onPress={() => p.setMode(m.key)} />
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TouchableOpacity onPress={p.onMic} disabled={p.transcribing} style={styles.iconBtn}>
            {p.transcribing ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={{ fontSize: 18, color: p.recording ? C.rose : C.muted }}>{p.recording ? "⏺" : "🎤"}</Text>}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={p.mode === "ask" ? "Ask a doubt…" : `Topic for ${p.activeMode.label.toLowerCase()}…`}
            placeholderTextColor={C.muted}
            value={p.topic}
            onChangeText={p.setTopic}
            multiline
          />
          <TouchableOpacity style={styles.langPill} onPress={p.onOpenLang}>
            <Text style={{ color: C.muted, fontSize: 11 }}>{p.lang.slice(0, 3)} ▾</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={p.onSend} disabled={p.loading}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function MessageBubble({ m, lang, onSave }: { m: Msg; lang: string; onSave: (i: SavedItem) => void }) {
  if (m.role === "user") {
    const mode = MODES.find((x) => x.key === m.mode);
    return (
      <View style={styles.userWrap}>
        <View style={styles.userBubble}>
          <Text style={styles.userMeta}>{mode?.icon}{m.mode !== "ask" ? ` ${mode?.label}` : ""}</Text>
          <Text style={styles.userText}>{m.topic}</Text>
        </View>
      </View>
    );
  }
  if ("error" in m) {
    return (
      <View style={styles.errBubble}>
        <Text style={styles.errText}>⚠️ {m.text}</Text>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 14 }}>
      <Result mode={m.mode} data={m.data} lang={lang} onSave={onSave} />
    </View>
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

/* ---------- About screen ---------- */
const SARVAM_TOOLS = [
  { icon: "🧠", t: "Multilingual LLM", d: "Writes every piece of study material, natively in your language." },
  { icon: "🔊", t: "Bulbul TTS", d: "Reads it aloud in natural Indian voices." },
  { icon: "👁️", t: "Sarvam Vision", d: "OCR for photos & PDFs of handwritten notes." },
  { icon: "🎙️", t: "Saaras STT", d: "Ask doubts by voice in your language." },
];

function AboutScreen({ bottomPad }: { bottomPad: number }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomPad }}>
      <View style={{ alignItems: "center", marginTop: 6, marginBottom: 8 }}>
        <Text style={{ fontSize: 40 }}>📚</Text>
        <Text style={[styles.brand, { fontSize: 28, marginTop: 6 }]}>Vidhya<Text style={{ color: C.accent }}>AI</Text></Text>
        <Text style={styles.muted}>AI Study Companion · Sarvam AI 🇮🇳</Text>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>What is VidhyaAI?</Text>
        <Text style={styles.body}>
          Turn any topic, your notes, or a photo of your textbook into instant, exam-ready study
          material — in your own language. Built to help students who don&apos;t just want to study in English.
        </Text>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>9 study modes</Text>
        <View style={styles.topicWrap}>
          {MODES.map((m) => (
            <Text key={m.key} style={styles.topicChip}>{m.icon} {m.label}</Text>
          ))}
        </View>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>Powered by Sarvam AI 🇮🇳</Text>
        {SARVAM_TOOLS.map((s) => (
          <View key={s.t} style={styles.block}>
            <Text style={styles.blockLabel}>{s.icon} {s.t}</Text>
            <Text style={styles.muted}>{s.d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>12 languages</Text>
        <Text style={styles.muted}>{LANGS.join(" · ")}</Text>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>Also on the web</Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://vidhya-ai-01.netlify.app")}>
          <Text style={styles.link}>🌐 vidhya-ai-01.netlify.app</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL("https://github.com/Mehulkoshti/vidhyaai")}>
          <Text style={styles.link}>💻 github.com/Mehulkoshti/vidhyaai</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>
        Built for HACKHAZARDS &apos;26 · Team The Pride · v1.0.0
      </Text>
    </ScrollView>
  );
}

/* ---------- Onboarding ---------- */
const SLIDES = [
  { icon: "📚", title: "Study anything, instantly", text: "Turn any topic, notes, or a photo of your textbook into summaries, quizzes, flashcards & more." },
  { icon: "🇮🇳", title: "In your language", text: "Powered by Sarvam AI — study in Hindi, Marathi, Tamil, Bengali & 12 languages, with natural voice." },
  { icon: "🎯", title: "Test, track & grow", text: "Take mock tests, earn certificates, track your streak, and revise the smart way." },
];

function Onboarding({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;

  function next() {
    if (last) { onDone(); return; }
    ref.current?.scrollTo({ x: (idx + 1) * width, animated: true });
    setIdx(idx + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <View style={{ alignItems: "flex-end", paddingHorizontal: 18, paddingTop: 8 }}>
        <TouchableOpacity onPress={onDone}><Text style={styles.muted}>Skip</Text></TouchableOpacity>
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 }}>
            <Text style={{ fontSize: 84 }}>{s.icon}</Text>
            <Text style={styles.onbTitle}>{s.title}</Text>
            <Text style={styles.onbText}>{s.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
        ))}
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <TouchableOpacity style={styles.btn} onPress={next}>
          <Text style={styles.btnText}>{last ? "✨ Get started" : "Next →"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.chip, active && styles.chipActive]}>
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
    await onSave({ id: newId(), title: data.title || (mode === "answer" ? "Doubt answer" : "VidhyaAI"), mode, data, lang, savedAt: Date.now() });
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.nav },
  brand: { fontSize: 22, fontWeight: "800", color: C.primary },
  brandSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  newBtn: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText: { color: C.muted, fontSize: 13, fontWeight: "600" },

  nav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.nav, paddingTop: 8 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },

  welcome: { alignItems: "center", marginTop: 50, paddingHorizontal: 24 },
  welcomeTitle: { color: C.fg, fontSize: 22, fontWeight: "700", marginTop: 14, textAlign: "center" },
  exampleWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 18 },
  exampleChip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },

  userWrap: { alignItems: "flex-end", marginBottom: 14 },
  userBubble: { maxWidth: "85%", backgroundColor: "rgba(124,140,255,0.18)", borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 9 },
  userMeta: { color: C.muted, fontSize: 11, marginBottom: 2 },
  userText: { color: C.fg, fontSize: 15 },
  errBubble: { borderWidth: 1, borderColor: "rgba(251,113,133,0.4)", backgroundColor: "rgba(251,113,133,0.1)", borderRadius: 14, padding: 12, marginBottom: 14 },
  errText: { color: C.rose, fontSize: 14 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },

  composer: { borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.nav, paddingHorizontal: 12, paddingTop: 10 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 18, padding: 6 },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  input: { flex: 1, color: C.fg, fontSize: 15, maxHeight: 110, paddingVertical: 8, paddingHorizontal: 4 },
  langPill: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, alignSelf: "center" },
  sendBtn: { backgroundColor: C.primary, borderRadius: 12, width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { maxHeight: "70%", backgroundColor: "#0d0f17", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.border },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { color: C.fg, fontSize: 18, fontWeight: "700" },
  close: { color: C.muted, fontSize: 18, paddingHorizontal: 6 },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12 },
  langRowActive: { backgroundColor: "rgba(56,224,176,0.1)" },

  label: { color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 7 },
  chipActive: { borderColor: C.primary, backgroundColor: "rgba(124,140,255,0.15)" },
  chipText: { color: C.muted, fontSize: 13 },
  btn: { marginTop: 12, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  card: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 18, padding: 16 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  action: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { color: C.muted, fontSize: 13 },
  title: { color: C.fg, fontSize: 19, fontWeight: "700", marginBottom: 12 },
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

  aboutSection: { marginTop: 18 },
  aboutTitle: { color: C.primary2, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  link: { color: C.primary, fontSize: 15, paddingVertical: 6 },

  onbTitle: { color: C.fg, fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: 24 },
  onbText: { color: C.muted, fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive: { backgroundColor: C.primary, width: 22 },
});
