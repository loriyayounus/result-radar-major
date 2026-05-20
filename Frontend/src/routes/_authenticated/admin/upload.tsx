import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { extractText, getDocumentProxy } from "unpdf";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Upload, FileText, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ingestResults } from "@/lib/results.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/upload")({
  head: () => ({ meta: [{ title: "Upload Results — Result Radar" }] }),
  component: UploadPage,
});

type Row = {
  registration_no: string;
  student_name?: string | null;
  branch?: string | null;
  batch_year?: number | null;
  semester: number;
  subject_code: string;
  subject_name?: string | null;
  marks?: number | null;
  max_marks: number;
  status: "pass" | "fail" | "backlog";
  // result_text is encoded into subject_name as "RESULT:<text>" — no extra DB column needed
};

// ---------- Result-text helpers --------------------------------------------

/**
 * Parse the CSV Result column (e.g. "Back-TH2, TH3, TH4AB (All Cleared)")
 * and return which subject codes are currently-backlog vs cleared-backlog.
 *
 * Returns:
 *   backlogCodes  — subjects that are still pending (backlog, not yet cleared)
 *   clearedCodes  — subjects that were backlog but are now cleared
 *   isFail        — true when the result says "fail"
 *   isPass        — true when result is a plain pass (no backlogs at all)
 */
function parseResultText(resultText: string | null | undefined): {
  backlogCodes: Set<string>;
  clearedCodes: Set<string>;
  isFail: boolean;
  isPass: boolean;
} {
  const empty = { backlogCodes: new Set<string>(), clearedCodes: new Set<string>(), isFail: false, isPass: false };
  if (!resultText) return empty;

  const t = resultText.trim();
  const lower = t.toLowerCase();

  // Plain pass — no backlogs
  if (/^pass/.test(lower) && !lower.includes("back")) {
    return { ...empty, isPass: true };
  }

  // Fail (may also say "now all cleared")
  if (/^fail/.test(lower)) {
    // "fail (Now All Cleared)" — treat as cleared fail
    const allCleared = lower.includes("all cleared") || lower.includes("now cleared");
    return { ...empty, isFail: !allCleared, isPass: allCleared };
  }

  // Back-... style
  // Extract the list of codes that come after "Back-" and before the parenthetical
  const withoutParen = t.replace(/\(.*?\)/g, "");
  // Normalise separators: "Back-TH1,TH2, TH3" -> codes after "Back"
  const backMatch = withoutParen.match(/back[-\s]*([\w\s,\-]+)/i);
  const allCodes: string[] = [];
  if (backMatch) {
    const raw = backMatch[1];
    // Split on commas, spaces, hyphens between codes
    allCodes.push(
      ...raw
        .split(/[\s,]+/)
        .map((s) => s.replace(/^[-]+|[-]+$/g, "").toUpperCase().trim())
        .filter((s) => /^[A-Z0-9]{2,}$/.test(s))
    );
  }

  // Figure out which codes are cleared vs still pending
  // Patterns: "(All Cleared)" -> all cleared; "(Now Cleared: TH2, TH4AB)" -> listed ones cleared
  const parenMatch = t.match(/\(([^)]+)\)/);
  const clearedCodes = new Set<string>();
  const backlogCodes = new Set<string>();

  if (parenMatch) {
    const inner = parenMatch[1].toLowerCase();
    if (inner.includes("all cleared")) {
      // Every listed code is cleared
      allCodes.forEach((c) => clearedCodes.add(c));
    } else {
      // "Now Cleared: TH2, TH4AB" — extract cleared list
      const nowMatch = parenMatch[1].match(/(?:now\s+cleared[:\s]+)([\w\s,\-]+)/i);
      if (nowMatch) {
        nowMatch[1]
          .split(/[\s,]+/)
          .map((s) => s.replace(/^[-]+|[-]+$/g, "").toUpperCase().trim())
          .filter((s) => /^[A-Z0-9]{2,}$/.test(s))
          .forEach((c) => clearedCodes.add(c));
      }
      // Remaining codes are still pending
      allCodes.forEach((c) => { if (!clearedCodes.has(c)) backlogCodes.add(c); });
    }
  } else {
    // No parenthetical — all listed codes are still pending
    allCodes.forEach((c) => backlogCodes.add(c));
  }

  return { backlogCodes, clearedCodes, isFail: false, isPass: false };
}

