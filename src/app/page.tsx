import Link from "next/link";

const MODES = [
  { icon: "📝", title: "Summary", desc: "Crisp key points + a clean overview of any topic." },
  { icon: "🎯", title: "Quiz", desc: "Auto-graded MCQs with instant scoring & explanations." },
  { icon: "🃏", title: "Flashcards", desc: "Flip-card revision decks to lock concepts in memory." },
  { icon: "💡", title: "Explain", desc: "ELI5, in-depth, and a memorable analogy — your pick." },
  { icon: "🗺️", title: "Mind Map", desc: "See the whole topic as a visual, branching concept map." },
  { icon: "📝", title: "Mock Test", desc: "A timed 10-question exam with a scored report card." },
  { icon: "🏆", title: "Certificate", desc: "Ace the test and download a branded certificate." },
  { icon: "📅", title: "Study Planner", desc: "Get a day-by-day revision plan up to your exam date." },
  { icon: "📖", title: "Full Course", desc: "Turn a whole syllabus into a chapter-by-chapter course you can drill into." },
];

const POWERS = [
  { icon: "📸", title: "Photo / PDF → Notes", desc: "Snap your handwritten notes or upload a PDF. AI reads it natively and builds study material." },
  { icon: "💬", title: "Ask Any Doubt", desc: "Chat with an AI tutor that remembers your whole session — nothing disappears." },
  { icon: "🔊", title: "Listen Aloud", desc: "Natural, native-sounding voices via Sarvam's Bulbul — revise with your ears, in your language." },
  { icon: "🌐", title: "Your Language", desc: "Powered by Sarvam AI, India's own LLM. 12 languages — Hindi, Marathi, Tamil, Bengali, Telugu, Kannada, Gujarati & more — study how you think." },
];

const STEPS = [
  { n: "1", title: "Drop your topic", desc: "Type a topic, paste notes, or attach a photo/PDF of your material." },
  { n: "2", title: "Pick a mode", desc: "Summary, quiz, flashcards, explain — or just ask a doubt." },
  { n: "3", title: "Learn & revise", desc: "Get instant study material, listen, download, and keep asking." },
];

const STATS = [
  { value: "9", label: "Study modes" },
  { value: "12", label: "Languages" },
  { value: "₹0", label: "Cost, forever" },
  { value: "∞", label: "Topics" },
];

const USE_CASES = [
  { icon: "🎓", title: "Exam crunch", desc: "Turn a fat chapter into key points and a quick quiz the night before." },
  { icon: "📷", title: "Messy notes", desc: "Photograph your handwritten notes and get clean, structured material back." },
  { icon: "🧠", title: "Quick revision", desc: "Flashcards + listen mode for last-minute recall on the bus or in bed." },
  { icon: "🌍", title: "Language comfort", desc: "Struggling with English textbooks? Learn the same thing in your language." },
];

const FAQS = [
  { q: "Is it really free?", a: "Yes — VidhyaAI is 100% free. No sign-up, no credit card, no hidden limits for normal use." },
  { q: "Can it read my handwritten notes?", a: "Yes. Upload a photo or PDF and the AI reads it directly to build summaries, quizzes, and flashcards." },
  { q: "Which languages are supported?", a: "12 — English, Hindi, Hinglish, Marathi, Tamil, Bengali, Telugu, Kannada, Gujarati, Malayalam, Punjabi and Odia, powered by Sarvam AI." },
  { q: "Do my chats get saved?", a: "Your session stays in your browser until you close the tab. Nothing is stored on a server, so it's private." },
  { q: "Is the AI always right?", a: "It's very good, but like any AI it can occasionally slip. Always verify critical facts before an exam." },
];

