import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { Users, CheckCircle2, XCircle, AlertTriangle, Upload, Search, Settings, Layers } from "lucide-react";
import { getDashboardStats, listStudents } from "@/lib/results.functions";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Result Radar" }] }),
  component: AdminDashboard,
});

const COLORS = ["oklch(0.65 0.17 155)", "oklch(0.6 0.23 18)", "oklch(0.78 0.18 75)"];

function AdminDashboard() {
  const { user, role } = useAuth();
  const fetchStats = useServerFn(getDashboardStats);
  const fetchStudents = useServerFn(listStudents);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
    enabled: !!user && role === "admin",
  });

  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "backlog" | null>(null);
  const studentsQ = useQuery({
    queryKey: ["admin-students", filter],
    queryFn: () => fetchStudents({ data: { filter: filter! } }),
    enabled: !!user && role === "admin" && !!filter,
  });

  if (role && role !== "admin") {
    return (
      <GlassCard className="text-center">
        <h2 className="font-display text-xl font-semibold">Admins only</h2>
        <p className="mt-1 text-sm text-muted-foreground">This area is for administrators.</p>
        <Button asChild variant="hero" className="mt-4">
          <Link to="/student">Go to my results</Link>
        </Button>
      </GlassCard>
    );
  }

  const pie = [
    { name: "Pass", value: data?.pass ?? 0 },
    { name: "Fail", value: data?.fail ?? 0 },
    { name: "Backlog", value: data?.backlog ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Admin</p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">A live snapshot of every result on the platform.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="hero">
            <Link to="/admin/upload"><Upload className="h-4 w-4" /> Upload results</Link>
          </Button>
          <Button asChild variant="glass">
            <Link to="/admin/all"><Layers className="h-4 w-4" /> All students</Link>
          </Button>
          <Button asChild variant="glass">
            <Link to="/admin/subject"><Search className="h-4 w-4" /> Subject search</Link>
          </Button>
          <Button asChild variant="glass">
            <Link to="/admin/manage"><Settings className="h-4 w-4" /> Manage</Link>
          </Button>
        </div>
      </motion.div>

      {error && (
        <GlassCard className="border-destructive/40 bg-destructive/10 text-destructive">
          {(error as Error).message}
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <KPICard label="Total Students" value={data?.total ?? 0} icon={<Users className="h-5 w-5" />} grad="from-primary to-primary-glow" onClick={() => setFilter("all")} loading={isLoading} />
        <KPICard label="Passed" value={data?.pass ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} grad="from-[oklch(0.65_0.17_155)] to-[oklch(0.78_0.18_155)]" onClick={() => setFilter("pass")} loading={isLoading} />
        <KPICard label="Failed" value={data?.fail ?? 0} icon={<XCircle className="h-5 w-5" />} grad="from-[oklch(0.6_0.23_18)] to-[oklch(0.7_0.21_22)]" onClick={() => setFilter("fail")} loading={isLoading} />
        <KPICard label="Backlog" value={data?.backlog ?? 0} icon={<AlertTriangle className="h-5 w-5" />} grad="from-[oklch(0.78_0.18_75)] to-[oklch(0.85_0.18_75)]" onClick={() => setFilter("backlog")} loading={isLoading} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <h3 className="font-display text-lg font-semibold">Pass · Fail · Backlog</h3>
          <p className="text-xs text-muted-foreground">Distribution across all students</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {pie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-popover)" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg font-semibold">Performance Overview</h3>
          <p className="text-xs text-muted-foreground">Student counts by status</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={[
                { k: "Total", v: data?.total ?? 0 },
                { k: "Pass", v: data?.pass ?? 0 },
                { k: "Fail", v: data?.fail ?? 0 },
                { k: "Backlog", v: data?.backlog ?? 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="k" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-popover)" }} />
                <Bar dataKey="v" radius={[8, 8, 0, 0]} fill="oklch(0.65 0.22 295)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg font-semibold">Subject-wise Average</h3>
          <p className="text-xs text-muted-foreground">Average % across subjects</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={data?.subjectAvg ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="code" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-popover)" }} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]} fill="oklch(0.78 0.16 305)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg font-semibold">Semester Trend</h3>
          <p className="text-xs text-muted-foreground">Average % per semester</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <LineChart data={data?.semesterAvg ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="semester" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-popover)" }} />
                <Line type="monotone" dataKey="avg" stroke="oklch(0.55 0.22 295)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <Dialog open={!!filter} onOpenChange={(o) => !o && setFilter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{filter} students</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {studentsQ.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (studentsQ.data?.students ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No students match this filter.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">Reg No</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Branch</th>
                    <th className="py-2 pr-4">Batch</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsQ.data?.students.map((s) => (
                    <tr key={s.registration_no} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-medium">{s.registration_no}</td>
                      <td className="py-2 pr-4">{s.student_name ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.branch ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.batch_year ?? "—"}</td>
                      <td className="py-2 pr-4 capitalize">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon,
  grad,
  onClick,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  grad: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass rounded-2xl p-5 text-left transition-shadow hover:shadow-[var(--shadow-glow)]"
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${grad} text-primary-foreground`}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold">{loading ? "…" : value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Click to view list</p>
    </motion.button>
  );
}