/**
 * Given a per-subject result derived by parseResultText, determine
 * that subject row's status and cleared_backlog flag.
 */
function subjectStatusFromResult(
  subjectCode: string,
  parsed: ReturnType<typeof parseResultText>,
  marksBasedStatus: Row["status"],
): { status: Row["status"]; cleared: boolean } {
  const code = subjectCode.toUpperCase();
  if (parsed.clearedCodes.has(code)) return { status: "pass", cleared: true };
  if (parsed.backlogCodes.has(code)) return { status: "backlog", cleared: false };
  if (parsed.isFail) return { status: "fail", cleared: false };
  // Fall back to marks-derived status
  return { status: marksBasedStatus, cleared: false };
}

// ---------- Subject config per semester ------------------------------------
// max_marks and pass_marks keyed by `${semester}|${SUBJECT_CODE}`.
// Matches the subject_config table in Supabase.
type SubjectCfg = { max: number; pass: number };

const SUBJECT_CONFIG: Record<string, SubjectCfg> = (() => {
  const cfg: Array<{ sem: number; code: string; max: number; pass: number }> = [
    // SEM 1
    { sem: 1, code: "TH1",       max: 80,  pass: 27 },
    { sem: 1, code: "TH1IA",     max: 20,  pass: 7  },
    { sem: 1, code: "TH2",       max: 80,  pass: 27 },
    { sem: 1, code: "TH2IA",     max: 20,  pass: 7  },
    { sem: 1, code: "TH3",       max: 80,  pass: 27 },
    { sem: 1, code: "TH3IA",     max: 20,  pass: 7  },
    { sem: 1, code: "TH4AB",     max: 80,  pass: 27 },
    { sem: 1, code: "TH4ABIA",   max: 20,  pass: 7  },
    { sem: 1, code: "PR2",       max: 50,  pass: 25 },
    { sem: 1, code: "PR3",       max: 100, pass: 50 },
    { sem: 1, code: "SESSIONAL", max: 200, pass: 100},
    { sem: 1, code: "TOTAL",     max: 750, pass: 375},
    // SEM 2
    { sem: 2, code: "TH1",       max: 80,  pass: 27 },
    { sem: 2, code: "TH1IA",     max: 20,  pass: 7  },
    { sem: 2, code: "TH2",       max: 80,  pass: 27 },
    { sem: 2, code: "TH2IA",     max: 20,  pass: 7  },
    { sem: 2, code: "TH3",       max: 80,  pass: 27 },
    { sem: 2, code: "TH3IA",     max: 20,  pass: 7  },
    { sem: 2, code: "TH4",       max: 80,  pass: 27 },
    { sem: 2, code: "TH4IA",     max: 20,  pass: 7  },
    { sem: 2, code: "PR2",       max: 50,  pass: 25 },
    { sem: 2, code: "PR3",       max: 100, pass: 50 },
    { sem: 2, code: "SESSIONAL", max: 200, pass: 100},
    { sem: 2, code: "TOTAL",     max: 750, pass: 375},
    // SEM 3
    { sem: 3, code: "TH1",       max: 80,  pass: 27 },
    { sem: 3, code: "TH1IA",     max: 20,  pass: 7  },
    { sem: 3, code: "TH2",       max: 80,  pass: 27 },
    { sem: 3, code: "TH2IA",     max: 20,  pass: 7  },
    { sem: 3, code: "TH3",       max: 80,  pass: 27 },
    { sem: 3, code: "TH3IA",     max: 20,  pass: 7  },
    { sem: 3, code: "TH4",       max: 80,  pass: 27 },
    { sem: 3, code: "TH4IA",     max: 20,  pass: 7  },
    { sem: 3, code: "TH5",       max: 80,  pass: 27 },
    { sem: 3, code: "TH5IA",     max: 20,  pass: 7  },
    { sem: 3, code: "PR1",       max: 50,  pass: 25 },
    { sem: 3, code: "PR2",       max: 50,  pass: 25 },
    { sem: 3, code: "PR3",       max: 25,  pass: 13 },
    { sem: 3, code: "PR4",       max: 25,  pass: 13 },
    { sem: 3, code: "SESSIONAL", max: 100, pass: 50 },
    { sem: 3, code: "TOTAL",     max: 750, pass: 375},
    // SEM 4
    { sem: 4, code: "TH1",       max: 80,  pass: 27 },
    { sem: 4, code: "TH1IA",     max: 20,  pass: 7  },
    { sem: 4, code: "TH2",       max: 80,  pass: 27 },
    { sem: 4, code: "TH2IA",     max: 20,  pass: 7  },
    { sem: 4, code: "TH3",       max: 80,  pass: 27 },
    { sem: 4, code: "TH3IA",     max: 20,  pass: 7  },
    { sem: 4, code: "TH4",       max: 80,  pass: 27 },
    { sem: 4, code: "TH4IA",     max: 20,  pass: 7  },
    { sem: 4, code: "PR1",       max: 25,  pass: 13 },
    { sem: 4, code: "PR2",       max: 50,  pass: 25 },
    { sem: 4, code: "PR3",       max: 25,  pass: 13 },
    { sem: 4, code: "PR4",       max: 50,  pass: 25 },
    { sem: 4, code: "SESSIONAL", max: 200, pass: 100},
    { sem: 4, code: "TOTAL",     max: 750, pass: 375},
    // SEM 5
    { sem: 5, code: "TH1",       max: 80,  pass: 27 },
    { sem: 5, code: "TH1IA",     max: 20,  pass: 7  },
    { sem: 5, code: "TH2",       max: 80,  pass: 27 },
    { sem: 5, code: "TH2IA",     max: 20,  pass: 7  },
    { sem: 5, code: "TH3",       max: 80,  pass: 27 },
    { sem: 5, code: "TH3IA",     max: 20,  pass: 7  },
    { sem: 5, code: "TH4",       max: 80,  pass: 27 },
    { sem: 5, code: "TH4IA",     max: 20,  pass: 7  },
    { sem: 5, code: "TH5",       max: 80,  pass: 27 },
    { sem: 5, code: "TH5IA",     max: 20,  pass: 7  },
    { sem: 5, code: "PR1",       max: 50,  pass: 25 },
    { sem: 5, code: "PR2",       max: 50,  pass: 25 },
    { sem: 5, code: "PR3",       max: 50,  pass: 25 },
    { sem: 5, code: "SESSIONAL", max: 100, pass: 50 },
    { sem: 5, code: "TOTAL",     max: 750, pass: 375},
  ];
  const map: Record<string, SubjectCfg> = {};
  for (const c of cfg) map[`${c.sem}|${c.code}`] = { max: c.max, pass: c.pass };
  return map;
})();

