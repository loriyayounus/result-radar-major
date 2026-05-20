import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2, GraduationCap, CalendarDays, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  addBatch,
  addBranch,
  deleteResults,
  listBranchesAndBatches,
  removeBatch,
  removeBranch,
} from "@/lib/results.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/manage")({
  head: () => ({ meta: [{ title: "Manage — Result Radar" }] }),
  component: ManagePage,
});

function ManagePage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listBranchesAndBatches);
  const addBr = useServerFn(addBranch);
  const rmBr = useServerFn(removeBranch);
  const addBt = useServerFn(addBatch);
  const rmBt = useServerFn(removeBatch);
  const delRes = useServerFn(deleteResults);

  const { data, isLoading } = useQuery({
    queryKey: ["branches-batches"],
    queryFn: () => list(),
    enabled: !!user && role === "admin",
  });

  const [branch, setBranch] = useState({ code: "", name: "" });
  const [batch, setBatch] = useState({ year: "", branch: "" });
  const [del, setDel] = useState({ branch: "", batch_year: "", semester: "" });

  const addBranchM = useMutation({
    mutationFn: () => addBr({ data: { code: branch.code, name: branch.name || undefined } }),
    onSuccess: () => {
      toast.success("Branch added");
      setBranch({ code: "", name: "" });
      qc.invalidateQueries({ queryKey: ["branches-batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBatchM = useMutation({
    mutationFn: () =>
      addBt({ data: { year: Number(batch.year), branch: batch.branch || undefined } }),
    onSuccess: () => {
      toast.success("Batch added");
      setBatch({ year: "", branch: "" });
      qc.invalidateQueries({ queryKey: ["branches-batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delResultsM = useMutation({
    mutationFn: (purgeOnly: typeof del) =>
      delRes({
        data: {
          branch: purgeOnly.branch || undefined,
          batch_year: purgeOnly.batch_year ? Number(purgeOnly.batch_year) : undefined,
          semester: purgeOnly.semester ? Number(purgeOnly.semester) : undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.deleted} result rows`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role && role !== "admin") {
    return (
      <GlassCard className="text-center">
        <h2 className="font-display text-xl font-semibold">Admins only</h2>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Admin</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Manage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add or remove branches and batches, and clean up uploaded result data.
        </p>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Branches */}
        <GlassCard>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground [background-image:var(--gradient-primary)]">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Branches</h3>
              <p className="text-xs text-muted-foreground">Dynamically support any branch.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
            <div className="space-y-1.5">
              <Label htmlFor="br-code">Code</Label>
              <Input
                id="br-code"
                value={branch.code}
                onChange={(e) => setBranch({ ...branch, code: e.target.value })}
                placeholder="IT"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br-name">Name</Label>
              <Input
                id="br-name"
                value={branch.name}
                onChange={(e) => setBranch({ ...branch, name: e.target.value })}
                placeholder="Information Technology"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="hero"
                onClick={() => addBranchM.mutate()}
                disabled={!branch.code || addBranchM.isPending}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          <ul className="mt-5 divide-y divide-border/50">
            {isLoading && <li className="py-3 text-sm text-muted-foreground">Loading…</li>}
            {data?.branches.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">No branches yet.</li>
            )}
            {data?.branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{b.code}</p>
                  <p className="text-xs text-muted-foreground">{b.name ?? "—"}</p>
                </div>
                <PurgeDelete
                  label={`Delete branch ${b.code}`}
                  description={`This removes the branch entry. You can also delete all result rows tagged with branch ${b.code}.`}
                  onConfirm={async (purge) => {
                    await rmBr({ data: { id: b.id, purgeResults: purge } });
                    toast.success("Branch removed");
                    qc.invalidateQueries();
                  }}
                />
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Batches */}
        <GlassCard>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground [background-image:var(--gradient-primary)]">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Batches</h3>
              <p className="text-xs text-muted-foreground">Future-proof: add any year.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
            <div className="space-y-1.5">
              <Label htmlFor="bt-year">Year</Label>
              <Input
                id="bt-year"
                type="number"
                value={batch.year}
                onChange={(e) => setBatch({ ...batch, year: e.target.value })}
                placeholder="2024"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt-branch">Branch (optional)</Label>
              <Input
                id="bt-branch"
                value={batch.branch}
                onChange={(e) => setBatch({ ...batch, branch: e.target.value })}
                placeholder="IT"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="hero"
                onClick={() => addBatchM.mutate()}
                disabled={!batch.year || addBatchM.isPending}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          <ul className="mt-5 divide-y divide-border/50">
            {data?.batches.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">No batches yet.</li>
            )}
            {data?.batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{b.year}</p>
                  <p className="text-xs text-muted-foreground">{b.branch ?? "All branches"}</p>
                </div>
                <PurgeDelete
                  label={`Delete batch ${b.year}${b.branch ? " · " + b.branch : ""}`}
                  description="Removes the batch entry. Optionally also delete all result rows for this batch."
                  onConfirm={async (purge) => {
                    await rmBt({ data: { id: b.id, purgeResults: purge } });
                    toast.success("Batch removed");
                    qc.invalidateQueries();
                  }}
                />
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* Delete uploaded results */}
      <GlassCard className="border-destructive/30">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold">Delete uploaded results</h3>
            <p className="text-xs text-muted-foreground">
              Remove a previously ingested CSV/PDF batch. Provide at least one filter.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Input value={del.branch} onChange={(e) => setDel({ ...del, branch: e.target.value })} placeholder="IT" />
          </div>
          <div className="space-y-1.5">
            <Label>Batch year</Label>
            <Input
              type="number"
              value={del.batch_year}
              onChange={(e) => setDel({ ...del, batch_year: e.target.value })}
              placeholder="2024"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Input
              type="number"
              value={del.semester}
              onChange={(e) => setDel({ ...del, semester: e.target.value })}
              placeholder="1"
            />
          </div>
          <div className="flex items-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={!del.branch && !del.batch_year && !del.semester}>
                  <Trash2 className="h-4 w-4" /> Delete results
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete result rows?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes all result rows matching the selected filters. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => delResultsM.mutate(del)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function PurgeDelete({
  label,
  description,
  onConfirm,
}: {
  label: string;
  description: string;
  onConfirm: (purge: boolean) => Promise<void>;
}) {
  const [purge, setPurge] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={purge} onCheckedChange={(v) => setPurge(!!v)} />
          Also delete associated result rows
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(purge)}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
