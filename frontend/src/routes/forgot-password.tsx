import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Mail, AlertCircle, ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { authApi } from "@/api";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({ meta: [{ title: "Reset Password — PGMS" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const search = Route.useSearch();

  const [email, setEmail] = useState(search.email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSentEmail(email);
    } catch (err: any) {
      setError(err?.message ?? "Could not process request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md w-full px-4 py-12 md:py-16 lg:py-20">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 md:h-14 w-12 md:w-14 items-center justify-center rounded-lg md:rounded-xl bg-primary text-primary-foreground mb-4 shadow-[var(--shadow-soft)]">
            <KeyRound className="h-5 md:h-6 w-5 md:w-6" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Forgot your password?</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            {sentEmail
              ? "Check your email inbox for the reset link."
              : "Enter your registered email address and we'll send you a password reset link."}
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

            {sentEmail ? (
              <div className="space-y-6 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 mx-auto">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Password Reset Link Sent!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We have sent a password reset link to <strong className="text-foreground">{sentEmail}</strong>.
                    Please check your inbox and click the link to reset your password.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3.5 text-xs text-muted-foreground text-left space-y-1">
                  <p>• The reset link is valid for <strong>15 minutes</strong>.</p>
                  <p>• If you don't see it in your inbox, check your spam or junk folder.</p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSentEmail(null)}
                    className="w-full text-sm font-medium"
                  >
                    Resend link or try another email
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestLink} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Account Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-9 h-10 md:h-11 text-sm md:text-[15px]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 md:h-11 text-sm md:text-[15px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  {loading ? (
                    "Sending link..."
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Reset Link
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-border/60 text-center">
              <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