/** Returns correct max_marks and pass_marks for a given semester + subject code. */
function getSubjectCfg(semester: number, subjectCode: string): SubjectCfg {
  return SUBJECT_CONFIG[`${semester}|${subjectCode.toUpperCase()}`] ?? { max: 100, pass: 40 };
}

function deriveStatus(
  marks: number | null | undefined,
  passMark: number,
): Row["status"] {
  if (marks == null) return "backlog";
  if (marks < passMark) return "fail";
  return "pass";
}

/**
 * Normalize a free-form Result / Status cell from CSV/PDF to our enum.
 * Examples handled (case-insensitive):
 *   "Pass", "Pass(G)"           -> "pass"
 *   "Fail"                      -> "fail"
 *   "Back-TH1", "Back-TH1,TH2"  -> "backlog"
 */
function getResultStatus(resultText: unknown): Row["status"] | null {
  if (resultText == null) return null;
  const r = String(resultText).trim().toLowerCase();
  if (!r) return null;
  if (r.includes("fail")) return "fail";
  if (r.includes("back")) return "backlog";
  if (r.includes("pass")) return "pass";
  return null;
}

function UploadPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState({ branch: "", batch_year: "", semester: "" });
  const [parsing, setParsing] = useState(false);
  const ingest = useServerFn(ingestResults);
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      const cleaned = rows.map((r) => ({
        ...r,
        branch: r.branch || meta.branch || null,
        batch_year: r.batch_year ?? (meta.batch_year ? Number(meta.batch_year) : null),
      }));
      return ingest({ data: { rows: cleaned } });
    },
    onSuccess: (res) => {
      const clearedMsg = res.cleared > 0 ? ` · ${res.cleared} backlog${res.cleared === 1 ? "" : "s"} marked cleared` : "";
      toast.success(`${res.inserted} result rows saved${clearedMsg}`);
      setRows([]);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCsv = (file: File) => {
    setParsing(true);
    // Auto-detect semester from filename e.g. "it_2023_sem2.csv" -> 2
    const semFromFile = file.name.match(/sem[_\-]?(\d+)/i);
    const fileSemester = semFromFile ? semFromFile[1] : "";
    const metaWithSem = { ...meta, semester: meta.semester || fileSemester };
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const parsed = parseCsvRows(res.data, metaWithSem);
          setRows(parsed);
          toast.success(`Parsed ${parsed.length} rows from CSV`);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setParsing(false);
        }
      },
      error: (err) => {
        toast.error(err.message);
        setParsing(false);
      },
    });
  };

  const handlePdf = async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const parsed = parsePdfText(text as string, meta);
      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("Could not detect any result rows in this PDF. Try CSV.");
      } else {
        toast.success(`Extracted ${parsed.length} rows from PDF`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  if (role && role !== "admin") {
    return (
      <GlassCard className="text-center">
        <h2 className="font-display text-xl font-semibold">Admins only</h2>
        <Button asChild variant="hero" className="mt-4"><Link to="/student">My results</Link></Button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Upload Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">Drop a CSV or PDF. Subjects, marks, semester and status are detected automatically.</p>
      </div>

      <GlassCard>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="branch">Default branch (optional)</Label>
            <Input id="branch" value={meta.branch} onChange={(e) => setMeta({ ...meta, branch: e.target.value })} placeholder="CSE, IT, Civil…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch_year">Default batch year (optional)</Label>
            <Input id="batch_year" type="number" value={meta.batch_year} onChange={(e) => setMeta({ ...meta, batch_year: e.target.value })} placeholder="2024" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="semester">Default semester (auto-detected from filename)</Label>
            <Input id="semester" type="number" value={meta.semester} onChange={(e) => setMeta({ ...meta, semester: e.target.value })} placeholder="e.g. 1, 2, 3…" />
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 md:grid-cols-2">
        <FileDrop
          icon={<FileSpreadsheet className="h-8 w-8" />}
          title="CSV file"
          desc="Headers: registration_no, name, branch, semester, subject_code, marks, max_marks. Or wide format with subject codes as columns."
          accept=".csv,text/csv"
          onFile={handleCsv}
          parsing={parsing}
        />
        <FileDrop
          icon={<FileText className="h-8 w-8" />}
          title="PDF file"
          desc="Tabular result PDFs. Best results with text-based PDFs (not scans)."
          accept="application/pdf"
          onFile={handlePdf}
          parsing={parsing}
        />
      </div>

      {rows.length > 0 && (
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Preview · {rows.length} rows</h3>
              <p className="text-xs text-muted-foreground">Review before saving.</p>
            </div>
            <Button variant="hero" onClick={() => submit.mutate()} disabled={submit.isPending}>
              <CheckCircle2 className="h-4 w-4" /> {submit.isPending ? "Saving…" : "Save to database"}
            </Button>
          </div>
          <div className="mt-4 max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background/90 backdrop-blur">
                <tr className="border-b border-border/60 text-left uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Reg</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Sem</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Marks</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{r.registration_no}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{r.student_name ?? "—"}</td>
                    <td className="py-1.5 pr-3">{r.semester}</td>
                    <td className="py-1.5 pr-3">{r.subject_code}</td>
                    <td className="py-1.5 pr-3">{r.marks ?? "—"} / {r.max_marks}</td>
                    <td className="py-1.5 pr-3 capitalize">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Showing first 200 rows. All {rows.length} will be saved.</p>}
          </div>
        </GlassCard>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-muted-foreground">
        <Upload className="mx-auto mb-1 h-4 w-4" />
        Tip: CSV with one row per (student, subject) gives best accuracy.
      </motion.div>
    </div>
  );
}

function FileDrop({
  icon,
  title,
  desc,
  accept,
  onFile,
  parsing,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accept: string;
  onFile: (f: File) => void;
  parsing: boolean;
}) {
  return (
    <label className="glass relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 p-8 text-center transition-colors hover:border-primary/60">
      <span className="grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground [background-image:var(--gradient-primary)]">
        {icon}
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{desc}</p>
      <span className="mt-3 text-xs font-medium text-primary">{parsing ? "Parsing…" : "Click or drop a file"}</span>
      <input
        type="file"
        accept={accept}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

// ---- Parsers ---------------------------------------------------------------

function normKey(k: string) {
  return k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseCsvRows(raw: Record<string, string>[], meta: { branch: string; batch_year: string; semester: string }): Row[] {
  if (raw.length === 0) return [];
  const headers = Object.keys(raw[0]).map(normKey);
  const sample = raw[0];
  const has = (k: string) => headers.includes(k);

  // Long format: one row per (student, subject)
  if (has("subject_code") || has("subject")) {
    return raw.map((r) => {
      const obj: Record<string, string> = {};
      for (const k of Object.keys(r)) obj[normKey(k)] = String(r[k] ?? "").trim();
      const semester = Number(obj.semester || obj.sem || meta.semester || 1);
      const subjectCode = (obj.subject_code || obj.subject || "").toUpperCase();
      const cfg = getSubjectCfg(semester, subjectCode);
      // Prefer explicit max_marks in CSV; fall back to subject config table values.
      const max = Number(obj.max_marks || obj.max || cfg.max) || cfg.max;
      const marks = obj.marks === "" || obj.marks == null ? null : Number(obj.marks);
      // Result column can be named result / status / RESULT / Status — all normalized via normKey.
      const explicit = getResultStatus(obj.result ?? obj.status);
      const marksStatus = deriveStatus(marks, cfg.pass);
      const parsedResult = parseResultText(obj.result ?? obj.status);
      const { status: subStatus, cleared: subCleared } = subjectStatusFromResult(subjectCode, parsedResult, marksStatus);
      const finalStatus = explicit ?? subStatus;
      const row: Row & { cleared_backlog?: boolean } = {
        registration_no: (obj.registration_no || obj.reg_no || obj.regno || obj.roll_no || "").toUpperCase(),
        student_name: obj.name || obj.student_name || null,
        branch: obj.branch || meta.branch || null,
        batch_year: obj.batch_year ? Number(obj.batch_year) : meta.batch_year ? Number(meta.batch_year) : null,
        semester,
        subject_code: subjectCode,
        // Encode result_text into subject_name so no new DB column is needed
        subject_name: (obj.result || obj.status)
          ? `RESULT:${obj.result || obj.status}`
          : (obj.subject_name || null),
        marks: marks == null || isNaN(marks) ? null : marks,
        max_marks: max,
        status: finalStatus,
      };
      if (subCleared) row.cleared_backlog = true;
      return row;
    }).filter((r) => r.registration_no && r.subject_code);
  }

  // Wide format: registration_no, name, semester, [SUBJECT_CODE columns]
  const known = new Set([
    "registration_no", "reg_no", "regno", "roll_no",
    "name", "student_name",
    "semester", "sem", "branch", "batch_year",
    "result", "status", "remarks",
  ]);
  const subjectCols = headers.filter((h) => !known.has(h));
  const out: Row[] = [];
  for (const r of raw) {
    const obj: Record<string, string> = {};
    for (const k of Object.keys(r)) obj[normKey(k)] = String(r[k] ?? "").trim();
    const reg = (obj.registration_no || obj.reg_no || obj.regno || obj.roll_no || "").toUpperCase();
    const name = obj.name || obj.student_name || null;
    const semester = Number(obj.semester || obj.sem || meta.semester || 1);
    if (!reg) continue;
    const explicit = getResultStatus(obj.result ?? obj.status);
    let pushed = 0;
    for (const col of subjectCols) {
      const val = obj[col];
      if (val == null || val === "") continue;
      const marks = isNaN(Number(val)) ? null : Number(val);
      const subCode = col.toUpperCase();
      const cfg = getSubjectCfg(semester, subCode);
      const parsedResult = parseResultText(obj.result ?? obj.status);
      const marksStatus = deriveStatus(marks, cfg.pass);
      const { status: subStatus, cleared: subCleared } = subjectStatusFromResult(subCode, parsedResult, marksStatus);
      out.push({
        registration_no: reg,
        student_name: name,
        branch: obj.branch || meta.branch || null,
        batch_year: obj.batch_year ? Number(obj.batch_year) : meta.batch_year ? Number(meta.batch_year) : null,
        semester,
        subject_code: subCode,
        // Encode result_text into subject_name so no new DB column is needed
        subject_name: (obj.result || obj.status)
          ? `RESULT:${obj.result || obj.status}`
          : null,
        marks,
        max_marks: cfg.max,
        status: subStatus,
      });
      if (subCleared) (out[out.length - 1] as any).cleared_backlog = true;
      pushed++;
    }
    // No per-subject columns but we have an explicit Result for this student —
    // emit a synthetic "OVERALL" row so the student is counted on the dashboard.
    if (pushed === 0 && explicit) {
      out.push({
        registration_no: reg,
        student_name: name,
        branch: obj.branch || meta.branch || null,
        batch_year: obj.batch_year ? Number(obj.batch_year) : meta.batch_year ? Number(meta.batch_year) : null,
        semester,
        subject_code: "OVERALL",
        subject_name: "Overall result",
        marks: null,
        max_marks: 100,
        status: explicit,
      });
    }
  }
  if (sample && out.length === 0) {
    throw new Error("Could not detect a usable column layout. Include either subject_code or subject-coded columns.");
  }
  return out;
}

function parsePdfText(text: string, meta: { branch: string; batch_year: string }): Row[] {
  // Simple heuristic parser: look for lines like "REG NAME ... SUBJ MARKS ..."
  // Match table rows beginning with a registration number (alphanumeric 6+).
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const semMatch = text.match(/semester\s*[:\-]?\s*(\d+)/i);
  const semester = semMatch ? Number(semMatch[1]) : 1;
  const out: Row[] = [];
  const subjCodeRegex = /\b([A-Z]{2,}\d{1,3}|TH\d|PR\d|LAB\d|[A-Z]{2,4}-\d{2,3})\b/g;
  for (const line of lines) {
    const regMatch = line.match(/\b([A-Z0-9]{6,15})\b/);
    if (!regMatch) continue;
    const reg = regMatch[1].toUpperCase();
    const codes = Array.from(line.matchAll(subjCodeRegex)).map((m) => m[1]);
    const numbers = Array.from(line.matchAll(/\b(\d{1,3})\b/g)).map((m) => Number(m[1])).filter((n) => n <= 750);
    if (codes.length === 0 || numbers.length === 0) continue;
    const pairs = Math.min(codes.length, numbers.length);
    for (let i = 0; i < pairs; i++) {
      const marks = numbers[i];
      const subCode = codes[i].toUpperCase();
      const cfg = getSubjectCfg(semester, subCode);
      out.push({
        registration_no: reg,
        student_name: null,
        branch: meta.branch || null,
        batch_year: meta.batch_year ? Number(meta.batch_year) : null,
        semester,
        subject_code: subCode,
        subject_name: null,
        marks,
        max_marks: cfg.max,
        status: deriveStatus(marks, cfg.pass),
      });
    }
  }
  return out;
}
