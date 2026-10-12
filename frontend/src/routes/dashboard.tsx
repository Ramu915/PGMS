import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  Unlock,
  ShieldAlert,
  MessageSquare,
  FileText,
  UserCheck,
  Globe,
  Landmark as LandmarkIcon,
  Navigation,
  Camera,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grievancesApi, getFileUrl, getToken, getStoredUser, districtsApi } from "@/api";
import { getUserRole, useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Grievance, GrievanceUpdate, GrievanceComment, District, Taluk } from "@/types";

const STATUSES = ["pending", "in_progress", "resolved", "rejected"] as const;
const CATEGORIES = ["all", "roads", "water", "electricity", "sanitation", "other"];

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ location }) => {
    if (!getToken()) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const storedUser = getStoredUser();
    const role = getUserRole(storedUser?.role);
    if (role !== "department" && role !== "admin") {
      throw redirect({ to: "/", search: { redirect: location.href } as never });
    }
  },
  head: () => ({ meta: [{ title: "Department Officer Workstation — PGMS" }] }),
  component: DepartmentDashboard,
});

function DepartmentDashboard() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Action states
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Record<string, "update" | "comments">>({});

  // Comments & Updates per grievance
  const [commentsMap, setCommentsMap] = useState<Record<string, GrievanceComment[]>>({});
  const [updatesMap, setUpdatesMap] = useState<Record<string, GrievanceUpdate[]>>({});
  const [selectedStatusMap, setSelectedStatusMap] = useState<Record<string, string>>({});
  const [proofFileMap, setProofFileMap] = useState<Record<string, File | null>>({});
  const [commentTextMap, setCommentTextMap] = useState<Record<string, string>>({});
  const [internalFlags, setInternalFlags] = useState<Record<string, boolean>>({});
  const [postingComment, setPostingComment] = useState<string | null>(null);

  const { user, role } = useAuth();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await grievancesApi.getGrievances({
        sort: "-createdAt",
        districtId: user?.districtId,
        talukId: user?.talukId,
      });
      setItems(records);

      // Pre-load updates and comments for all grievances
      records.forEach((g) => {
        loadComments(g.id);
        loadUpdates(g.id);
      });
    } catch (err: any) {
      setError(err?.message ?? "Could not load dashboard grievances.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadComments(grievanceId: string) {
    try {
      const c = await grievancesApi.getComments(grievanceId);
      setCommentsMap((prev) => ({ ...prev, [grievanceId]: c }));
    } catch {
      // Ignore if fail
    }
  }

  async function loadUpdates(grievanceId: string) {
    try {
      const u = await grievancesApi.getUpdates(grievanceId);
      setUpdatesMap((prev) => ({ ...prev, [grievanceId]: u }));
    } catch {
      // Ignore if fail
    }
  }

  async function updateStatus(grievanceId: string, customStatus?: string) {
    const currentItem = items.find((g) => g.id === grievanceId);
    const targetStatus = customStatus || selectedStatusMap[grievanceId] || currentItem?.status || "pending";
    const noteText = notes[grievanceId]?.trim() || `Status set to ${formatStatus(targetStatus)}`;
    const proofFile = proofFileMap[grievanceId];

    setBusy(grievanceId);
    setError(null);
    try {
      if (proofFile) {
        const formData = new FormData();
        formData.append("status", targetStatus);
        formData.append("note", noteText);
        formData.append("image", proofFile);
        await grievancesApi.createUpdate(grievanceId, formData);
      } else {
        await grievancesApi.createUpdate(grievanceId, {
          status: targetStatus,
          note: noteText,
          adminId: role === "admin" ? user?.id : undefined,
          userId: role === "department" ? user?.id : undefined,
        });
      }

      setItems((prev) =>
        prev.map((g) => (g.id === grievanceId ? { ...g, status: targetStatus } : g))
      );
      setNotes((prev) => ({ ...prev, [grievanceId]: "" }));
      setProofFileMap((prev) => ({ ...prev, [grievanceId]: null }));
      toast.success(`Resolution update published (${formatStatus(targetStatus)})`, {
        description: proofFile
          ? "Resolution note and photo proof saved to timeline."
          : "Official update note saved to public resolution timeline.",
      });
      await loadUpdates(grievanceId);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to update grievance status.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function postComment(grievanceId: string) {
    const text = commentTextMap[grievanceId]?.trim();
    if (!text || !user) return;

    const isInternal = internalFlags[grievanceId] ?? false;
    setPostingComment(grievanceId);
    try {
      await grievancesApi.addComment(grievanceId, {
        text,
        isInternal,
      });
      await loadComments(grievanceId);
      setCommentTextMap((prev) => ({ ...prev, [grievanceId]: "" }));
      setInternalFlags((prev) => ({ ...prev, [grievanceId]: false }));
      toast.success(isInternal ? "Internal officer note recorded." : "Public remark posted successfully!");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not post remark.");
    } finally {
      setPostingComment(null);
    }
  }

  // Filtered grievances
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((g) => {
      if (statusFilter !== "all" && (g.status ?? "pending") !== statusFilter) return false;
      if (categoryFilter !== "all" && g.category !== categoryFilter) return false;

      if (
        q &&
        !`${g.title} ${g.description} ${g.address} ${g.landmark} ${g.districtName} ${g.talukName} ${g.id}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [items, search, statusFilter, categoryFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const pending = items.filter((i) => (i.status || "pending") === "pending").length;
    const inProgress = items.filter((i) => i.status === "in_progress").length;
    const resolved = items.filter((i) => i.status === "resolved").length;
    const overdue = items.filter((i) => {
      const createdAt = i.createdAt || i.created ? new Date(i.createdAt || i.created!).getTime() : Date.now();
      const days = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      return (i.status === "pending" || i.status === "escalated") && days >= 7;
    }).length;
    return { total, pending, inProgress, resolved, overdue };
  }, [items]);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {/* Officer Welcome Header */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Building2 className="h-3.5 w-3.5" /> Department Officer Workstation
                </span>
                {user?.officialEmail && (
                  <Badge variant="outline" className="font-mono text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                    {user.officialEmail}
                  </Badge>
                )}
                {metrics.overdue > 0 && (
                  <Badge variant="destructive" className="bg-rose-600 text-white font-bold text-xs animate-pulse">
                    🚨 {metrics.overdue} SLA Overdue ({">"}7d)
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Welcome back, {user?.name || "Officer"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.designation || "Officer"} · Track assigned public grievances and publish resolution updates.
              </p>
            </div>
            <Button variant="outline" onClick={load} disabled={loading} className="shrink-0 gap-2">
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh Feed
            </Button>
          </div>

          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mt-6 pt-6 border-t border-border">
            <div className="rounded-lg border border-border bg-muted/20 p-3.5">
              <div className="text-2xl font-bold font-display text-foreground">{metrics.total}</div>
              <div className="text-xs text-muted-foreground font-medium mt-0.5">Total Assigned</div>
            </div>
            <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5">
              <div className="text-2xl font-bold font-display text-amber-800 dark:text-amber-300">{metrics.pending}</div>
              <div className="text-xs text-amber-900/80 dark:text-amber-300/80 font-medium mt-0.5">Action Needed (Pending)</div>
            </div>
            <div className="rounded-lg border border-rose-300/40 bg-rose-50/50 dark:bg-rose-950/20 p-3.5">
              <div className="text-2xl font-bold font-display text-rose-800 dark:text-rose-300">{metrics.overdue}</div>
              <div className="text-xs text-rose-900/80 dark:text-rose-300/80 font-medium mt-0.5">SLA Overdue ({">"}7 Days)</div>
            </div>
            <div className="rounded-lg border border-blue-300/40 bg-blue-50/50 dark:bg-blue-950/20 p-3.5">
              <div className="text-2xl font-bold font-display text-blue-800 dark:text-blue-300">{metrics.inProgress}</div>
              <div className="text-xs text-blue-900/80 dark:text-blue-300/80 font-medium mt-0.5">Under Repair (In Progress)</div>
            </div>
            <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
              <div className="text-2xl font-bold font-display text-emerald-800 dark:text-emerald-300">{metrics.resolved}</div>
              <div className="text-xs text-emerald-900/80 dark:text-emerald-300/80 font-medium mt-0.5">Resolved</div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-4 mb-6">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, address, landmark, ref..."
              className="pl-9 text-sm h-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-sm h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="text-sm h-10">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "All Categories" : formatStatus(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-6">
                  <div className="h-5 w-40 rounded bg-muted" />
                  <div className="mt-3 h-4 w-full rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-12 text-center text-muted-foreground text-sm space-y-2">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <div className="font-semibold text-foreground text-base">No grievances found</div>
              <p>Try adjusting your search query or status filters.</p>
            </CardContent>
          </Card>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="space-y-5">
            {filtered.map((item) => {
              const imageNames = Array.isArray(item.images) ? item.images : item.images ? [item.images] : [];
              const imageName = imageNames[0];
              const tab = activeTab[item.id] || "update";
              const commentsList = commentsMap[item.id] || item.comments || [];
              const updatesList = updatesMap[item.id] || item.updates || [];
              const currentSelectedStatus = selectedStatusMap[item.id] || item.status || "pending";

              return (
                <Card key={item.id} className="border-border shadow-[var(--shadow-soft)] overflow-hidden">
                  <CardContent className="p-5 md:p-6 grid gap-6 md:grid-cols-[220px_1fr]">
                    <div className="overflow-hidden rounded-md border border-border bg-muted/30">
                      {imageName ? (
                        <img
                          src={getFileUrl(imageName)}
                          alt={item.title}
                          className="h-48 w-full object-cover transition-transform duration-300 hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                          No Image Uploaded
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="font-display text-xl font-bold text-foreground">{item.title}</h2>
                            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                              KAR-2026-{item.id.slice(0, 8).toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{item.category || "General"}</Badge>
                            {(item.upvotes ?? 0) >= 3 ? (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold gap-1">
                                🔥 High Priority ({item.upvotes} Citizens Upvoted)
                              </Badge>
                            ) : (item.upvotes ?? 0) >= 1 ? (
                              <Badge variant="outline" className="bg-muted/50 text-muted-foreground text-[10px]">
                                👥 {item.upvotes} {item.upvotes === 1 ? "Citizen Upvoted" : "Citizens Upvoted"}
                              </Badge>
                            ) : null}
                            {item.citizenName || item.citizen?.name ? (
                              <Badge variant="outline" className="bg-primary/5 text-foreground">
                                👤 By: {item.citizenName || item.citizen?.name}
                              </Badge>
                            ) : null}
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {formatDate(item.createdAt || item.created)}
                            </span>
                            {typeof item.latitude === "number" && typeof item.longitude === "number" ? (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <StatusBadge status={item.status} size="md" />
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>

                      {/* Location & Address Box */}
                      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                            <strong className="text-foreground">Location Address:</strong> {item.address || "Street address not specified"}
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
                        {item.assignedOfficerName && (
                          <div className="text-[11px] text-muted-foreground pl-5 flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <UserCheck className="h-3 w-3" />
                            <strong>Assigned Official:</strong> {item.assignedOfficerName}
                          </div>
                        )}
                      </div>

                      {/* Embedded Action Workstation Box */}
                      <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-4">
                        {/* Workstation Tabs */}
                        <div className="flex items-center gap-2 border-b border-border pb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab((prev) => ({ ...prev, [item.id]: "update" }));
                              loadUpdates(item.id);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                              tab === "update"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Resolution Update
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab((prev) => ({ ...prev, [item.id]: "comments" }));
                              loadComments(item.id);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                              tab === "comments"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Remarks ({commentsList.length})
                          </button>
                          <Link
                            to="/grievances/$id"
                            params={{ id: item.id }}
                            className="ml-auto text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            Full Detail Page →
                          </Link>
                        </div>

                        {/* TAB 1: Status & Resolution Note */}
                        {tab === "update" && (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="space-y-3 rounded-lg border border-border/80 bg-background p-3.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="text-xs font-bold text-foreground">
                                  Select Target Status for Update:
                                </label>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {STATUSES.map((st) => {
                                    const isSelected = currentSelectedStatus === st;
                                    let colorStyle = "";
                                    if (st === "resolved")
                                      colorStyle = isSelected
                                        ? "bg-emerald-600 text-white shadow-xs border-emerald-700"
                                        : "hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300";
                                    else if (st === "rejected")
                                      colorStyle = isSelected
                                        ? "bg-rose-600 text-white shadow-xs border-rose-700"
                                        : "hover:border-rose-500 hover:text-rose-700 dark:hover:text-rose-300";
                                    else if (st === "in_progress")
                                      colorStyle = isSelected
                                        ? "bg-blue-600 text-white shadow-xs border-blue-700"
                                        : "hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-300";
                                    else if (st === "pending")
                                      colorStyle = isSelected
                                        ? "bg-amber-600 text-white shadow-xs border-amber-700"
                                        : "hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300";

                                    return (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => setSelectedStatusMap((prev) => ({ ...prev, [item.id]: st }))}
                                        className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all border ${
                                          isSelected ? colorStyle : "border-border text-muted-foreground hover:bg-muted"
                                        }`}
                                      >
                                        {isSelected ? `✓ ${formatStatus(st)}` : formatStatus(st)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <Textarea
                                placeholder="Type official resolution update, site inspection notes, or progress details..."
                                value={notes[item.id] || ""}
                                onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                className="text-xs min-h-[70px] bg-muted/20"
                              />

                              {/* Resolution Proof Photo Input (1 Photo) */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
                                <label className="flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground cursor-pointer">
                                  <Camera className="h-4 w-4 text-primary shrink-0" />
                                  <span>{proofFileMap[item.id] ? "Change Resolution Proof Photo" : "Attach Resolution Proof Photo (1 Photo)"}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      setProofFileMap((prev) => ({ ...prev, [item.id]: file }));
                                    }}
                                  />
                                </label>

                                {proofFileMap[item.id] && (
                                  <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                    <span className="truncate max-w-[140px]">📷 {proofFileMap[item.id]?.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => setProofFileMap((prev) => ({ ...prev, [item.id]: null }))}
                                      className="text-rose-600 hover:text-rose-800 font-bold ml-1"
                                      title="Remove image"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-muted-foreground">
                                  Updating as: <strong className="text-foreground">{user?.name || "Officer"}</strong>
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy === item.id}
                                  onClick={() => updateStatus(item.id)}
                                  className="text-xs h-8 gap-1.5 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                                >
                                  {busy === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  Publish Resolution Update
                                </Button>
                              </div>
                            </div>

                            {/* Resolution History / Timeline */}
                            <div className="space-y-2 pt-2 border-t border-border/60">
                              <div className="text-xs font-bold text-foreground flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <RefreshCw className="h-3 w-3 text-primary" />
                                  Resolution History & Official Timeline ({updatesList.length})
                                </span>
                              </div>
                              {updatesList.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No official status updates recorded yet.</p>
                              ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                  {updatesList.map((u) => {
                                    const proofImages = Array.isArray(u.images) ? u.images : [];
                                    return (
                                      <div key={u.id} className="rounded-md border border-border bg-background p-2.5 text-xs space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-foreground">{u.authorName || "Official Response"}</span>
                                            <StatusBadge status={u.status} size="sm" />
                                            {proofImages.length > 0 && (
                                              <Badge variant="outline" className="text-[9px] text-emerald-700 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0">
                                                📷 Photo Proof Attached
                                              </Badge>
                                            )}
                                          </div>
                                          <span>{formatDate(u.createdAt || u.created)}</span>
                                        </div>
                                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{u.note}</p>
                                        {proofImages.length > 0 && (
                                          <div className="flex flex-wrap gap-2 pt-1.5">
                                            {proofImages.map((img) => (
                                              <div key={img} className="overflow-hidden rounded-md border border-border bg-muted/40">
                                                <img src={getFileUrl(img)} alt="Resolution Proof" className="h-20 w-32 object-cover" />
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
                        )}

                        {/* TAB 2: Embedded Comments & Remarks */}
                        {tab === "comments" && (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Type a public remark or internal officer note..."
                                value={commentTextMap[item.id] || ""}
                                onChange={(e) =>
                                  setCommentTextMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className="text-xs min-h-[60px] bg-background"
                              />

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={internalFlags[item.id] ?? false}
                                    onChange={(e) =>
                                      setInternalFlags((prev) => ({ ...prev, [item.id]: e.target.checked }))
                                    }
                                    className="rounded border-input text-primary focus:ring-primary"
                                  />
                                  {internalFlags[item.id] ? (
                                    <span className="flex items-center text-amber-600 font-semibold">
                                      <Lock className="h-3.5 w-3.5 mr-1" /> Internal Officer Note (Hidden from Citizen)
                                    </span>
                                  ) : (
                                    <span className="flex items-center">
                                      <Unlock className="h-3.5 w-3.5 mr-1" /> Public Remark (Visible to Public)
                                    </span>
                                  )}
                                </label>

                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={postingComment === item.id || !commentTextMap[item.id]?.trim()}
                                  onClick={() => postComment(item.id)}
                                  className="text-xs h-8 gap-1 font-semibold"
                                >
                                  {postingComment === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  Post Remark
                                </Button>
                              </div>
                            </div>

                            {/* Comments History */}
                            <div className="space-y-2.5 pt-2 border-t border-border/60">
                              {commentsList.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No remarks posted yet.</p>
                              ) : (
                                commentsList.map((c) => (
                                  <div
                                    key={c.id}
                                    className={`rounded-md border p-3 text-xs ${
                                      c.isInternal
                                        ? "border-amber-300/50 bg-amber-500/10 dark:bg-amber-950/20"
                                        : "border-border bg-background"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                                        <span>{c.authorName || "User"}</span>
                                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                                          {c.authorRole || "Officer"}
                                        </Badge>
                                        {c.isInternal && (
                                          <Badge variant="secondary" className="bg-amber-600 text-white text-[9px] px-1.5 py-0">
                                            <Lock className="h-2 w-2 mr-0.5" /> Internal
                                          </Badge>
                                        )}
                                      </div>
                                      <span>{formatDate(c.createdAt)}</span>
                                    </div>
                                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{c.text}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
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
