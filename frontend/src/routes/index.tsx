import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText, Users, CheckCircle2, MapPin, ShieldCheck, BarChart3,
  ArrowRight, Megaphone, Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PGMS — Public Grievance Management System" },
      { name: "description", content: "Report public issues with GPS-verified photos. Track resolution by government departments transparently." },
      { property: "og:title", content: "PGMS — Public Grievance Management System" },
      { property: "og:description", content: "A transparent platform connecting citizens and government for faster grievance resolution." },
    ],
  }),
  component: HomePage,
});

const stats = [
  { value: "12,540+", label: "Grievances Filed" },
  { value: "9,820+", label: "Issues Resolved" },
  { value: "78%", label: "Resolution Rate" },
  { value: "32", label: "Departments" },
];

const features = [
  { icon: MapPin, title: "GPS-Verified Photos", desc: "Every complaint includes location-tagged images for authenticity and faster verification." },
  { icon: Building2, title: "Department Routing", desc: "Complaints are auto-routed to the correct government department for action." },
  { icon: BarChart3, title: "Live Tracking", desc: "Track every status change — Pending, In-Progress, Resolved — in real time." },
  { icon: ShieldCheck, title: "Secure & Verified", desc: "Authenticated accounts and role-based access keep the system trustworthy." },
  { icon: Megaphone, title: "Public Transparency", desc: "All resolutions and updates are visible to the public for full accountability." },
  { icon: FileText, title: "Comprehensive Documentation", desc: "Detailed updates and proof of resolution for each grievance filed." },
];

const steps = [
  { n: "01", title: "Register & Sign In", desc: "Create your citizen account in under a minute." },
  { n: "02", title: "Submit a Complaint", desc: "Upload a GPS-tagged photo, describe the issue, and pick a department." },
  { n: "03", title: "Track Progress", desc: "Follow your complaint status and receive updates from departments." },
  { n: "04", title: "See It Resolved", desc: "Departments post updates and proof of resolution publicly." },
];

function HomePage() {
  const { user, mounted, role } = useAuth();

  return (
    <Layout>
      {/* Hero */}
      <section className="hero-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-28 grid lg:grid-cols-12 gap-8 md:gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs md:text-sm font-medium backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Official Citizen Platform
            </div>
            <h1 className="mt-4 md:mt-6 font-display text-3xl md:text-4xl lg:text-5xl text-white leading-tight">
              Report public issues. <span className="text-accent">Get them resolved.</span>
            </h1>
            <p className="mt-4 md:mt-5 text-base md:text-lg text-white/85 max-w-2xl leading-relaxed">
              Submit complaints with GPS-verified photos, track resolution in real time, and hold government departments accountable.
            </p>
            <div className="mt-6 md:mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold h-11 md:h-12 px-6 text-base w-full sm:w-auto">
                <Link to="/submit">
                  Submit a Complaint <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 md:h-12 px-6 text-base bg-white/5 text-white border-white/25 hover:bg-white/10 hover:text-white w-full sm:w-auto">
                <Link to="/grievances">Browse Grievances</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg md:rounded-xl border border-white/15 bg-white/5 backdrop-blur p-4 md:p-5">
                  <div className="font-display text-2xl md:text-3xl font-bold text-white">{s.value}</div>
                  <div className="mt-1 text-xs md:text-sm text-white/80">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="max-w-2xl mb-10 md:mb-12">
          <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-accent">Why PGMS</div>
          <h2 className="mt-2 md:mt-3 font-display text-2xl md:text-3xl">A modern system for transparent governance</h2>
          <p className="mt-3 md:mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
            Every feature is designed to make the citizen-government interaction faster, fairer and verifiable.
          </p>
        </div>

        <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border-border hover:border-accent/50 hover:shadow-[var(--shadow-soft)] transition-all">
              <CardContent className="p-5 md:p-6">
                <div className="flex h-10 md:h-11 w-10 md:w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 md:mt-5 font-display text-base md:text-lg">{f.title}</h3>
                <p className="mt-2 text-sm md:text-[15px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-secondary/60 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="max-w-2xl mb-10 md:mb-12">
            <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-accent">How it works</div>
            <h2 className="mt-2 md:mt-3 font-display text-2xl md:text-3xl">Four simple steps</h2>
          </div>

          <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-lg md:rounded-xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
                <div className="font-display text-2xl md:text-3xl font-bold text-accent">{s.n}</div>
                <h3 className="mt-3 font-display text-base md:text-lg">{s.title}</h3>
                <p className="mt-2 text-sm md:text-[15px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        {!mounted || !user ? (
          <div className="rounded-xl md:rounded-2xl bg-primary text-primary-foreground p-6 md:p-10 lg:p-14 shadow-[var(--shadow-elegant)] grid lg:grid-cols-3 gap-6 md:gap-8 items-center">
            <div className="lg:col-span-2">
              <h2 className="font-display text-2xl md:text-3xl text-white">Be the change in your community</h2>
              <p className="mt-3 text-white/85 text-sm md:text-lg leading-relaxed">
                Join thousands of citizens improving public services across the nation.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold h-11 md:h-12 px-6 text-base w-full lg:w-auto">
                <Link to="/register">Create Account</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl md:rounded-2xl bg-primary text-primary-foreground p-6 md:p-10 lg:p-14 shadow-[var(--shadow-elegant)] grid lg:grid-cols-3 gap-6 md:gap-8 items-center">
            <div className="lg:col-span-2">
              <h2 className="font-display text-2xl md:text-3xl text-white">Start making a difference</h2>
              <p className="mt-3 text-white/85 text-sm md:text-lg leading-relaxed">
                Submit complaints, track issues, and be part of the solution for better governance.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold h-11 md:h-12 px-6 text-base w-full lg:w-auto">
                <Link to="/submit">
                  Submit Complaint <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Roles preview */}
        <div className="mt-12 md:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {[
            { icon: Users, title: "For Citizens", desc: "File complaints, upload proof, and track resolution." },
            { icon: Building2, title: "For Departments", desc: "Receive grievances, post updates, and confirm resolutions." },
            { icon: CheckCircle2, title: "For Admins", desc: "Oversee operations and ensure compliance." },
          ].map((r) => (
            <Card key={r.title} className="border-border">
              <CardContent className="p-5 md:p-6 flex items-start gap-3 md:gap-4">
                <div className="flex h-10 md:h-11 w-10 md:w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                  <r.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-base md:text-lg">{r.title}</h3>
                  <p className="mt-1.5 text-sm md:text-[15px] text-muted-foreground leading-relaxed">{r.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Layout>
  );
}
