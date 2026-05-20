import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ResultRow = z.object({
  registration_no: z.string().min(1).max(50),
  student_name: z.string().max(200).optional().nullable(),
  branch: z.string().max(50).optional().nullable(),
  batch_year: z.number().int().min(1990).max(2100).optional().nullable(),
  semester: z.number().int().min(1).max(12),
  subject_code: z.string().min(1).max(30),
  subject_name: z.string().max(200).optional().nullable(),
  marks: z.number().min(0).max(1000).optional().nullable(),
  max_marks: z.number().min(1).max(1000).default(100),
  status: z.enum(["pass", "fail", "backlog"]).default("pass"),
  // result_text is encoded inside subject_name as "RESULT:<text>" to avoid needing a new DB column
});

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Forbidden: admins only");
  }
}

export const ingestResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rows: z.array(ResultRow).min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Backlog clearance: fetch existing rows for these (reg, sem, subject) keys
    const regs = Array.from(new Set(data.rows.map((r) => r.registration_no)));
    const sems = Array.from(new Set(data.rows.map((r) => r.semester)));
    const { data: existing } = await supabase
      .from("results")
      .select("registration_no, semester, subject_code, status, cleared_backlog")
      .in("registration_no", regs)
      .in("semester", sems);

    const prevMap = new Map<string, { status: string; cleared_backlog: boolean }>();
    for (const e of existing ?? []) {
      prevMap.set(`${e.registration_no}|${e.semester}|${e.subject_code}`, {
        status: e.status,
        cleared_backlog: e.cleared_backlog,
      });
    }

    const enriched = data.rows.map((r) => {
      const key = `${r.registration_no}|${r.semester}|${r.subject_code}`;
      const prev = prevMap.get(key);
      // Preserve "Now Cleared" history: once a backlog is cleared, keep the flag.
      const wasFailingBefore =
        prev && (prev.status === "fail" || prev.status === "backlog");
      const isPassingNow = r.status === "pass";
      // Also honour cleared_backlog set directly by the CSV parser from the result text
      // (e.g. "Back-TH2 (All Cleared)" sets cleared_backlog=true on TH2 even on first upload)
      const csvCleared = !!(r as any).cleared_backlog;
      const cleared_backlog =
        csvCleared || prev?.cleared_backlog || (wasFailingBefore && isPassingNow) || false;
      return { ...r, cleared_backlog };
    });

    const { error, count } = await supabase
      .from("results")
      .upsert(enriched, {
        onConflict: "registration_no,semester,subject_code",
        count: "exact",
      });
    if (error) throw new Error(error.message);

    const cleared = enriched.filter((r) => {
      const prev = prevMap.get(
        `${r.registration_no}|${r.semester}|${r.subject_code}`,
      );
      return (
        prev &&
        (prev.status === "fail" || prev.status === "backlog") &&
        r.status === "pass" &&
        !prev.cleared_backlog
      );
    }).length;

    return { inserted: count ?? enriched.length, cleared };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: rows, error } = await supabase
      .from("results")
      .select(
        "registration_no, semester, subject_code, marks, max_marks, status, branch, cleared_backlog, subject_name",
      );
    if (error) throw new Error(error.message);

    const byStudent = new Map<string, { fail: boolean; backlog: boolean }>();
    const subjectAvg = new Map<string, { sum: number; n: number }>();
    const semesterAvg = new Map<number, { sum: number; n: number }>();

    for (const r of rows ?? []) {
      const cur = byStudent.get(r.registration_no) ?? { fail: false, backlog: false };
      // Decode result_text from subject_name encoding ("RESULT:Back-TH2 (All Cleared)")
      const encodedResult = typeof r.subject_name === "string" && r.subject_name.startsWith("RESULT:")
        ? r.subject_name.slice(7).toLowerCase() : "";
      const isAllClearedByText = encodedResult.includes("all cleared") ||
        (encodedResult.includes("fail") && encodedResult.includes("cleared"));
      // A cleared backlog should not count the student as currently failing.
      const effectivelyCleared = r.cleared_backlog || isAllClearedByText;
      if (r.status === "fail" && !effectivelyCleared) cur.fail = true;
      if (r.status === "backlog" && !effectivelyCleared) cur.backlog = true;
      byStudent.set(r.registration_no, cur);

      if (r.marks != null) {
        const pct = (Number(r.marks) / Number(r.max_marks ?? 100)) * 100;
        const s = subjectAvg.get(r.subject_code) ?? { sum: 0, n: 0 };
        s.sum += pct; s.n += 1;
        subjectAvg.set(r.subject_code, s);
        const sem = semesterAvg.get(r.semester) ?? { sum: 0, n: 0 };
        sem.sum += pct; sem.n += 1;
        semesterAvg.set(r.semester, sem);
      }
    }

    let pass = 0, fail = 0, backlog = 0;
    for (const v of byStudent.values()) {
      if (v.fail) fail += 1;
      else if (v.backlog) backlog += 1;
      else pass += 1;
    }

    return {
      total: byStudent.size,
      pass,
      fail,
      backlog,
      subjectAvg: Array.from(subjectAvg.entries())
        .map(([code, v]) => ({ code, avg: +(v.sum / v.n).toFixed(2) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      semesterAvg: Array.from(semesterAvg.entries())
        .map(([sem, v]) => ({ semester: sem, avg: +(v.sum / v.n).toFixed(2) }))
        .sort((a, b) => a.semester - b.semester),
    };
  });

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ filter: z.enum(["all", "pass", "fail", "backlog"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: rows, error } = await supabase
      .from("results")
      .select("registration_no, student_name, branch, batch_year, status, cleared_backlog, subject_name");
    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      { registration_no: string; student_name: string | null; branch: string | null; batch_year: number | null; fail: boolean; backlog: boolean }
    >();
    for (const r of rows ?? []) {
      const cur = map.get(r.registration_no) ?? {
        registration_no: r.registration_no,
        student_name: r.student_name,
        branch: r.branch,
        batch_year: r.batch_year,
        fail: false,
        backlog: false,
      };
      const encodedResult = typeof r.subject_name === "string" && r.subject_name.startsWith("RESULT:")
        ? r.subject_name.slice(7).toLowerCase() : "";
      const isAllClearedByText = encodedResult.includes("all cleared") ||
        (encodedResult.includes("fail") && encodedResult.includes("cleared"));
      const effectivelyCleared = r.cleared_backlog || isAllClearedByText;
      if (r.status === "fail" && !effectivelyCleared) cur.fail = true;
      if (r.status === "backlog" && !effectivelyCleared) cur.backlog = true;
      map.set(r.registration_no, cur);
    }
    const all = Array.from(map.values()).map((s) => ({
      ...s,
      status: s.fail ? "fail" : s.backlog ? "backlog" : "pass",
    }));
    const filtered = data.filter === "all" ? all : all.filter((s) => s.status === data.filter);
    return { students: filtered.sort((a, b) => a.registration_no.localeCompare(b.registration_no)) };
  });

