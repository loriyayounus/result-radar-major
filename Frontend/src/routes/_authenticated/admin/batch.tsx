import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { batchView } from "@/lib/results.functions";
import { GlassCard } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/batch")({
  head: () => ({ meta: [{ title: "Batch Viewer — Result Radar" }] }),
  component: BatchPage,
});

function BatchPage() {
  const { user, role } = useAuth();
  const fn = useServerFn(batchView);
  const [filters, setFilters] = useState<{ branch: string; batch_year: string; semester: string }>({ branch: "", batch_year: "", semester: "" });
  const [applied, setApplied] = useState(filters);

  const { data, isLoading } = useQuery({
    queryKey: ["batch", applied],
    queryFn: () =>
      fn({
        data: {
          branch: applied.branch || undefined,
          batch_year: applied.batch_year ? Number(applied.batch_year) : undefined,
          semester: applied.semester ? Number(applied.semester) : undefined,
        },
      }),
    enabled: !!user && role === "admin",
  });

  if (role && role !== "admin") return null;

  const rows = data?.rows ?? [];
  // Group by student + semester
  const grouped = new Map<string, Map<number, typeof rows>>();
  for (const r of rows) {
    const studentKey = `${r.registration_no}__${r.student_name ?? ""}`;
    const sm = grouped.get(studentKey) ?? new Map();
    const list = sm.get(r.semester) ?? [];
    list.push(r);
    sm.set(r.semester, list);
    grouped.set(studentKey, sm);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Batch Viewer</h1>
        <p className="mt-1 text-sm text-muted-foreground">All semester results for an entire batch — like an official sheet.</p>
      </div>

      <GlassCard>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Input value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} placeholder="CSE" />
          </div>
          <div className="space-y-1.5">
            <Label>Batch year</Label>
            <Input type="number" value={filters.batch_year} onChange={(e) => setFilters({ ...filters, batch_year: e.target.value })} placeholder="2024" />
          </div>
          <div className="space-y-1.5">
            <Label>Semester (optional)</Label>
            <Input type="number" value={filters.semester} onChange={(e) => setFilters({ ...filters, semester: e.target.value })} placeholder="All" />
          </div>
          <div className="flex items-end">
            <Button variant="hero" className="w-full" onClick={() => setApplied(filters)}>Apply filters</Button>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : grouped.size === 0 ? (
        <GlassCard className="text-center text-sm text-muted-foreground">No results found.</GlassCard>
      ) : (
        Array.from(grouped.entries()).map(([key, semMap], i) => {
          const [reg, name] = key.split("__");
          return (
            <GlassCard key={key} delay={i * 0.02}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{reg}</p>
                  <h3 className="font-display text-lg font-semibold">{name || "—"}</h3>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Array.from(semMap.entries()).sort(([a], [b]) => a - b).map(([sem, list]) => (
                  <div key={sem} className="rounded-xl border border-border/60 p-3">
                    <h4 className="mb-2 text-sm font-semibold">Semester {sem}</h4>
                    <table className="w-full text-xs">
                      <tbody>
                        {list.map((r) => (
                          <tr key={r.id} className="border-b border-border/30 last:border-0">
                            <td className="py-1 pr-2 font-medium">{r.subject_code}</td>
                            <td className="py-1 pr-2 text-muted-foreground">{r.subject_name ?? ""}</td>
                            <td className="py-1 pr-2 text-right">{r.marks ?? "—"}/{r.max_marks ?? 100}</td>
                            <td className="py-1 capitalize">{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </GlassCard>
          );
        })
      )}
    </div>
  );
}
