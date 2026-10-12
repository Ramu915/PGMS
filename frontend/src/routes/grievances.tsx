import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, RefreshCw, Search, Printer } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grievancesApi, getFileUrl, isAbortError } from "@/api";
import { toast } from "sonner";
import type { Grievance, GrievanceUpdate, GrievanceComment } from "@/types";

const CATEGORIES = ["all", "roads", "water", "electricity", "sanitation", "other"];
const STATUSES = ["all", "pending", "in_progress", "resolved", "rejected"];

export const Route = createFileRoute("/grievances")({
  head: () => ({ meta: [{ title: "Browse Grievances — PGMS" }] }),
  component: GrievancesPage,
});

function GrievancesPage() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<GrievanceUpdate[]>([]);
  const [selectedComments, setSelectedComments] = useState<GrievanceComment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const { user, role } = useAuth();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await grievancesApi.getGrievances({
        category: category !== "all" ? category : undefined,
        status: status !== "all" ? status : undefined,
        search: search.trim() ? search.trim() : undefined,
        sort: "-createdAt",
      });
      setItems(records);
      if (selectedId) {
        loadUpdates(selectedId);
      }
    } catch (err: any) {
      if (!isAbortError(err)) setError(err?.message ?? "Could not load grievances.");
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  async function loadUpdates(id: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [updates, comments] = await Promise.all([
        grievancesApi.getUpdates(id),
        grievancesApi.getComments(id).catch(() => []),
      ]);
      setSelectedUpdates(updates);
      setSelectedComments(comments);
    } catch (err: any) {
      setDetailError(err?.message ?? "Could not load updates.");
      setSelectedUpdates([]);
      setSelectedComments([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function selectItem(item: Grievance) {
    if (selectedId === item.id) {
      setSelectedId(null);
      setSelectedUpdates([]);
      setSelectedComments([]);
      setNote("");
      return;
    }

    setSelectedId(item.id);
    loadUpdates(item.id);
  }

  async function postUpdate(e: FormEvent) {
    e.preventDefault();
    if (!selectedItem || !note.trim()) return;

    setPosting(true);
    setDetailError(null);
    try {
      const created = await grievancesApi.createUpdate(selectedItem.id, {
        status: (selectedItem.status as string) ?? "pending",
        note: note.trim(),
        adminId: role === "admin" ? user?.id : undefined,
        userId: role === "department" ? user?.id : undefined,
      });
      setSelectedUpdates((prev) => [created, ...prev]);
      setNote("");
      toast.success("Timeline update posted successfully!");
      await load();
      await loadUpdates(selectedItem.id);
    } catch (err: any) {
      setDetailError(err?.message ?? "Could not post update.");
    } finally {
      setPosting(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      load();
    }, 15000);
    return () => clearInterval(interval);
  }, [category, status, search]);

  const filtered = useMemo(() => {
    return items;
  }, [items]);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Browse Grievances</h1>
            <p className="mt-2 md:mt-3 text-sm md:text-base text-muted-foreground">
              Track community complaints and resolution progress.
            </p>
          </div>
          <div className="flex gap-2 md:gap-3 w-full md:w-auto">
            <Button variant="outline" onClick={load} disabled={loading} className="flex-1 md:flex-none">
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
            <Button asChild className="flex-1 md:flex-none">
              <Link to="/submit">New Complaint</Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grievances..."
              className="pl-9 text-sm"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : formatStatus(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 md:gap-4">
          {loading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-4 md:p-6">
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="mt-3 h-4 w-full rounded bg-muted" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))
            : null}

          {!loading && !filtered.length ? (
            <Card className="border-border">
              <CardContent className="px-4 md:px-6 py-12 text-center text-muted-foreground text-sm md:text-base">
                No grievances match your filters.
              </CardContent>
            </Card>
          ) : null}

          {!loading
            ? filtered.map((item) => {
                const imageNames = Array.isArray(item.images)
                  ? item.images
                  : item.images
                  ? [item.images]
                  : [];
                const imageName = imageNames[0];
                const citizenInfo = item.citizen || item.expand?.citizen;

                return (
                  <div key={item.id} className="block text-left transition-all duration-300">
                    <Card
                      className={`border-border shadow-[var(--shadow-soft)] transition-all ${
                        selectedId === item.id ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/40 hover:bg-muted/5"
                      }`}
                    >
                      <div
                        onClick={() => selectItem(item)}
                        className="cursor-pointer"
                      >
                        <CardContent className="grid gap-5 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
                          <div className="overflow-hidden rounded-md border border-border bg-muted/30">
                            {imageName ? (
                              <img
                                src={getFileUrl(imageName)}
                                alt={item.title}
                                className="h-44 w-full object-cover transition-transform duration-300 hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h2 className="font-display text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                    {item.title}
                                  </h2>
                                  <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                                    KAR-2026-{item.id.slice(0, 8).toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline">{item.category || "General"}</Badge>
                                  {(item.upvotes ?? 0) >= 3 ? (
                                    <Badge variant="outline" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold gap-1">
                                      🔥 High Priority ({item.upvotes} Citizens Joined)
                                    </Badge>
                                  ) : (item.upvotes ?? 0) >= 1 ? (
                                    <Badge variant="outline" className="bg-muted/50 text-muted-foreground text-[10px]">
                                      👥 {item.upvotes} {item.upvotes === 1 ? "Citizen Upvoted" : "Citizens Upvoted"}
                                    </Badge>
                                  ) : null}
                                  {item.departmentName && (
                                    <Badge variant="outline" className="bg-primary/5">
                                      🏢 {item.departmentName}
                                    </Badge>
                                  )}
                                  {item.citizenName || citizenInfo?.name ? (
                                    <Badge variant="outline">
                                      👤 By: {item.citizenName || citizenInfo?.name || citizenInfo?.email}
                                    </Badge>
                                  ) : null}
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {formatDate(item.createdAt || item.created)}
                                  </span>
                                </div>
                              </div>
                              <StatusBadge status={item.status} size="md" />
                            </div>

                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>

                            {/* Location & Address Box */}
                            <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-foreground">
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <strong>Location Address:</strong> {item.address || "Street address not specified"}
                                </span>
                                {(item.districtName || item.talukName) && (
                                  <div className="flex items-center gap-1 text-[11px]">
                                    {item.districtName && (
                                      <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                                        🏛️ {item.districtName}
                                      </Badge>
                                    )}
                                    {item.talukName && (
                                      <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                                        🚩 {item.talukName}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              {item.landmark && (
                                <div className="text-[11px] text-muted-foreground pl-5">
                                  <strong>Landmark:</strong> {item.landmark}
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm font-medium text-primary hover:underline">
                                {selectedId === item.id ? "Hide quick details ↑" : "View quick details & updates ↓"}
                              </span>
                              <Link
                                to="/grievances/$id"
                                params={{ id: item.id }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md"
                              >
                                Full Detail Page →
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </div>

                      {selectedId === item.id ? (
                        <div className="rounded-b-md border-t border-border bg-card/95 px-5 pb-6 pt-5 md:px-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          {/* Expanded Drawer Action Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4 mb-5">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-foreground">Complaint Quick Inspection</span>
                              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                                KAR-2026-{item.id.slice(0, 8).toUpperCase()}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.print();
                                }}
                                className="h-8 text-xs gap-1.5 font-semibold"
                              >
                                <Printer className="h-3.5 w-3.5" /> Print Receipt
                              </Button>
                              <Button asChild size="sm" className="h-8 text-xs gap-1 font-semibold">
                                <Link to="/grievances/$id" params={{ id: item.id }}>
                                  Full Detail Page →
                                </Link>
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-6 md:grid-cols-12">
                            {/* Left Column: Description, Photos & Official Resolution Updates (7 cols) */}
                            <div className="md:col-span-7 space-y-5">
                              <div>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Detailed Description</h4>
                                <p className="text-sm leading-relaxed text-foreground bg-muted/20 p-3.5 rounded-lg border border-border/60">{item.description}</p>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Attached Images ({imageNames.length})</h4>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {imageNames.length ? (
                                    imageNames.map((name) => (
                                      <div key={name} className="overflow-hidden rounded-md border border-border bg-muted/30">
                                        <img
                                          src={getFileUrl(name)}
                                          alt={item.title}
                                          className="h-40 w-full object-cover transition-transform duration-300 hover:scale-105"
                                          loading="lazy"
                                        />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-md border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground italic">
                                      No photos uploaded by citizen.
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Official Resolution Updates */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-display text-sm font-bold text-foreground">Official Resolution Updates</h4>
                                  <span className="text-[11px] text-muted-foreground">{selectedUpdates.length} updates recorded</span>
                                </div>

                                {detailLoading ? (
                                  <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-muted/20 rounded-md">
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> Loading updates…
                                  </div>
                                ) : detailError ? (
                                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                    {detailError}
                                  </div>
                                ) : selectedUpdates.length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic p-3 bg-muted/15 rounded-md border border-border/50">
                                    No official status updates recorded yet.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {selectedUpdates.map((update) => {
                                      const updateImages = Array.isArray(update.images) ? update.images : [];
                                      return (
                                        <div key={update.id} className="rounded-lg border border-border bg-muted/20 p-3.5 text-xs space-y-1.5">
                                          <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
                                            <span className="font-semibold text-foreground">{update.authorName || "Official Response"}</span>
                                            <span>{formatDate(update.createdAt || update.created)}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <StatusBadge status={update.status} size="sm" />
                                          </div>
                                          {update.note ? (
                                            <p className="text-xs leading-relaxed text-foreground">{update.note}</p>
                                          ) : null}
                                          {updateImages.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 pt-1.5">
                                              {updateImages.map((img) => (
                                                <div key={img} className="overflow-hidden rounded border border-border">
                                                  <img src={getFileUrl(img)} alt="Resolution Proof" className="h-28 w-full object-cover" />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Column: Public Remarks & Location Details (5 cols) */}
                            <div className="md:col-span-5 space-y-5">
                              {/* Location Summary Box */}
                              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-xs">
                                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">Location & Department Scope</h4>
                                <div className="space-y-1 text-muted-foreground">
                                  <div>📍 <strong>Address:</strong> {item.address || "Street address not specified"}</div>
                                  {item.landmark && <div>🚩 <strong>Landmark:</strong> {item.landmark}</div>}
                                  {item.districtName && <div>🏛️ <strong>District:</strong> {item.districtName}</div>}
                                  {item.talukName && <div>🚩 <strong>Taluk:</strong> {item.talukName}</div>}
                                  {item.departmentName && <div>🏢 <strong>Department:</strong> {item.departmentName}</div>}
                                </div>
                              </div>

                              {/* Public Remarks Timeline */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-display text-sm font-bold text-foreground">Public Remarks ({selectedComments.length})</h4>
                                </div>

                                {selectedComments.length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic p-3 bg-muted/15 rounded-md border border-border/50">
                                    No public remarks posted yet.
                                  </div>
                                ) : (
                                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                                    {selectedComments.map((c) => (
                                      <div key={c.id} className="rounded-md border border-border bg-background p-3 text-xs">
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                                            <span>{c.authorName || "User"}</span>
                                            <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                                              {c.authorRole || "Citizen"}
                                            </Badge>
                                          </div>
                                          <span>{formatDate(c.createdAt)}</span>
                                        </div>
                                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{c.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  </div>
                );
              })
            : null}
        </div>
      </section>
    </Layout>
  );
}

function formatStatus(value?: string) {
  if (!value) return "Pending";
  return value.replaceAll("_", " ").replace(/^./, (l) => l.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "Recently";
  return new Date(value).toLocaleDateString();
}

function formatCoordinates(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return "No location";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
