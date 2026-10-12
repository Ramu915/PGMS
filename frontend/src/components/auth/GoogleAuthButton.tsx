import { useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, User, X } from "lucide-react";

interface GoogleAuthButtonProps {
  onGoogleSuccess: (payload: { idToken?: string; email?: string; name?: string; googleId?: string; avatarUrl?: string }) => void;
  disabled?: boolean;
  text?: string;
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function RealGoogleLoginButton({ onGoogleSuccess, disabled, text }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoRes.json();
        onGoogleSuccess({
          email: userInfo.email,
          name: userInfo.name,
          googleId: userInfo.sub,
          avatarUrl: userInfo.picture,
        });
      } catch (err) {
        console.error("Failed to fetch Google user info", err);
      } finally {
        setLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error("Google Login Error:", errorResponse);
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || loading}
      onClick={() => login()}
      className="w-full h-11 text-[15px] font-medium border-border hover:bg-muted/60 transition-all flex items-center justify-center gap-3 shadow-xs cursor-pointer"
    >
      <GoogleLogoSvg className="w-5 h-5 shrink-0" />
      <span>{loading ? "Signing in..." : text}</span>
    </Button>
  );
}

export function GoogleAuthButton({ onGoogleSuccess, disabled, text = "Continue with Google" }: GoogleAuthButtonProps) {
  const [openModal, setOpenModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        <RealGoogleLoginButton onGoogleSuccess={onGoogleSuccess} disabled={disabled} text={text} />
      </GoogleOAuthProvider>
    );
  }

  function handleGoogleClick() {
    setGoogleEmail("");
    setGoogleName("");
    setError(null);
    setOpenModal(true);
  }

  function handleConfirmGoogle(e: React.FormEvent) {
    e.preventDefault();
    if (!googleEmail || !googleEmail.includes("@")) {
      setError("Please enter a valid Google email address.");
      return;
    }

    const emailPrefix = googleEmail.split("@")[0] || "Citizen";
    const displayName = googleName.trim() || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    const mockGoogleId = `google-sub-${Math.abs(hashString(googleEmail))}`;

    onGoogleSuccess({
      email: googleEmail,
      name: displayName,
      googleId: mockGoogleId,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(googleEmail)}`,
    });
    setOpenModal(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={handleGoogleClick}
        className="w-full h-11 text-[15px] font-medium border-border hover:bg-muted/60 transition-all flex items-center justify-center gap-3 shadow-xs cursor-pointer"
      >
        <GoogleLogoSvg className="w-5 h-5 shrink-0" />
        <span>{text}</span>
      </Button>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-background rounded-xl border border-border p-6 shadow-xl space-y-4">
            <button
              type="button"
              onClick={() => setOpenModal(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <GoogleLogoSvg className="w-6 h-6" />
                <h3 className="text-xl font-bold text-foreground">Sign in with Google</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your Google account details to proceed to PGMS.
              </p>
            </div>

            <form onSubmit={handleConfirmGoogle} className="space-y-4 pt-1">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2.5">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="googleEmail" className="text-sm font-medium">
                  Google Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="googleEmail"
                    type="email"
                    required
                    placeholder="user@gmail.com"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    className="pl-9 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleName" className="text-sm font-medium">
                  Display Name (Optional)
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="googleName"
                    type="text"
                    placeholder="John Doe"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    className="pl-9 h-11"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button type="button" variant="ghost" onClick={() => setOpenModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-medium hover:bg-primary/90">
                  Continue as Google User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function GoogleLogoSvg({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
