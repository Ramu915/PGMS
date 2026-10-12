import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, Loader2, MapPin, Send, UserCheck, ShieldAlert, Lock, Unlock, Printer, AlertTriangle, FileCheck2, Camera } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { grievancesApi, getFileUrl, adminApi } from "@/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Grievance, GrievanceUpdate, GrievanceComment, User } from "@/types";

export const Route = createFileRoute("/grievances/$id")({
  head: () => ({ meta: [{ title: "Grievance Details — PGMS" }] }),
  component: GrievanceDetail,
});

function GrievanceDetail() {
  const { id } = useParams({ from: "/grievances/$id" });
  const [item, setItem] = useState<Grievance | null>(null);
  const [updates, setUpdates] = useState<GrievanceUpdate[]>([]);
  const [comments, setComments] = useState<GrievanceComment[]>([]);
  const [officers, setOfficers] = useState<User[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const { user } = useAuth();

  const isOfficerOrAdmin = user?.role === "admin" || user?.role === "department";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const g = await grievancesApi.getGrievanceById(id);
      setItem(g);
      setSelectedOfficerId(g.assignedOfficerId || "");

      try {
        const u = await grievancesApi.getUpdates(id);
        setUpdates(u);
      } catch {
        setUpdates([]);
      }

      try {
        const c = await grievancesApi.getComments(id);
        setComments(c);
      } catch {
        setComments([]);
      }

      if (isOfficerOrAdmin) {
        try {
          const usersList = await adminApi.getUsers();
          const officerList = usersList.filter(
            (u) => u.role === "department" || u.role === "admin"
          );
          setOfficers(officerList);
        } catch {
          // Ignore if user list restricted
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not load grievance details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignOfficer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOfficerId) return;
    setAssigning(true);
    try {
      await grievancesApi.assignOfficer(id, {
        officerId: selectedOfficerId,
        note: assignNote.trim(),
      });
      setAssignNote("");
      toast.success("Officer assigned successfully!", {
        description: "The assigned officer will now receive updates on this grievance.",
      });
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not assign officer.");
    } finally {
      setAssigning(false);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setPosting(true);
    try {
      const created = await grievancesApi.addComment(id, {
        text: text.trim(),
        isInternal: isOfficerOrAdmin ? isInternal : false,
      });
      setComments((prev) => [...prev, created]);
      setText("");
      setIsInternal(false);
      toast.success(isInternal ? "Internal note added." : "Remark posted successfully!");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not post remark/comment.");
    } finally {
      setPosting(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.role]);

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading grievance details…</p>
        </div>
      </Layout>
    );
  }

  if (error || !item) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error || "Grievance not found."}
          </div>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/grievances">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Grievances
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const images = Array.isArray(item.images) ? item.images : item.images ? [item.images] : [];
  const citizenName = item.citizenName || item.citizen?.name || item.citizen?.email || "Citizen";
  const assignedOfficerName = item.assignedOfficerName;
  const refCode = `KAR-2026-${item.id.slice(0, 8).toUpperCase()}`;

  // SLA Overdue Calculation (> 7 days in pending state)
  const createdAtTime = item.createdAt || item.created ? new Date(item.createdAt || item.created!).getTime() : Date.now();
  const daysPending = Math.floor((Date.now() - createdAtTime) / (1000 * 60 * 60 * 24));
  const isOverdue = (item.status === "pending" || item.status === "escalated") && daysPending >= 7;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        {/* Printable Receipt styling */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-receipt, #printable-receipt * { visibility: visible; }
            #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; color: black; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <Link
            to="/grievances"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to all grievances
          </Link>

          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-2 shrink-0">
            <Printer className="h-4 w-4" /> Print / Download Official Receipt
          </Button>
        </div>

        {/* SLA Overdue Warning Alert */}
        {isOverdue && (
          <div className="no-print mb-6 rounded-xl border border-rose-400/50 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs md:text-sm text-rose-900 dark:text-rose-200 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold flex items-center gap-2 text-rose-700 dark:text-rose-300">
                🚨 SLA Overdue Alert (Pending for {daysPending} Days)
              </div>
              <p className="mt-0.5 leading-relaxed text-rose-800/90 dark:text-rose-300/90 text-xs">
                This public grievance has exceeded the 7-day Service Level Agreement without resolution. It has been automatically flagged for priority nodal officer attention.
              </p>
            </div>
          </div>
        )}

        <div id="printable-receipt" className="space-y-6">
          {/* Printable Receipt Header Banner (Visible in Print) */}
          <div className="hidden print:block border-b-2 border-black pb-4 mb-6 text-center">
            <h2 className="text-xl font-bold uppercase tracking-wider">GOVERNMENT OF KARNATAKA</h2>
            <p className="text-xs font-semibold uppercase">PUBLIC GRIEVANCE REDRESSAL PORTAL (PGMS)</p>
            <p className="text-[10px] mt-1 text-gray-600">Official Complaint Acknowledgement & Tracking Document</p>
            <div className="mt-3 inline-block border border-black px-3 py-1 font-mono text-sm font-bold">
              REF NO: {refCode}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{item.title}</h1>
                <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                  {refCode}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{item.category || "General"}</Badge>
                <StatusBadge status={item.status} size="md" />
                {isOverdue && (
                  <Badge variant="destructive" className="bg-rose-600 text-white font-bold text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> SLA OVERDUE ({daysPending}d)
                  </Badge>
                )}
                {assignedOfficerName && (
                  <Badge variant="default" className="bg-emerald-600 text-white flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Assigned: {assignedOfficerName}
                  </Badge>
                )}
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDate(item.createdAt || item.created)}
                </span>
                {typeof item.latitude === "number" && typeof item.longitude === "number" ? (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

        <div className="grid gap-6">
          {/* Grievance Details Card */}
          <Card className="border-border">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="font-display text-lg mb-2">Description</h3>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{item.description}</p>
              </div>

              {images.length > 0 && (
                <div>
                  <h3 className="font-display text-lg mb-3">Attached Proof / Images</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {images.map((img) => (
                      <div key={img} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                        <img src={getFileUrl(img)} alt={item.title} className="w-full h-64 object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                <div>
                  Reported by: <span className="font-medium text-foreground">{citizenName}</span>
                </div>
                {item.departmentName && (
                  <div>
                    Department: <span className="font-medium text-foreground">{item.departmentName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Officer Assignment Panel (Admins & Department Officers Only) */}
          {isOfficerOrAdmin && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg">Officer Assignment & Management</h3>
                </div>
                <form onSubmit={handleAssignOfficer} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Select Assigned Officer
                      </label>
                      <select
                        value={selectedOfficerId}
                        onChange={(e) => setSelectedOfficerId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- Unassigned --</option>
                        {officers.map((off) => (
                          <option key={off.id} value={off.id}>
                            {off.name || off.email} ({off.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Assignment Note / Instruction
                      </label>
                      <input
                        type="text"
                        value={assignNote}
                        onChange={(e) => setAssignNote(e.target.value)}
                        placeholder="e.g. Please inspect site within 24h"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={assigning || !selectedOfficerId}>
                      {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                      Update Officer Assignment
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Resolution Timeline */}
          <Card className="border-border">
            <CardContent className="p-6">
              <h3 className="font-display text-lg mb-4">Resolution Timeline & Status Updates</h3>
              {updates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No official status updates recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {updates.map((u) => {
                    const updaterName = u.authorName || "Official Response";
                    const updateImages = Array.isArray(u.images) ? u.images : [];
                    return (
                      <div key={u.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{updaterName}</span>
                          <span>{formatDate(u.createdAt || u.created)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={u.status} size="sm" />
                          {updateImages.length > 0 && (
                            <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 gap-1">
                              <Camera className="h-3 w-3" /> {updateImages.length} Resolution Photo Proof Attached
                            </Badge>
                          )}
                        </div>
                        {u.note && <p className="text-sm text-foreground">{u.note}</p>}
                        {updateImages.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            {updateImages.map((img) => (
                              <div key={img} className="overflow-hidden rounded-md border border-border bg-muted/40">
                                <img src={getFileUrl(img)} alt="Resolution Proof" className="h-36 w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Remarks & Discussion Timeline */}
          <Card className="border-border">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg">Remarks & Discussion Timeline</h3>
                {isOfficerOrAdmin && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                    <ShieldAlert className="h-3 w-3 mr-1" /> Officer Internal View Active
                  </Badge>
                )}
              </div>

              {user ? (
                <form onSubmit={addComment} className="space-y-3">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      isOfficerOrAdmin
                        ? "Write a public update or internal officer remark..."
                        : "Add a public comment or relevant context..."
                    }
                    className="min-h-[90px] text-sm"
                  />

                  <div className="flex items-center justify-between">
                    {isOfficerOrAdmin ? (
                      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary"
                        />
                        {isInternal ? (
                          <span className="flex items-center text-amber-600 font-semibold">
                            <Lock className="h-3.5 w-3.5 mr-1" /> Internal Officer Note (Hidden from Citizen)
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Unlock className="h-3.5 w-3.5 mr-1" /> Public Remark (Visible to Citizen)
                          </span>
                        )}
                      </label>
                    ) : <div />}

                    <Button type="submit" size="sm" disabled={posting || !text.trim()}>
                      {posting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      Post {isInternal ? "Internal Note" : "Remark"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Please <Link to="/login" className="text-primary underline">sign in</Link> to post remarks or comments.
                </p>
              )}

              <div className="space-y-3 pt-2">
                {comments.filter((c) => isOfficerOrAdmin || !c.isInternal).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No remarks posted yet.</p>
                ) : (
                  comments.filter((c) => isOfficerOrAdmin || !c.isInternal).map((c) => {
                    const isNoteInternal = c.isInternal;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-md border p-3.5 text-sm ${
                          isNoteInternal
                            ? "border-amber-300/50 bg-amber-500/10 dark:bg-amber-950/20"
                            : "border-border bg-muted/10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{c.authorName || "User"}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {c.authorRole || "Citizen"}
                            </Badge>
                            {isNoteInternal && (
                              <Badge variant="secondary" className="bg-amber-600 text-white text-[10px]">
                                <Lock className="h-2.5 w-2.5 mr-0.5" /> Internal Note
                              </Badge>
                            )}
                          </div>
                          <span>{formatDate(c.createdAt)}</span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap mt-1">{c.text}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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
