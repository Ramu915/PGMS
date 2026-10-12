import { Link, useNavigate } from "@tanstack/react-router";
import { Shield, Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

function formatRole(role?: string) {
  if (!role) return "Citizen";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/grievances", label: "Browse Grievances" },
  { to: "/submit", label: "Submit Complaint" },
  { to: "/my-complaints", label: "My Complaints" },
  { to: "/about", label: "About" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout, role, mounted } = useAuth();
  const navigate = useNavigate();
  const isStaff = mounted && (role === "department" || role === "admin");
  const isAdmin = mounted && role === "admin";

  const handleLogout = async () => {
    logout();
    // Redirect to login page after logout
    await navigate({ to: "/login", search: { redirect: "/" } });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/* Top gov strip */}
      <div className="gov-strip">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs sm:text-[13px]">
          <span className="font-medium tracking-wide">Government of India · Public Grievance Portal</span>
          <span className="hidden sm:inline opacity-90">Helpline: 1800-XXX-XXXX</span>
        </div>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-bold text-foreground">PGMS</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Grievance Portal</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium text-foreground/80 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{ className: "px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-md bg-muted text-primary" }}
            >
              {l.label}
            </Link>
          ))}
          {isStaff ? (
            <Link
              to="/dashboard"
              className="px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium text-foreground/80 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{ className: "px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-md bg-muted text-primary" }}
            >
              Dashboard
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              to="/admin"
              className="px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium text-foreground/80 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{ className: "px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-md bg-muted text-primary" }}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {!mounted ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-36 bg-muted rounded-full animate-pulse" aria-hidden />
              <div className="h-8 w-20 bg-muted rounded-md animate-pulse" aria-hidden />
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground shrink-0 shadow-2xs">
                <UserIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="max-w-[130px] xl:max-w-[170px] truncate">{user.name || user.email}</span>
                <span className="text-muted-foreground font-normal text-[11px] uppercase tracking-wider">({formatRole(role)})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="h-8 gap-1.5 px-3 text-xs font-medium border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-150 shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login" search={{ redirect: "/" }}>Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs">
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted border border-border"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && mounted && (
        <div className="lg:hidden border-t border-border bg-background shadow-lg animate-in slide-in-from-top-1">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
              >
                {l.label}
              </Link>
            ))}
            {isStaff ? (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-semibold hover:bg-muted text-primary transition-colors"
              >
                Dashboard
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-semibold hover:bg-muted text-primary transition-colors"
              >
                Admin
              </Link>
            ) : null}
            {user ? (
              <div className="space-y-2 pt-2 border-t border-border mt-1">
                <div className="rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground flex items-center justify-between">
                  <span className="truncate">{user.name || user.email}</span>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{formatRole(role)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-1.5 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => { setOpen(false); handleLogout(); }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border mt-1">
                <Button asChild variant="outline" size="sm">
                  <Link to="/login" search={{ redirect: "/" }} onClick={() => setOpen(false)}>Sign In</Link>
                </Button>
                <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                  <Link to="/register" onClick={() => setOpen(false)}>Register</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
