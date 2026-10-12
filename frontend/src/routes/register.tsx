import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Mail, Lock, User, Phone, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getRoleHomePath, getUserRole, useAuth } from "@/hooks/useAuth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create Account — PGMS" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register, googleLogin, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(k: keyof typeof form, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function handleGoogleSuccess(payload: { idToken?: string; email?: string; name?: string; googleId?: string; avatarUrl?: string }) {
    setError(null);
    try {
      const res = await googleLogin(payload);
      const nextUserRole = getUserRole(res?.user?.role);
      navigate({ to: getRoleHomePath(nextUserRole) });
    } catch (err: any) {
      setError(err?.message ?? "Google authentication failed. Please try again.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const cleanPhone = form.phone.replace(/\D/g, "");
    if (cleanPhone && cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    try {
      await register({
        ...form,
        phone: cleanPhone ? `+91 ${cleanPhone}` : "",
      });
      navigate({
        to: "/login",
        search: { registered: "true", email: form.email },
      });
    } catch (err: any) {
      setError(err?.message ?? "Could not create account. Please try again.");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16 bg-background/95 rounded-xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-[var(--shadow-soft)]">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="font-display">Create your account</h1>
          <p className="mt-2 text-muted-foreground">Join PGMS and make your voice count.</p>
        </div>

        <Card className="border-border shadow-[var(--shadow-soft)] ">
          <CardContent className="p-7">
            <GoogleAuthButton onGoogleSuccess={handleGoogleSuccess} disabled={loading} text="Continue with Google" />

            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Or register with email
              </span>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Field id="name" label="Full name" icon={User}>
                <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your full name" className="pl-9 h-11 text-[15px]" />
              </Field>

              <Field id="email" label="Email address" icon={Mail}>
                <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" className="pl-9 h-11 text-[15px]" />
              </Field>

              <Field id="phone" label="Phone (optional)" icon={Phone}>
                <span className="absolute left-9 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-foreground/80 select-none pointer-events-none z-10 border-r border-border/60 pr-1.5">
                  +91
                </span>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.startsWith("+91")) val = val.slice(3);
                    const digits = val.replace(/\D/g, "").slice(0, 10);
                    update("phone", digits);
                  }}
                  placeholder="98765 43210"
                  className="pl-[74px] h-11 text-[15px]"
                />
              </Field>


              <Field id="password" label="Password" icon={Lock}>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="At least 8 characters"
                  className="pl-9 pr-10 h-11 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>

              <Button type="submit" disabled={loading} className="w-full h-11 text-[15px] font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" search={{ redirect: "/" }} className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Field({
  id, label, icon: Icon, children,
}: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[14px] font-medium">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}