export default function Landing() {
  return (
    <div className="flex-1">
      {/* Nav */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-serif text-xl font-semibold">
          <span className="text-gradient">VidhyaAI</span>
        </span>
        <div className="flex items-center gap-3">
          <Link href="/classroom" className="hidden text-sm text-muted transition hover:text-foreground sm:inline">
            👩‍🏫 Classroom
          </Link>
          <Link href="/rooms" className="hidden text-sm text-muted transition hover:text-foreground sm:inline">
            🤝 Rooms
          </Link>
          <Link
            href="/app"
            className="btn-glow rounded-xl px-5 py-2 text-sm font-medium text-white"
          >
            Open App →
          </Link>
        </div>
      </nav>

      {/* Hero (with floating decorations) */}
      <div className="relative">
        {/* Spinning glow rings */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 -z-[1] hidden h-[420px] w-[420px] -translate-x-1/2 lg:block">
          <div className="spin-slow absolute inset-0 rounded-full border border-primary/10" />
          <div className="spin-slow-rev absolute inset-8 rounded-full border border-dashed border-primary-2/10" />
          <div className="spin-slow absolute inset-20 rounded-full border border-accent/10" />
        </div>

        {/* Floating chips — left & right (desktop only) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="float-chip float-a left-[6%] top-[18%] h-16 w-16 text-2xl">📚</div>
          <div className="float-chip float-b left-[12%] top-[55%] h-14 w-14 text-xl">🧠</div>
          <div className="float-chip float-c left-[3%] top-[80%] h-12 w-12 text-lg">✏️</div>
          <div className="float-chip float-b right-[7%] top-[16%] h-16 w-16 text-2xl">🎓</div>
          <div className="float-chip float-c right-[12%] top-[52%] h-14 w-14 text-xl">⚛️</div>
          <div className="float-chip float-a right-[4%] top-[80%] h-12 w-12 text-lg">🔬</div>
        </div>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-3xl px-5 pt-16 pb-20 text-center sm:pt-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-3.5 py-1.5 text-xs text-muted backdrop-blur animate-fade-up">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          AI Study Companion · Powered by Sarvam AI 🇮🇳
        </div>

        <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl animate-fade-up" style={{ animationDelay: "0.05s" }}>
          Study smarter with <span className="text-gradient">VidhyaAI</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Turn any topic, your notes, or a photo of your textbook into instant
          summaries, quizzes, flashcards and dead-simple explanations — in your
          language.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <Link
            href="/app"
            className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3.5 font-medium text-white sm:w-auto"
          >
            ✨ Start learning — it&apos;s free
          </Link>
          <a
            href="#features"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white/[0.03] px-8 py-3.5 font-medium text-foreground transition hover:border-border-strong hover:bg-white/[0.05] sm:w-auto"
          >
            See features
          </a>
        </div>

        <p className="mt-5 text-xs text-muted/60 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          No sign-up · No credit card · 100% free
        </p>
      </section>
      </div>

      {/* Stats strip */}
      <section className="mx-auto w-full max-w-3xl px-5">
        <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-6 text-center">
              <div className="font-serif text-3xl font-semibold text-gradient">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Scrolling subject marquee */}
      <section className="mt-14 w-full">
        <p className="mb-4 text-center text-xs uppercase tracking-widest text-muted/50">
          Works for any subject
        </p>
        <div className="marquee-mask w-full overflow-hidden">
          <div className="marquee-track gap-3">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex gap-3 pr-3">
                {[
                  "📐 Mathematics", "🧪 Chemistry", "🧬 Biology", "⚛️ Physics",
                  "📜 History", "🌍 Geography", "💻 Computer Science", "💰 Economics",
                  "📖 Literature", "🧠 Psychology", "⚖️ Law", "🩺 Medicine",
                ].map((s) => (
                  <span
                    key={s + dup}
                    className="whitespace-nowrap rounded-full border border-border bg-white/[0.03] px-4 py-2 text-sm text-muted"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App preview mockup */}
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <div className="glass rounded-3xl p-4 sm:p-6">
          {/* fake window bar */}
          <div className="mb-4 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-muted/60">VidhyaAI · chat</span>
          </div>
          {/* mock conversation */}
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm bg-primary/20 px-4 py-2 text-sm text-foreground">
                <span className="mr-1.5 text-xs text-muted">📝 Summary</span> Photosynthesis
              </div>
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-border bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white/[0.04]">📝</span>
                <span className="font-serif text-lg text-foreground">Photosynthesis: How Plants Make Food</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
                <li className="flex gap-2"><span className="text-accent">●</span> Plants convert sunlight, water & CO₂ into glucose.</li>
                <li className="flex gap-2"><span className="text-accent">●</span> Takes place in chloroplasts using chlorophyll.</li>
                <li className="flex gap-2"><span className="text-accent">●</span> Releases oxygen — the air we breathe.</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm bg-primary/20 px-4 py-2 text-sm text-foreground">
                <span className="mr-1.5 text-xs text-muted">💬</span> Why is chlorophyll green?
              </div>
            </div>
            <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-white/[0.03] px-4 py-2.5 text-sm text-foreground/85">
              Because it absorbs red and blue light for energy and reflects green light back to your eyes. 🌱
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-muted/70">A real session — ask, generate, and keep going.</p>
      </section>

      {/* Modes */}
      <section id="features" className="mx-auto w-full max-w-5xl px-5 py-12 scroll-mt-10">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">
          Nine ways to <span className="text-gradient">master</span> anything
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted">
          One topic in, complete study material out.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <div key={m.title} className="glass rounded-2xl p-5 transition hover:-translate-y-1">
              <div className="text-3xl">{m.icon}</div>
              <h3 className="mt-3 font-medium text-foreground">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Power features */}
      <section className="mx-auto w-full max-w-5xl px-5 py-12">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">
          Built like a <span className="text-gradient">real product</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {POWERS.map((p) => (
            <div key={p.title} className="glass flex gap-4 rounded-2xl p-5">
              <div className="text-3xl">{p.icon}</div>
              <div>
                <h3 className="font-medium text-foreground">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="mx-auto w-full max-w-5xl px-5 py-12">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">
          Perfect for <span className="text-gradient">every</span> study moment
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <div key={u.title} className="rounded-2xl border border-border bg-white/[0.02] p-5 transition hover:border-border-strong hover:bg-white/[0.04]">
              <div className="text-3xl">{u.icon}</div>
              <h3 className="mt-3 font-medium text-foreground">{u.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-4xl px-5 py-12">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">
          How it <span className="text-gradient">works</span>
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-border bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-2 font-serif text-lg font-semibold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 font-medium text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-2xl px-5 py-12">
        <h2 className="text-center font-serif text-3xl font-semibold sm:text-4xl">
          Questions? <span className="text-gradient">Answered.</span>
        </h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group glass rounded-2xl px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
                {f.q}
                <span className="ml-3 text-muted transition-transform duration-200 group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
        <div className="glass rounded-3xl p-10">
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            Ready to ace it?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Stop drowning in notes. Let VidhyaAI turn them into something you can
            actually learn from.
          </p>
          <Link
            href="/app"
            className="btn-glow mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 font-medium text-white"
          >
            ✨ Open VidhyaAI
          </Link>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl border-t border-border px-5 py-8 text-center text-xs text-muted/50">
        VidhyaAI · Built with Next.js · Tailwind · Sarvam AI · for HACKHAZARDS &apos;26
      </footer>
    </div>
  );
}
