import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Filter } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { allStudentsBySemester } from "@/lib/results.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/all")({
  head: () => ({ meta: [{ title: "All Students — Result Radar" }] }),
  component: AllStudentsPage,
});

/** Renders the raw result string with appropriate colour coding. */
function ResultBadge({ text }: { text: string }) {
  const lower = text.toLowerCase();
  const isPass = /^pass/.test(lower) && !lower.includes("back");
  const isFail = /^fail/.test(lower) && !lower.includes("cleared");
  const isAllCleared =
    lower.includes("all cleared") ||
    (lower.includes("fail") && lower.includes("cleared"));
  const isPartialBacklog =
    lower.includes("back") && !lower.includes("all cleared");

  // Split into the main part and the parenthetical note
  const parenIdx = text.indexOf("(");
  const main = parenIdx >= 0 ? text.slice(0, parenIdx).trim() : text;
  const note = parenIdx >= 0 ? text.slice(parenIdx) : "";

  const baseClass = "rounded-md px-2 py-0.5 text-[10px] font-medium";

  if (isPass)
    return (
      <span className={`${baseClass} bg-emerald-500/15 text-emerald-600 dark:text-emerald-300`}>
        {text}
      </span>
    );
  if (isFail)
    return (
      <span className={`${baseClass} bg-destructive/15 text-destructive`}>
        {text}
      </span>
    );
  if (isAllCleared)
    return (
      <span className={`${baseClass} bg-amber-500/15 text-amber-600 dark:text-amber-300`}>
        {main}{" "}
        {note && <span className="opacity-80">{note}</span>}
      </span>
    );
  // Still-pending backlog (partial or full)
  return (
    <span className={`${baseClass} bg-orange-500/15 text-orange-600 dark:text-orange-300`} title={text}>
      {main}
      {note && (
        <span className="ml-1 text-[9px] opacity-70">{note}</span>
      )}
    </span>
  );
}

function AllStudentsPage() {
  const { user, role } = useAuth();
  const fn = useServerFn(allStudentsBySemester);
  const [filters, setFilters] = useState({ branch: "", batch_year: "" });
  const [applied, setApplied] = useState(filters);

  const { data, isLoading } = useQuery({
    queryKey: ["all-students", applied],
    queryFn: () =>
      fn({
        data: {
          branch: applied.branch || undefined,
          batch_year: applied.batch_year ? Number(applied.batch_year) : undefined,
        },
      }),
    enabled: !!user && role === "admin",
  });

  if (role && role !== "admin") return null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Admin</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">All students · semester-wise</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Like an official college result sheet — every student, every semester.
        </p>
      </motion.div>

      <GlassCard>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Input value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} placeholder="IT" />
          </div>
          <div className="space-y-1.5">
            <Label>Batch year</Label>
            <Input
              type="number"
              value={filters.batch_year}
              onChange={(e) => setFilters({ ...filters, batch_year: e.target.value })}
              placeholder="2024"
            />
          </div>
          <div className="flex items-end">
            <Button variant="hero" className="w-full" onClick={() => setApplied(filters)}>
              <Filter className="h-4 w-4" /> Apply
            </Button>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : (data?.semesters ?? []).length === 0 ? (
        <GlassCard className="text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6" />
          No results found for these filters.
        </GlassCard>
      ) : (
        data?.semesters.map((s, i) => (
          <GlassCard key={s.semester} delay={i * 0.04}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Semester {s.semester}</h3>
              <span className="text-xs text-muted-foreground">{s.students.length} students</span>
            </div>
            <div className="mt-3 max-h-[460px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background/90 backdrop-blur">
                  <tr className="border-b border-border/60 text-left uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">Reg</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Subjects</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                    <th className="py-2 pr-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {s.students.map((st) => (
                    <tr key={st.registration_no} className="border-b border-border/30 last:border-0 align-top">
                      <td className="py-2 pr-3 font-medium">{st.registration_no}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{st.student_name ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          {st.subjects.map((sub, j) => (
                            <span
                              key={j}
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] ${
                                sub.cleared
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                                  : sub.status === "fail"
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : sub.status === "backlog"
                                  ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                                  : "border-border/60 bg-muted/40"
                              }`}
                              title={sub.cleared ? "Backlog cleared" : sub.status}
                            >
                              {sub.code} · {sub.marks ?? "—"}/{sub.max}
                              {sub.cleared && " · cleared"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {st.total}/{st.maxTotal || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {st.result_text ? (
                          <ResultBadge text={st.result_text} />
                        ) : (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] capitalize ${
                              st.status === "pass"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                : st.status === "fail"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-orange-500/15 text-orange-600 dark:text-orange-300"
                            }`}
                          >
                            {st.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}
