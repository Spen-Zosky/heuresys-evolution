'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { HeuresysLogo } from '@/components/branding/HeuresysLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { easing } from '@/lib/motion-presets';
import { DotGrid, SectionDivider, ConcentricCircles } from '@/components/ui/decorative';
import {
  ArrowRight,
  Sun,
  Moon,
  ChevronDown,
  Network,
  Brain,
  Target,
  Globe,
  Mail,
  MapPin,
  Layers,
  GitBranch,
  Workflow,
  ShieldCheck,
  BarChart3,
  Users,
  Building2,
  Compass,
  Boxes,
  Sparkles,
} from 'lucide-react';

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easing.out },
  },
};

// ─── Ontological Chain Visual (Hero) ──────────────────────────────────────────
// Represents the 7-layer architecture:
// Organization → BusinessProcess → OrgUnit → Role → Skill → KPI → Assessment

function OntologyGraphVisual() {
  const nodes = [
    { cx: 200, cy: 40, r: 22, label: 'Organization', short: 'ORG', primary: true },
    { cx: 80, cy: 110, r: 18, label: 'Process', short: 'PROC' },
    { cx: 320, cy: 110, r: 18, label: 'OrgUnit', short: 'UNIT' },
    { cx: 60, cy: 200, r: 17, label: 'Role', short: 'ROLE' },
    { cx: 200, cy: 175, r: 20, label: 'Skill', short: 'SKILL', accent: true },
    { cx: 340, cy: 200, r: 17, label: 'KPI', short: 'KPI' },
    { cx: 130, cy: 275, r: 16, label: 'Assessment', short: 'EVAL' },
    { cx: 270, cy: 275, r: 16, label: 'ESCO', short: 'ESCO' },
  ];

  const edges: [number, number][] = [
    [0, 1],
    [0, 2], // Organization → Process, OrgUnit
    [1, 3],
    [2, 5], // Process → Role, OrgUnit → KPI
    [1, 4],
    [2, 4], // Process → Skill, OrgUnit → Skill
    [3, 4],
    [4, 5], // Role → Skill, Skill → KPI
    [3, 6],
    [5, 6], // Role → Assessment, KPI → Assessment
    [4, 7],
    [4, 6], // Skill → ESCO, Skill → Assessment
    [6, 7], // Assessment → ESCO
  ];

  return (
    <svg viewBox="0 0 400 320" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="accent-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {edges.map(([from, to], i) => (
        <motion.line
          key={`edge-${i}`}
          x1={nodes[from].cx}
          y1={nodes[from].cy}
          x2={nodes[to].cx}
          y2={nodes[to].cy}
          stroke="currentColor"
          strokeWidth="1"
          className="text-border"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.35 }}
          transition={{ duration: 0.8, delay: 0.5 + i * 0.04 }}
        />
      ))}

      {/* Animated data pulses along key edges */}
      {[0, 3, 6, 10].map((edgeIdx) => {
        const [from, to] = edges[edgeIdx];
        return (
          <motion.circle
            key={`pulse-${edgeIdx}`}
            r="2.5"
            fill="var(--color-primary)"
            opacity="0.5"
            initial={{ cx: nodes[from].cx, cy: nodes[from].cy }}
            animate={{
              cx: [nodes[from].cx, nodes[to].cx, nodes[from].cx],
              cy: [nodes[from].cy, nodes[to].cy, nodes[from].cy],
            }}
            transition={{ duration: 3.5, repeat: Infinity, delay: edgeIdx * 0.6 }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.g
          key={`node-${i}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: easing.out }}
          style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
        >
          {(node.primary || node.accent) && (
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r + 14}
              fill={node.accent ? 'url(#accent-glow)' : 'url(#node-glow)'}
            />
          )}
          <circle
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="var(--color-card)"
            stroke={node.accent ? 'var(--brand-accent)' : 'var(--color-primary)'}
            strokeWidth={node.primary || node.accent ? 2.5 : 1.5}
            opacity={node.primary || node.accent ? 1 : 0.8}
          />
          <text
            x={node.cx}
            y={node.cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={node.accent ? 'var(--brand-accent)' : 'var(--color-primary)'}
            fontSize={node.primary ? 11 : node.accent ? 10 : 8}
            fontWeight={node.primary || node.accent ? 700 : 500}
            fontFamily="var(--font-display)"
          >
            {node.short}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: easing.out }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="group relative bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-6 hover:border-primary/40 hover:shadow-raised transition-all duration-300 overflow-hidden"
    >
      <h1 className="sr-only">Heuresys Platform</h1>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="h-12 w-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg text-foreground mb-2 font-display">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  value,
  label,
  suffix = '',
  delay = 0,
}: {
  value: string;
  label: string;
  suffix?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: easing.out }}
      className="text-center p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40"
    >
      <div className="text-4xl md:text-5xl font-bold text-foreground font-display mb-1 tracking-tight">
        {value}
        <span className="text-primary">{suffix}</span>
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// ─── Door Card (3 Doors Concept) ──────────────────────────────────────────────

function DoorCard({
  icon: Icon,
  title,
  persona,
  capabilities,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  persona: string;
  capabilities: string[];
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: easing.out }}
      className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-8 hover:border-primary/30 hover:shadow-raised transition-all duration-300"
    >
      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-1 font-display">{title}</h3>
      <p className="text-sm text-primary/80 mb-4 font-medium">{persona}</p>
      <ul className="space-y-2.5 text-sm text-muted-foreground">
        {capabilities.map((cap) => (
          <li key={cap} className="flex items-start gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
            {cap}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function HomeContent() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { scrollY } = useScroll();
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const headerBg = useTransform(scrollY, [0, 100], [0, 1]);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('auth_token');
    const userRole = localStorage.getItem('user_role');

    if (token && userRole) {
      setIsAuthenticated(true);
      if (userRole === 'SUPERUSER') {
        router.push('/platform');
      } else if (['TENANT_OWNER', 'ADMIN', 'HR'].includes(userRole)) {
        router.push('/admin');
      } else {
        router.push('/portal');
      }
    }
  }, [router]);

  // Loading state
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-hero" />
        <div className="absolute inset-0 bg-grain" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center relative z-10"
        >
          <HeuresysLogo size="large" animated />
        </motion.div>
      </div>
    );
  }

  // Redirect state
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-hero" />
        <div className="absolute inset-0 bg-grain" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center relative z-10"
        >
          <HeuresysLogo size="large" animated />
          <p className="mt-4 text-muted-foreground">Reindirizzamento...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══════ FIXED HEADER ═══════ */}
      <motion.header
        style={{ backgroundColor: `rgba(var(--card-rgb), ${headerBg})` }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-border/30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <HeuresysLogo size="medium" />
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a
                href="#architettura"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Architettura
              </a>
              <a
                href="#governance"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Governance
              </a>
              <a
                href="#knowledge-graph"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Knowledge Graph
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9"
                aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-[18px] w-[18px]" />
                ) : (
                  <Moon className="h-[18px] w-[18px]" />
                )}
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
                <Link href="/login">Accedi</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">
                  Inizia Ora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-24 pb-16 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-mesh-hero" />
          <div className="absolute inset-0 bg-grain" />
          <DotGrid className="absolute inset-0 opacity-[0.025]" />
          <ConcentricCircles className="absolute -right-40 top-20 w-[500px] h-[500px] opacity-[0.03]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <motion.div variants={itemVariants} className="flex justify-start mb-8">
                <HeuresysLogo size="xlarge" animated showLoadAnimation />
              </motion.div>

              <motion.p
                variants={itemVariants}
                className="text-lg md:text-xl text-muted-foreground mb-3 font-display"
              >
                Organizational Intelligence &amp; Workforce Orchestration
              </motion.p>

              <motion.h1
                variants={itemVariants}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 font-display leading-[1.1]"
              >
                <span className="text-foreground">Il Layer Mancante</span>
                <br />
                <span className="bg-gradient-to-r from-primary via-[var(--brand-accent)] to-[var(--accent-warm)] bg-clip-text text-transparent">
                  Tra ERP, HR e BI
                </span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-lg text-muted-foreground max-w-xl mb-4 leading-relaxed"
              >
                Dal greco <span className="italic text-primary">εὕρεσις</span> — scoperta. Heuresys
                governa la capability organizzativa come costrutto misurabile: processi, struttura,
                ruoli, competenze e performance in un unico grafo semantico.
              </motion.p>

              <motion.p
                variants={itemVariants}
                className="text-base text-muted-foreground/80 max-w-xl mb-8 leading-relaxed border-l-2 border-primary/30 pl-4 italic"
              >
                &ldquo;SAP manages how the company runs.
                <br />
                Heuresys manages the company&rsquo;s ability to run.&rdquo;
              </motion.p>

              <motion.div
                variants={itemVariants}
                className="flex flex-col sm:flex-row items-start gap-4"
              >
                <Button asChild size="lg" className="text-base px-8 h-12 font-semibold">
                  <Link href="/login">
                    Esplora il Modello <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-base px-8 h-12">
                  <Link href="/login">Richiedi Demo</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Right: Ontology Graph Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: easing.out }}
              className="hidden lg:block"
            >
              <div className="relative aspect-[5/4] max-w-lg mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-[var(--accent-warm)]/10 rounded-3xl border border-border/40 backdrop-blur-sm" />
                <div className="absolute inset-4">
                  <OntologyGraphVisual />
                </div>
                {/* Caption */}
                <div className="absolute -bottom-8 left-0 right-0 text-center">
                  <span className="text-xs text-muted-foreground/60 font-mono tracking-wider">
                    CATENA ONTOLOGICA — 7 LAYER ARCHITECTURE
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-20 text-center lg:text-left"
          >
            <a
              href="#metriche"
              className="inline-flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-xs mb-2">Scopri di più</span>
              <motion.div
                animate={prefersReducedMotion ? {} : { y: [0, 6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ═══════ METRICS ═══════ */}
      <section id="metriche" className="py-20 border-y border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/30" />
        <div className="absolute inset-0 bg-grain opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <MetricCard value="531" suffix="+" label="Tabelle Database" delay={0} />
            <MetricCard value="178" label="Pagine Frontend" delay={0.1} />
            <MetricCard value="150" suffix="+" label="Endpoint API" delay={0.2} />
            <MetricCard value="17.000" suffix="+" label="Entità Knowledge Graph" delay={0.3} />
          </div>
        </div>
      </section>

      {/* ═══════ THE MISSING LAYER — Positioning ═══════ */}
      <section id="architettura" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Layers className="h-4 w-4" />
              Category Creation
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-display">
              Un Nuovo Strato di Intelligenza Organizzativa
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              ERP governa l&rsquo;esecuzione. HR gestisce le persone. BI produce report. Nessuno
              governa la <strong className="text-foreground">capability organizzativa</strong> come
              costrutto integrato. Heuresys colma questo vuoto.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Layers}
              title="Blueprint Generator"
              description="Genera strutture organizzative ottimali per settore e dimensione. Greenfield o overlay sull'esistente. Risultati in millisecondi."
              delay={0}
            />
            <FeatureCard
              icon={Workflow}
              title="Process Governance"
              description="Modella i processi come prima classe ontologica. Collega ogni processo a unità, ruoli e competenze che lo rendono possibile."
              delay={0.05}
            />
            <FeatureCard
              icon={Building2}
              title="Org Design"
              description="Progetta la struttura organizzativa con unità, gerarchie e scope rules. Ogni decisione strutturale si propaga nell'intero grafo."
              delay={0.1}
            />
            <FeatureCard
              icon={Users}
              title="Workforce Intelligence"
              description="Ruoli data-driven collegati a processi e competenze. Gap analysis, pianificazione successioni e orchestrazione del talento."
              delay={0.15}
            />
            <FeatureCard
              icon={Brain}
              title="Skill Graph & ESCO"
              description="14.011 skill e 3.040 occupazioni ESCO con embeddings bilingue. Semantic matching e career bridging alimentati dal Knowledge Graph."
              delay={0.2}
            />
            <FeatureCard
              icon={GitBranch}
              title="Career Intelligence"
              description={`Percorsi calcolati dal grafo semantico. Es: "Da Analista Crediti a Risk Manager" — skill da acquisire, formazione suggerita, tempo stimato.`}
              delay={0.25}
            />
            <FeatureCard
              icon={Target}
              title="Performance & KPI"
              description="Obiettivi e KPI collegati a processi e ruoli. Review cycle, calibration, 360° feedback — ogni valutazione è un atto di governance."
              delay={0.3}
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Enterprise Security"
              description="Multi-tenant con RLS su 260 tabelle, RBP Framework con 8 livelli di ruolo, scope rules e field-level policies."
              delay={0.35}
            />
          </div>
        </div>
      </section>

      <SectionDivider className="max-w-7xl mx-auto px-4" />

      {/* ═══════ THREE DOORS ═══════ */}
      <section id="governance" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-display">
              Tre Prospettive, Un Modello
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Lo stesso grafo organizzativo, tre prospettive specializzate. Ogni stakeholder accede
              alla governance dal proprio punto di vista.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <DoorCard
              icon={Workflow}
              title="Process Owner"
              persona="Direttore Operativo / Process Manager"
              capabilities={[
                'Modellazione e monitoraggio processi di business',
                'Analisi dipendenze processo → ruolo → competenza',
                'KPI di processo e identificazione colli di bottiglia',
                'Simulazione impatto di cambiamenti organizzativi',
              ]}
              delay={0.1}
            />
            <DoorCard
              icon={Users}
              title="HR Director"
              persona="Direttore Risorse Umane / CHRO"
              capabilities={[
                'Talent governance e pianificazione successioni',
                'Skill gap analysis con matching semantico ESCO',
                'Review cycle, calibration e compensation design',
                'Career pathing e Learning & Development',
              ]}
              delay={0.2}
            />
            <DoorCard
              icon={Building2}
              title="Org & Systems"
              persona="Direttore Organizzazione / CIO"
              capabilities={[
                'Design organizzativo e governance strutturale',
                'Classificazione industry NACE/ATECO a 6 livelli',
                'Blueprint organizzativi e import/export',
                'Audit della capability e compliance',
              ]}
              delay={0.3}
            />
          </div>
        </div>
      </section>

      <SectionDivider className="max-w-7xl mx-auto px-4" />

      {/* ═══════ KNOWLEDGE GRAPH ═══════ */}
      <section id="knowledge-graph" className="py-24 relative overflow-hidden">
        <ConcentricCircles className="absolute -left-20 top-1/2 -translate-y-1/2 w-[300px] h-[300px] opacity-[0.03]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: easing.out }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Network className="h-4 w-4" />
                Knowledge Graph ESCO
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 font-display">
                L&rsquo;Intelligenza Semantica al Centro
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Il Knowledge Graph ESCO è il cuore di Heuresys: un grafo semantico di skill,
                occupazioni e relazioni che alimenta ogni decisione — dallo skill gap analysis al
                career bridging, dalla talent discovery alla workforce simulation.
              </p>
              <ul className="space-y-4">
                {[
                  'Embeddings bilingue EN+IT (1.536 dimensioni, text-embedding-3-small)',
                  'Crosswalk ESCO↔NACE: 4.565 link industria-occupazione',
                  'Tassonomia enterprise NACE/ATECO a 6 livelli gerarchici',
                  'Semantic search e similarity scoring in tempo reale',
                ].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 text-muted-foreground"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: easing.out }}
              className="relative"
            >
              <div className="aspect-square max-w-md mx-auto bg-gradient-to-br from-primary/15 via-[var(--brand-accent)]/10 to-[var(--accent-warm)]/15 rounded-3xl p-8 border border-border/40 shadow-raised">
                <div className="h-full w-full flex items-center justify-center">
                  <div className="text-center space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
                      <Network className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <div className="text-5xl font-bold text-foreground font-display">17K</div>
                      <div className="text-muted-foreground mt-1">Entità nel Grafo</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-xl bg-card/80 border border-border/40">
                        <div className="font-bold text-xl font-display">14.011</div>
                        <div className="text-muted-foreground text-xs">Skills ESCO</div>
                      </div>
                      <div className="p-3 rounded-xl bg-card/80 border border-border/40">
                        <div className="font-bold text-xl font-display">3.040</div>
                        <div className="text-muted-foreground text-xs">Occupazioni</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-xl bg-card/80 border border-border/40">
                        <div className="font-bold text-xl font-display">126K</div>
                        <div className="text-muted-foreground text-xs">Relazioni Occ↔Skill</div>
                      </div>
                      <div className="p-3 rounded-xl bg-card/80 border border-border/40">
                        <div className="font-bold text-xl font-display">3.276</div>
                        <div className="text-muted-foreground text-xs">Codici NACE/ATECO</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground/70 font-mono">
                      1.536-dim · text-embedding-3-small · bilingue IT+EN
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionDivider className="max-w-7xl mx-auto px-4" />

      {/* ═══════ ONTOLOGICAL CHAIN EXPLAINER ═══════ */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Boxes className="h-4 w-4" />
              Architettura a 7 Layer
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-display">
              Ogni Decisione Ha una Catena Causale
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              La spina dorsale di Heuresys è una catena ontologica dove ogni entità determina quella
              successiva: i processi definiscono le unità, le unità i ruoli, i ruoli le competenze.
              Cambia un nodo e l&rsquo;intero grafo si adatta.
            </p>
          </motion.div>

          {/* Chain visualization */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center items-center gap-3 md:gap-4 max-w-4xl mx-auto"
          >
            {[
              { label: 'Organization', icon: Building2 },
              { label: 'Process', icon: Workflow },
              { label: 'OrgUnit', icon: Compass },
              { label: 'Role', icon: Users },
              { label: 'Skill', icon: Sparkles },
              { label: 'KPI', icon: BarChart3 },
              { label: 'Assessment', icon: Target },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3 md:gap-4"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-card border border-border/60 flex items-center justify-center hover:border-primary/40 transition-colors">
                    <item.icon className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium font-display">
                    {item.label}
                  </span>
                </div>
                {i < 6 && (
                  <ArrowRight className="h-4 w-4 text-primary/40 shrink-0 hidden sm:block" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-grain opacity-50" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-display">
              Governa la Capability della Tua Organizzazione
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Il layer di intelligenza organizzativa che mancava. Processi, struttura, ruoli,
              competenze e performance — finalmente in un unico grafo semantico.
            </p>
            <Button asChild size="lg" className="text-base px-10 h-12 font-semibold">
              <Link href="/login">
                Inizia Oggi <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border/50 bg-card/30 relative">
        <div className="absolute inset-0 bg-grain opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <HeuresysLogo size="medium" />
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Organizational Intelligence &amp; Workforce Orchestration. Il layer mancante tra
                ERP, HR e BI.
              </p>
            </div>

            {/* Architettura */}
            <div>
              <h4 className="font-semibold text-foreground mb-4 font-display text-sm">
                Architettura
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <a href="#architettura" className="hover:text-foreground transition-colors">
                    Funzionalità
                  </a>
                </li>
                <li>
                  <a href="#governance" className="hover:text-foreground transition-colors">
                    Tre Prospettive
                  </a>
                </li>
                <li>
                  <a href="#knowledge-graph" className="hover:text-foreground transition-colors">
                    Knowledge Graph
                  </a>
                </li>
              </ul>
            </div>

            {/* Risorse */}
            <div>
              <h4 className="font-semibold text-foreground mb-4 font-display text-sm">Risorse</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <span className="hover:text-foreground transition-colors cursor-default">
                    Documentazione API
                  </span>
                </li>
                <li>
                  <span className="hover:text-foreground transition-colors cursor-default">
                    Tassonomia ESCO
                  </span>
                </li>
                <li>
                  <span className="hover:text-foreground transition-colors cursor-default">
                    Classificazione NACE/ATECO
                  </span>
                </li>
                <li>
                  <span className="hover:text-foreground transition-colors cursor-default">
                    Sicurezza &amp; Privacy
                  </span>
                </li>
              </ul>
            </div>

            {/* Contatti */}
            <div>
              <h4 className="font-semibold text-foreground mb-4 font-display text-sm">Contatti</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  info@heuresys.com
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Milano, Italia
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  heuresys.com
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground/70">
              &copy; {new Date().getFullYear()} Heuresys. Tutti i diritti riservati.
            </p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground/70">
              <span>Privacy Policy</span>
              <span>Termini di Servizio</span>
              <span>Cookie Policy</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}
