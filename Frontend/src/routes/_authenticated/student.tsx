import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getMyResults } from "@/lib/results.functions";
import { GlassCard } from "@/components/glass-card";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({ meta: [{ title: "My Results — Result Radar" }] }),
  component: StudentPage,
});

function StudentPage() {
  const { profile, user } = useAuth();
  const fetchMine = useServerFn(getMyResults);
  const { data, isLoading } = useQuery({
    queryKey: ["my-results", user?.id],
    queryFn: () => fetchMine(),
    enabled: !!user,
  });

  const rows = data?.rows ?? [];
  const semesters = Array.from(new Set(rows.map((r) => r.semester))).sort((a, b) => a - b);

  const stats = (() => {
    const total = rows.length;
    const passed = rows.filter((r) => r.status === "pass").length;
    const failed = rows.filter((r) => r.status === "fail").length;
    const backlog = rows.filter((r) => r.status === "backlog").length;
    const sumPct = rows.reduce((acc, r) => acc + (r.marks ? (Number(r.marks) / Number(r.max_marks ?? 100)) * 100 : 0), 0);
    const avg = rows.length ? +(sumPct / rows.length).toFixed(2) : 0;
    return { total, passed, failed, backlog, avg };
  })();

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">{profile?.full_name ?? "Student"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.registration_no ? `Reg No • ${profile.registration_no}` : "Registration number missing — update your profile."}
          {profile?.branch && ` · ${profile.branch}`}
          {profile?.batch_year && ` · Batch ${profile.batch_year}`}
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPI label="Subjects" value={stats.total} icon={<BookOpen className="h-5 w-5" />} />
        <KPI label="Passed" value={stats.passed} tone="success" />
        <KPI label="Backlog" value={stats.backlog} tone="warning" />
        <KPI label="Average" value={`${stats.avg}%`} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground">Loading your results…</div>
      ) : rows.length === 0 ? (
        <GlassCard className="text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-3 font-display text-lg font-semibold">No results yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Once your administrator uploads results matching{" "}
            <span className="font-medium text-foreground">{profile?.registration_no ?? "your reg no"}</span>, they'll appear here.
          </p>
        </GlassCard>
      ) : (
        semesters.map((sem, i) => {
          const subj = rows.filter((r) => r.semester === sem);
          return (
            <GlassCard key={sem} delay={i * 0.05}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">Semester {sem}</h3>
                <span className="text-xs text-muted-foreground">{subj.length} subjects</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Marks</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subj.map((r) => (
                      <tr key={r.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{r.subject_code}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{r.subject_name ?? "—"}</td>
                        <td className="py-2.5 pr-4">
                          {r.marks ?? "—"} <span className="text-muted-foreground">/ {r.max_marks ?? 100}</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          );
        })
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "success" | "warning";
}) {
  const grad =
    tone === "success"
      ? "from-[oklch(0.65_0.17_155)] to-[oklch(0.78_0.18_155)]"
      : tone === "warning"
        ? "from-[oklch(0.78_0.18_75)] to-[oklch(0.85_0.18_75)]"
        : "from-primary to-primary-glow";
  return (
    <GlassCard className="!p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${grad} text-primary-foreground`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </GlassCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pass: "bg-[oklch(0.95_0.06_155)] text-[oklch(0.35_0.13_155)] dark:bg-[oklch(0.3_0.1_155)] dark:text-[oklch(0.85_0.15_155)]",
    fail: "bg-[oklch(0.95_0.06_18)] text-[oklch(0.4_0.18_18)] dark:bg-[oklch(0.3_0.12_18)] dark:text-[oklch(0.85_0.15_18)]",
    backlog: "bg-[oklch(0.95_0.06_75)] text-[oklch(0.4_0.15_75)] dark:bg-[oklch(0.3_0.12_75)] dark:text-[oklch(0.85_0.15_75)]",
  };
  return <Badge className={`${map[status] ?? ""} border-0 capitalize`}>{status}</Badge>;
}
