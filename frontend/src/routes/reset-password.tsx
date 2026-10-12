import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { authApi } from "@/api";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Set New Password — PGMS" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const token = search.token || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword("", token, newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate({
          to: "/login",
          search: { reset: "true" },
        });
      }, 2000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Layout>
        <div className="mx-auto max-w-md w-full px-4 py-12 md:py-16 lg:py-20 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Invalid Reset Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This password reset link is invalid or incomplete. Please request a new password reset email.
          </p>
          <div className="mt-6">
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              Request New Reset Link
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md w-full px-4 py-12 md:py-16 lg:py-20">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 md:h-14 w-12 md:w-14 items-center justify-center rounded-lg md:rounded-xl bg-primary text-primary-foreground mb-4 shadow-[var(--shadow-soft)]">
            <ShieldCheck className="h-5 md:h-6 w-5 md:w-6" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Set New Password</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Please enter and confirm your new password below.
          </p>
        </div>

        <Card className="border-border shadow-[var(--shadow-soft)] bg-background/95">
          <CardContent className="p-5 md:p-7">
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="py-6 text-center space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Password Reset Successfully!</h2>
                <p className="text-sm text-muted-foreground">
                  Your password has been updated. Redirecting you to the sign in page...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pl-9 pr-10 h-10 md:h-11 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="pl-9 pr-10 h-10 md:h-11 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 md:h-11 text-sm md:text-[15px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? "Updating password..." : "Reset Password"}
                </Button>

                <div className="mt-6 pt-4 border-t border-border/60 text-center">
                  <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
