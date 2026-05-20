import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { searchBySubject } from "@/lib/results.functions";
import { GlassCard } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/subject")({
  head: () => ({ meta: [{ title: "Subject Search — Result Radar" }] }),
  component: SubjectPage,
});

function SubjectPage() {
  const { role } = useAuth();
  const fn = useServerFn(searchBySubject);
  const [code, setCode] = useState("");
  const [sem, setSem] = useState("");
  const [branch, setBranch] = useState("");
  const [batchYear, setBatchYear] = useState("");
  const m = useMutation({
    mutationFn: () => fn({
      data: {
        subject_code: code.trim().toUpperCase(),
        semester: sem ? Number(sem) : undefined,
        branch: branch.trim() || undefined,
        batch_year: batchYear ? Number(batchYear) : undefined,
      },
    }),
  });

  if (role && role !== "admin") return null;
  const rows = m.data?.rows ?? [];
  const avg = rows.length ? +(rows.reduce((a, r) => a + (r.marks ? Number(r.marks) : 0), 0) / rows.length).toFixed(2) : 0;
  const passed = rows.filter((r) => r.status === "pass").length;
  const failed = rows.filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Subject Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find every student for a subject code (TH1, PR2, CS201…).</p>
      </div>

      <GlassCard>
        <form
          onSubmit={(e) => { e.preventDefault(); if (code.trim()) m.mutate(); }}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_120px_120px_140px_auto]"
        >
          <div className="space-y-1.5">
            <Label>Subject code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TH1" required />
          </div>
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Input type="number" value={sem} onChange={(e) => setSem(e.target.value)} placeholder="All" />
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="IT" />
          </div>
          <div className="space-y-1.5">
            <Label>Batch year</Label>
            <Input type="number" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="2023" />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="hero" className="w-full" disabled={m.isPending}>
              <Search className="h-4 w-4" /> {m.isPending ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
      </GlassCard>

      {m.data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Students" value={rows.length} />
            <Stat label="Average" value={`${avg}`} />
            <Stat label="Pass / Fail" value={`${passed} / ${failed}`} />
          </div>

          <GlassCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">Reg No</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Branch</th>
                    <th className="py-2 pr-4">Batch</th>
                    <th className="py-2 pr-4">Sem</th>
                    <th className="py-2 pr-4">Marks</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-medium">{r.registration_no}</td>
                      <td className="py-2 pr-4">{r.student_name ?? "—"}</td>
                      <td className="py-2 pr-4">{(r as any).branch ?? "—"}</td>
                      <td className="py-2 pr-4">{(r as any).batch_year ?? "—"}</td>
                      <td className="py-2 pr-4">{r.semester}</td>
                      <td className="py-2 pr-4">{r.marks ?? "—"} / {r.max_marks ?? 100}</td>
                      <td className="py-2 pr-4 capitalize">{r.status}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No results found for this subject.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassCard className="!p-5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </GlassCard>
  );
}