export const searchBySubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      subject_code: z.string().min(1).max(30),
      semester: z.number().int().min(1).max(12).optional(),
      branch: z.string().max(20).optional(),
      batch_year: z.number().int().min(1990).max(2100).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("results")
      .select("*")
      .ilike("subject_code", data.subject_code);
    if (data.semester) q = q.eq("semester", data.semester);
    if (data.branch) q = q.eq("branch", data.branch.toUpperCase());
    if (data.batch_year) q = q.eq("batch_year", data.batch_year);
    const { data: rows, error } = await q.order("registration_no");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const batchView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ branch: z.string().optional(), batch_year: z.number().int().optional(), semester: z.number().int().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase.from("results").select("*").order("registration_no").order("semester");
    if (data.branch) q = q.eq("branch", data.branch);
    if (data.batch_year) q = q.eq("batch_year", data.batch_year);
    if (data.semester) q = q.eq("semester", data.semester);
    const { data: rows, error } = await q.limit(5000);
    if (error) throw new Error(error.message);

    const branches = Array.from(new Set((rows ?? []).map((r) => r.branch).filter(Boolean))) as string[];
    const years = Array.from(new Set((rows ?? []).map((r) => r.batch_year).filter(Boolean))) as number[];
    return { rows: rows ?? [], branches, years };
  });

export const getMyResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("results")
      .select("*")
      .order("semester")
      .order("subject_code");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// ---- Branches & Batches CRUD ----------------------------------------------

export const listBranchesAndBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: branches, error: be }, { data: batches, error: te }] = await Promise.all([
      supabase.from("branches").select("*").order("code"),
      supabase.from("batches").select("*").order("year", { ascending: false }),
    ]);
    if (be) throw new Error(be.message);
    if (te) throw new Error(te.message);
    return { branches: branches ?? [], batches: batches ?? [] };
  });

