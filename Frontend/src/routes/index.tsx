import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Radar,
  Upload,
  BarChart3,
  ShieldCheck,
  GraduationCap,
  PieChart,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass-card";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Result Radar — Smart Student Result Management" },
      { name: "description", content: "Bulk-upload PDFs/CSVs, visualize batch performance, and give students secure access to their results." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Upload, title: "Bulk Upload", desc: "Drop CSVs or PDFs and we extract subjects, marks and statuses automatically." },
  { icon: BarChart3, title: "Live Analytics", desc: "Pass/fail/backlog KPIs, subject averages, and semester comparisons." },
  { icon: PieChart, title: "Batch Insights", desc: "View an entire batch like an official sheet with semester-wise grouping." },
  { icon: ShieldCheck, title: "Role-based Access", desc: "Admins manage results. Students see only their own — protected by RLS." },
  { icon: GraduationCap, title: "Student Portal", desc: "Students log in to view marks across every semester at a glance." },
  { icon: FileSpreadsheet, title: "Subject Search", desc: "Filter by subject code (TH1, PR2…) to compare student performance." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="container mx-auto grid gap-16 px-4 py-20 md:grid-cols-2 md:py-32">
          <div className="flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Academic intelligence, beautifully visualized
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 font-display text-5xl font-bold leading-[1.05] md:text-6xl"
            >
              The result radar for{" "}
              <span className="text-gradient">modern colleges</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-5 max-w-xl text-lg text-muted-foreground"
            >
              Upload result PDFs and CSVs. Auto-detect semesters and subjects. Track pass, fail and backlog KPIs across an entire batch — and give students a private portal to their academic history.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Button asChild variant="hero" size="lg">
                <Link to="/signup">Create an account</Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link to="/login">Sign in</Link>
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="glass relative rounded-3xl p-6 glow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Batch overview</p>
                  <h3 className="font-display text-2xl font-semibold">CSE • 2024</h3>
                </div>
                <Radar className="h-8 w-8 text-primary" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { l: "Total", v: "184", c: "from-primary to-primary-glow" },
                  { l: "Passed", v: "162", c: "from-[oklch(0.65_0.17_155)] to-[oklch(0.78_0.18_155)]" },
                  { l: "Backlog", v: "22", c: "from-[oklch(0.78_0.18_75)] to-[oklch(0.85_0.18_75)]" },
                ].map((k) => (
                  <div key={k.l} className={`rounded-2xl bg-gradient-to-br ${k.c} p-4 text-primary-foreground`}>
                    <p className="text-[11px] uppercase tracking-wider opacity-90">{k.l}</p>
                    <p className="font-display text-3xl font-bold">{k.v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { s: "TH1", v: 78 },
                  { s: "TH2", v: 64 },
                  { s: "PR1", v: 86 },
                  { s: "PR2", v: 72 },
                ].map((row, i) => (
                  <motion.div
                    key={row.s}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-xs font-medium text-muted-foreground">{row.s}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full [background-image:var(--gradient-primary)]"
                          style={{ width: `${row.v}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-medium">{row.v}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="absolute -inset-10 -z-10 rounded-[40px] bg-hero opacity-30 blur-3xl" />
          </motion.div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold">Everything you need to manage results</h2>
          <p className="mt-3 text-muted-foreground">From bulk ingestion to batch-level analytics, in one focused workspace.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <GlassCard key={f.title} delay={i * 0.05}>
              <div className="grid h-11 w-11 place-items-center rounded-xl text-primary-foreground [background-image:var(--gradient-primary)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <GlassCard className="flex flex-col items-center justify-between gap-6 md:flex-row md:p-10">
          <div>
            <h3 className="font-display text-2xl font-semibold">Ready to scan your batch?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sign up as an admin to upload results, or as a student to view your scores.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="hero">
              <Link to="/signup">Get started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </GlassCard>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Built with care · Result Radar © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
