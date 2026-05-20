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
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Result Radar" },
      { name: "description", content: "Sign in to your Result Radar account." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
});

function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", (await supabase.auth.getUser()).data.user!.id);
    const role = roles?.[0]?.role;
    toast.success("Welcome back!");
    navigate({ to: role === "admin" ? "/admin" : "/student" });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container mx-auto grid place-items-center px-4 py-16">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-md rounded-2xl p-8"
        >
          <h1 className="font-display text-3xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back to Result Radar.</p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <Button type="submit" variant="hero" className="mt-6 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">Create one</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
