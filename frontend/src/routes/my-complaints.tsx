import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, FileText, MapPin, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { grievancesApi, getFileUrl, getToken } from "@/api";
import type { Grievance } from "@/types";

export const Route = createFileRoute("/my-complaints")({
  beforeLoad: ({ location }) => {
    if (!getToken()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  head: () => ({ meta: [{ title: "My Complaints — PGMS" }] }),
  component: MyComplaintsPage,
});

function MyComplaintsPage() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadComplaints() {
    setLoading(true);
    setError(null);

    try {
      const records = await grievancesApi.getGrievances({ mine: true, sort: "-createdAt" });
      setItems(records);
    } catch (loadError: any) {
      setError(loadError?.message ?? "Could not load your complaints.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display">My Complaints</h1>
            <p className="mt-3 text-muted-foreground">
              This page shows complaints created by your account.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={loadComplaints} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button asChild>
              <Link to="/submit">New Complaint</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((item) => (
                <Card key={item} className="border-border">
                  <CardContent className="p-6">
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="mt-3 h-4 w-full rounded bg-muted" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {!loading && !items.length ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <FileText className="h-10 w-10 text-primary" />
                <h2 className="mt-4 font-display text-2xl">No complaints yet</h2>
                <p className="mt-2 max-w-md text-muted-foreground">
                  Once you submit a complaint, it will appear here with its current status and location details.
                </p>
                <Button asChild className="mt-6">
                  <Link to="/submit">Submit your first complaint</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!loading && items.length ? (
            <div className="grid gap-4">
              {items.map((item) => {
                const imageNames = Array.isArray(item.images)
                  ? item.images
                  : item.images
                  ? [item.images]
                  : [];
                const imageName = imageNames[0];

                return (
                  <Card key={item.id} className="border-border shadow-[var(--shadow-soft)]">
                    <CardContent className="grid gap-5 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
                      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
                        {imageName ? (
                          <img
                            src={getFileUrl(imageName)}
                            alt={item.title}
                            className="h-44 w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                            No image uploaded
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h2 className="font-display text-2xl">{item.title}</h2>
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Tracking Ref:</span>
                              <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30">
                                KAR-2026-{item.id.slice(0, 8).toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <StatusBadge status={item.status} size="md" />
                        </div>

                        <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline">{item.category || "General"}</Badge>
                          <Badge variant="outline">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDate(item.createdAt || item.created)}
                          </Badge>
                          <Badge variant="outline">
                            <MapPin className="h-3.5 w-3.5" />
                            {formatCoordinates(item.latitude, item.longitude)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </Layout>
  );
}

function formatStatus(value?: string) {
  if (!value) return "Pending";
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "Recently";
  return new Date(value).toLocaleString();
}

function formatCoordinates(latitude?: number, longitude?: number) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return "Location unavailable";
  }

  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}