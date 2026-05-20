import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Result Radar" },
      { name: "description", content: "Create an admin or student account on Result Radar." },
    ],
  }),
  component: SignupPage,
});

const baseSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
});

const studentSchema = baseSchema.extend({
  registration_no: z.string().trim().min(1).max(50),
  branch: z.string().trim().min(1).max(50),
  batch_year: z.coerce.number().int().min(1990).max(2100),
});

function SignupPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"student" | "admin">("student");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    registration_no: "",
    branch: "",
    batch_year: "",
  });
  const [busy, setBusy] = useState(false);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = tab === "student" ? studentSchema : baseSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const meta: Record<string, unknown> = {
      full_name: form.full_name,
      role: tab,
    };
    if (tab === "student") {
      meta.registration_no = form.registration_no.trim().toUpperCase();
      meta.branch = form.branch.trim();
      meta.batch_year = form.batch_year;
    }
    const { data: signed, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: meta,
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    // If email confirmation is enabled, no session is returned — tell the user.
    if (!signed.session) {
      setBusy(false);
      toast.success("Account created. Check your email to confirm, then sign in.");
      navigate({ to: "/login" });
      return;
    }
    // Sign in immediately to make sure the client has a fresh session before navigating.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setBusy(false);
    if (signInErr) {
      toast.error(signInErr.message);
      navigate({ to: "/login" });
      return;
    }
    toast.success("Account created — signing you in…");
    navigate({ to: tab === "admin" ? "/admin" : "/student" });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container mx-auto grid place-items-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-lg rounded-2xl p-8"
        >
          <h1 className="font-display text-3xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose your role to continue.</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "student" | "admin")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={6} />
              </div>

              <TabsContent value="student" className="m-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="registration_no">Registration No</Label>
                    <Input id="registration_no" value={form.registration_no} onChange={(e) => update("registration_no", e.target.value)} placeholder="2210123" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch">Branch</Label>
                    <Input id="branch" value={form.branch} onChange={(e) => update("branch", e.target.value)} placeholder="CSE" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="batch_year">Batch year</Label>
                    <Input id="batch_year" type="number" value={form.batch_year} onChange={(e) => update("batch_year", e.target.value)} placeholder="2024" />
                  </div>
                </div>
              </TabsContent>

              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy ? "Creating account…" : `Sign up as ${tab}`}
              </Button>
            </form>
          </Tabs>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
