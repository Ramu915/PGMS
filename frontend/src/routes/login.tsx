import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, LogIn, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getRoleHomePath, getUserRole, useAuth } from "@/hooks/useAuth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    registered: typeof search.registered === "string" ? search.registered : undefined,
    reset: typeof search.reset === "string" ? search.reset : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign In — PGMS" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, googleLogin, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSuccess(payload: { idToken?: string; email?: string; name?: string; googleId?: string; avatarUrl?: string }) {
    setError(null);
    try {
      const res = await googleLogin(payload);
      const nextUserRole = getUserRole(res?.user?.role);
      const redirectTarget = search.redirect || getRoleHomePath(nextUserRole);
      if (redirectTarget === "/") {
        navigate({ to: "/" });
        return;
      }

      if (redirectTarget === "/submit") {
        navigate({ to: "/submit" });
        return;
      }

      if (redirectTarget === "/dashboard") {
        navigate({ to: "/dashboard" });
        return;
      }

      if (redirectTarget === "/admin") {
        navigate({ to: "/admin" });
        return;
      }

      navigate({ to: "/grievances" });
    } catch (err: any) {
      setError(err?.message ?? "Google authentication failed. Please try again.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await login(email, password);
      const nextUserRole = getUserRole(res?.user?.role);
      const redirectTarget = search.redirect || getRoleHomePath(nextUserRole);
      if (redirectTarget === "/") {
        navigate({ to: "/" });
        return;
      }

      if (redirectTarget === "/submit") {
        navigate({ to: "/submit" });
        return;
      }

      if (redirectTarget === "/dashboard") {
        navigate({ to: "/dashboard" });
        return;
      }

      if (redirectTarget === "/admin") {
        navigate({ to: "/admin" });
        return;
      }

      navigate({ to: "/grievances" });
    } catch (err: any) {
      setError(err?.message ?? "Invalid email or password.");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md w-full px-4 py-12 md:py-16 lg:py-20">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 md:h-14 w-12 md:w-14 items-center justify-center rounded-lg md:rounded-xl bg-primary text-primary-foreground mb-4 shadow-[var(--shadow-soft)]">
            <LogIn className="h-5 md:h-6 w-5 md:w-6" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">Sign in to file and track your grievances.</p>
        </div>

        <Card className="border-border shadow-[var(--shadow-soft)] bg-background/95">
          <CardContent className="p-5 md:p-7">
            <GoogleAuthButton onGoogleSuccess={handleGoogleSuccess} disabled={loading} text="Continue with Google" />

            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Or continue with email
              </span>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              {search.registered === "true" && (
                <div className="flex items-start gap-2.5 rounded-md border border-green-500/30 bg-green-50 p-3.5 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  <span>Account created successfully! Please sign in with your password.</span>
                </div>
              )}

              {search.reset === "true" && (
                <div className="flex items-start gap-2.5 rounded-md border border-green-500/30 bg-green-50 p-3.5 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  <span>Password reset successfully! Please sign in with your new password.</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">{error}</p>
                    {error.includes("Google Sign-In") && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tip: Click <strong className="text-foreground">Continue with Google</strong> above to sign in, or set a password using{" "}
                        <Link to="/forgot-password" search={{ email }} className="text-primary underline font-medium">
                          Forgot password
                        </Link>{" "}
                        if you prefer using email & password.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-[14px] font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9 h-10 md:h-11 text-sm md:text-[15px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm md:text-[14px] font-medium">Password</Label>
                  <Link to="/forgot-password" search={{ email }} className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10 h-10 md:h-11 text-sm md:text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 md:h-11 text-sm md:text-[15px] font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline">Register</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
