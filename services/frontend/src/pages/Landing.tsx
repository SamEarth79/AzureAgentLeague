import {
  ArrowRight,
  Play,
  Brain,
  MessageSquareText,
  SlidersHorizontal,
  Sparkles,
  Github,
  FileText,
  Video,
  Mail,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "../components/landing/Reveal";
import { ReasoningMock } from "../components/landing/ReasoningMock";
import { CanvasMock } from "../components/landing/CanvasMock";
import { MetadataMock } from "../components/landing/MetadataMock";

export default function Landing() {
  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <FeatureReasoning />
      <FeatureCanvas />
      <FeatureMetadata />
      <HowItWorks />
      <DemoVideo />
      <CompetitiveEdge />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 glass-strong border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-electric to-purple grid place-items-center shadow-[0_0_20px_-2px_rgba(96,165,250,0.6)]">
            <Brain size={16} className="text-white" />
          </span>
          ArchMind
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#reasoning" className="hover:text-foreground transition">Reasoning</a>
          <a href="#canvas" className="hover:text-foreground transition">Canvas</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#demo" className="hover:text-foreground transition">Demo</a>
        </nav>
        <Link
          to="/architecture"
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-electric to-purple text-white shadow-[0_0_20px_-4px_rgba(99,102,241,0.7)] hover:shadow-[0_0_30px_-2px_rgba(99,102,241,0.9)] transition-shadow"
        >
          Start Free
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-36 pb-24 px-6">
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ background: "var(--gradient-hero-bg)" }}
      />
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs uppercase tracking-wider text-electric-soft mb-6">
            <Sparkles size={12} /> Foundry-Compatible Reasoning Agent
          </div>
          <h1 className="font-display font-extrabold leading-[0.95] text-5xl sm:text-6xl lg:text-[72px]">
            <span className="block">BUILD AZURE</span>
            <span className="block text-gradient">ARCHITECTURES</span>
            <span className="block">THAT THINK</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            AI architect that reasons through every decision, explains tradeoffs, and draws the
            blueprint in real-time.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/architecture"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-electric to-purple text-white animate-pulse-glow"
            >
              Start Building Free
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold glass text-foreground hover:bg-white/5 transition"
            >
              <Play size={16} className="text-electric" /> Watch 2min Demo
            </a>
          </div>
        </div>

        <div className="relative animate-float-slow">
          <div className="absolute -inset-10 bg-gradient-to-br from-electric/30 via-purple/20 to-transparent blur-3xl -z-10" />
          <div className="relative rounded-3xl overflow-hidden glass-strong p-2">
            <img
              src="/assets/hero-visual.jpg"
              alt="ArchMind reasoning over Azure architecture"
              width={1280}
              height={1024}
              className="w-full h-auto rounded-2xl"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 glass rounded-xl px-4 py-3 animate-float">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reasoning</div>
            <div className="text-sm font-semibold text-electric-soft">12 tradeoffs evaluated</div>
          </div>
          <div
            className="absolute -top-6 -right-6 glass rounded-xl px-4 py-3 animate-float"
            style={{ animationDelay: "1.5s" }}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</div>
            <div className="text-sm font-semibold text-gradient">$247/mo</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureSection({
  id,
  eyebrow,
  title,
  body,
  badge,
  visual,
  reverse = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  badge?: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="py-24 px-6">
      <div
        className={`max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Reveal>
          <div className="text-xs uppercase tracking-[0.2em] text-electric mb-4">{eyebrow}</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">{title}</h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">{body}</p>
          {badge && (
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric/15 border border-electric/30 text-electric-soft text-xs uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-electric animate-pulse-glow" /> {badge}
            </div>
          )}
        </Reveal>
        <Reveal delay={120}>{visual}</Reveal>
      </div>
    </section>
  );
}

function FeatureReasoning() {
  return (
    <FeatureSection
      id="reasoning"
      eyebrow="Reasoning"
      title="SEE THE THINKING, NOT JUST THE OUTPUT."
      body="Watch the agent reason through service selection, flag single points of failure, and self-correct issues. Every decision explained with tradeoffs."
      badge="Powered by Foundry IQ"
      visual={<ReasoningMock />}
    />
  );
}

function FeatureCanvas() {
  return (
    <FeatureSection
      id="canvas"
      reverse
      eyebrow="Canvas"
      title="DRAG. DROP. DONE. AUTO-LAYOUT PERFECTION."
      body="No manual positioning. Agent selects services, places them intelligently, connects them, and renders production-ready architecture diagrams instantly."
      visual={<CanvasMock />}
    />
  );
}

function FeatureMetadata() {
  return (
    <FeatureSection
      id="metadata"
      eyebrow="Metadata"
      title="KNOW THE COST BEFORE YOU DEPLOY."
      body="Real-time cost estimates, performance projections, and failure scenarios. See warnings before they become production issues."
      visual={<MetadataMock />}
    />
  );
}

function HowItWorks() {
  const steps = [
    { Icon: MessageSquareText, title: "Describe", text: "Tell ArchMind what you want to build in plain English." },
    { Icon: Brain, title: "Reason", text: "Agent queries Foundry IQ, selects services, explains every choice." },
    { Icon: SlidersHorizontal, title: "Refine", text: "Ask to make it cheaper, faster, or more resilient — agent re-thinks." },
  ];
  return (
    <section id="how" className="py-24 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <Reveal>
          <div className="text-xs uppercase tracking-[0.2em] text-electric mb-4">How it works</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold">FROM PROMPT TO PRODUCTION</h2>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {steps.map(({ Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 120}>
              <div className="glass rounded-2xl p-7 h-full hover:bg-white/5 transition group">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-electric to-purple grid place-items-center mb-5 shadow-[0_0_30px_-6px_rgba(99,102,241,0.7)] group-hover:scale-110 transition-transform">
                  <Icon size={22} className="text-white" />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Step {i + 1}</div>
                <h3 className="font-display text-2xl font-bold mb-2">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoVideo() {
  return (
    <section id="demo" className="py-24 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl font-bold">WATCH IT REASON</h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="mt-10 relative rounded-2xl p-[1px] bg-gradient-to-br from-electric to-purple shadow-[0_40px_120px_-40px_rgba(99,102,241,0.8)]">
            <div className="aspect-video rounded-2xl glass-strong flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-electric/10 via-transparent to-purple/15" />
              <button className="relative h-20 w-20 rounded-full bg-gradient-to-br from-electric to-purple grid place-items-center animate-pulse-glow group">
                <Play size={28} className="text-white translate-x-0.5 group-hover:scale-110 transition" />
              </button>
            </div>
          </div>
          <p className="mt-5 text-muted-foreground">
            5-minute walkthrough: Image processing pipeline from prompt to production-ready architecture.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function CompetitiveEdge() {
  const cards = [
    { title: "NOT JUST A DIAGRAM TOOL", body: "Other tools draw what you tell them. ArchMind reasons about what you should build." },
    { title: "GROUNDED IN REALITY", body: "Every recommendation backed by Azure docs, pricing data, and architecture patterns via Foundry IQ." },
    { title: "CONTEST WINNER DNA", body: "Built for Microsoft Agents League — Reasoning Agents + Creative Apps + Best IQ Tools." },
  ];
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <div className="text-xs uppercase tracking-[0.2em] text-electric mb-4">Why ArchMind</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold">THE COMPETITIVE EDGE</h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 120}>
              <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-electric/40 to-purple/40 hover:from-electric hover:to-purple transition-all group h-full">
                <div className="rounded-2xl glass-strong p-7 h-full">
                  <h3 className="font-display text-xl font-bold mb-3 group-hover:text-gradient transition">{c.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{c.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="cta" className="py-28 px-6">
      <div className="max-w-5xl mx-auto relative rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-electric/30 via-purple/30 to-electric/20" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(96,165,250,0.4), transparent 50%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.4), transparent 50%)",
          }}
        />
        <div className="relative glass-strong p-12 md:p-20 text-center rounded-3xl border-2 border-white/10">
          <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
            READY TO BUILD <span className="text-gradient">SMARTER?</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">Join the future of cloud architecture design.</p>
          <Link
            to="/architecture"
            className="mt-9 inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-electric to-purple text-white animate-pulse-glow"
          >
            Try ArchMind Now <ArrowRight size={20} />
          </Link>
          <p className="mt-5 text-sm text-muted-foreground">No credit card required · 7 days until contest deadline.</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const links = [
    { Icon: Github, label: "GitHub Repo" },
    { Icon: Video, label: "Demo Video" },
    { Icon: FileText, label: "Documentation" },
    { Icon: Mail, label: "Contact" },
  ];
  return (
    <footer className="border-t border-white/10 py-14 px-6 mt-10">
      <div className="max-w-7xl mx-auto grid gap-8 md:grid-cols-3 items-start">
        <div>
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-electric to-purple grid place-items-center">
              <Brain size={16} className="text-white" />
            </span>
            ArchMind
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">AI architect that reasons through every decision and draws the blueprint in real-time.</p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px] uppercase tracking-wider text-electric-soft">
            React + React Flow + LangGraph + Foundry IQ
          </div>
        </div>
        <div className="md:justify-self-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Resources</div>
          <ul className="space-y-2">
            {links.map(({ Icon, label }) => (
              <li key={label}>
                <a href="#" className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-electric-soft transition">
                  <Icon size={14} /> {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:justify-self-end text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px] uppercase tracking-wider text-foreground/80">
            Powered by Foundry IQ + GitHub Copilot
          </div>
          <p className="mt-4">© 2026 ArchMind — Built for AI Skills Fest</p>
        </div>
      </div>
    </footer>
  );
}