export const addBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      code: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
      name: z.string().max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("branches")
      .insert({ code: data.code.toUpperCase(), name: data.name ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), purgeResults: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: b } = await supabase.from("branches").select("code").eq("id", data.id).single();
    if (data.purgeResults && b?.code) {
      await supabase.from("results").delete().eq("branch", b.code);
    }
    const { error } = await supabase.from("branches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      year: z.number().int().min(1990).max(2100),
      branch: z.string().max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("batches")
      .insert({ year: data.year, branch: data.branch?.toUpperCase() ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), purgeResults: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: b } = await supabase
      .from("batches").select("year, branch").eq("id", data.id).single();
    if (data.purgeResults && b) {
      let q = supabase.from("results").delete().eq("batch_year", b.year);
      if (b.branch) q = q.eq("branch", b.branch);
      await q;
    }
    const { error } = await supabase.from("batches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Delete uploaded results (by branch/batch/semester) -------------------

export const deleteResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      branch: z.string().max(20).optional(),
      batch_year: z.number().int().min(1990).max(2100).optional(),
      semester: z.number().int().min(1).max(12).optional(),
    }).refine((v) => v.branch || v.batch_year || v.semester, {
      message: "At least one filter is required",
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = supabase.from("results").delete({ count: "exact" });
    if (data.branch) q = q.eq("branch", data.branch.toUpperCase());
    if (data.batch_year) q = q.eq("batch_year", data.batch_year);
    if (data.semester) q = q.eq("semester", data.semester);
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

// ---- "See all students" semester-wise --------------------------------------

export const allStudentsBySemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      branch: z.string().max(20).optional(),
      batch_year: z.number().int().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = supabase
      .from("results")
      .select("*")
      .order("semester")
      .order("registration_no");
    if (data.branch) q = q.eq("branch", data.branch.toUpperCase());
    if (data.batch_year) q = q.eq("batch_year", data.batch_year);
    const { data: rows, error } = await q.limit(10000);
    if (error) throw new Error(error.message);

    // Group: semester -> registration_no -> { name, subjects[], total, status, result_text }
    const semesters = new Map<
      number,
      Map<
        string,
        {
          registration_no: string;
          student_name: string | null;
          subjects: { code: string; marks: number | null; max: number; status: string; cleared: boolean }[];
          total: number;
          maxTotal: number;
          status: "pass" | "fail" | "backlog";
          result_text: string | null;
        }
      >
    >();
    for (const r of rows ?? []) {
      const sm = semesters.get(r.semester) ?? new Map();
      const cur = sm.get(r.registration_no) ?? {
        registration_no: r.registration_no,
        student_name: r.student_name,
        subjects: [],
        total: 0,
        maxTotal: 0,
        status: "pass" as "pass" | "fail" | "backlog",
        result_text: null as string | null,
      };
      // Decode result_text encoded in subject_name as "RESULT:<text>"
      const encodedResult = typeof r.subject_name === "string" && r.subject_name.startsWith("RESULT:")
        ? r.subject_name.slice(7)
        : null;
      if (encodedResult && !cur.result_text) {
        cur.result_text = encodedResult;
      }
      const isTotalRow = r.subject_code.toUpperCase() === "TOTAL";
      cur.subjects.push({
        code: r.subject_code,
        marks: r.marks == null ? null : Number(r.marks),
        max: Number(isTotalRow ? (r.max_marks ?? 750) : (r.max_marks ?? 100)),
        status: r.status,
        cleared: !!r.cleared_backlog,
      });
      if (isTotalRow && r.marks != null) {
        // TOTAL row from CSV — use it directly as the student total
        cur.total = Number(r.marks);
        cur.maxTotal = Number(r.max_marks ?? 750);
      } else if (!isTotalRow && r.marks != null && cur.maxTotal < 700) {
        // Accumulate individual subjects only if no TOTAL row processed yet
        cur.total += Number(r.marks);
        cur.maxTotal += Number(r.max_marks ?? 100);
      }
      // TOTAL row must not affect per-subject pass/fail determination
      if (!isTotalRow) {
        const effective = r.cleared_backlog ? "pass" : r.status;
        if (effective === "fail") cur.status = "fail";
        else if (effective === "backlog" && cur.status !== "fail") cur.status = "backlog";
      }
      sm.set(r.registration_no, cur);
      semesters.set(r.semester, sm);
    }

    return {
      semesters: Array.from(semesters.entries())
        .sort(([a], [b]) => a - b)
        .map(([sem, sm]) => ({
          semester: sem,
          students: Array.from(sm.values()).sort((a, b) =>
            a.registration_no.localeCompare(b.registration_no),
          ),
        })),
    };
  });
