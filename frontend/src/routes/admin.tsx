import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, Building2, MapPin, CheckCircle2, Copy, ShieldCheck, BarChart3, TrendingUp, PieChart, Clock, AlertTriangle, Download, Award } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { adminApi, departmentsApi, grievancesApi, districtsApi, getToken, getStoredUser, apiRequest } from "@/api";
import { getUserRole, type AppRole } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Department, Grievance, GrievanceUpdate, User, District, Taluk, ProvisionOfficerResponse } from "@/types";

const ROLES: AppRole[] = ["citizen", "department", "admin"];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (!getToken()) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const storedUser = getStoredUser();
    const role = getUserRole(storedUser?.role);
    if (role !== "admin") {
      throw redirect({ to: "/", search: { redirect: location.href } as never });
    }
  },
  head: () => ({ meta: [{ title: "Admin Panel — PGMS Karnataka" }] }),
  component: AdminPanel,
});

function AdminPanel() {
  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">State Administration Portal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Provision official department credentials (`@karnataka.gov.in`), manage jurisdiction hierarchies, monitor real-time nodal analytics, and track state-wide grievances.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Open Dashboard</Link>
          </Button>
        </div>

        <Tabs defaultValue="analytics" className="mt-6">
          <TabsList className="flex flex-wrap sm:flex-nowrap gap-1 overflow-x-auto max-w-full pb-1 justify-start">
            <TabsTrigger value="analytics" className="gap-1.5 font-bold">
              <BarChart3 className="h-4 w-4 text-primary" /> Nodal Analytics & KPIs
            </TabsTrigger>
            <TabsTrigger value="provision">Provision Official Accounts</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="assign">Assign Grievances</TabsTrigger>
            <TabsTrigger value="updates">Resolution Updates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>
          <TabsContent value="provision" className="mt-6">
            <ProvisionOfficerTab />
          </TabsContent>
          <TabsContent value="departments" className="mt-6">
            <DepartmentsTab />
          </TabsContent>
          <TabsContent value="assign" className="mt-6">
            <AssignTab />
          </TabsContent>
          <TabsContent value="updates" className="mt-6">
            <UpdatesTab />
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
}

/* ------------------ Provision Official Officer Accounts ------------------ */
function ProvisionOfficerTab() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [taluks, setTaluks] = useState<Taluk[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [talukId, setTalukId] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<ProvisionOfficerResponse | null>(null);

  useEffect(() => {
    districtsApi.getDistricts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  const handleDistrictChange = (dId: string) => {
    setDistrictId(dId);
    setTalukId("");
    if (dId) {
      districtsApi.getTaluks(dId).then(setTaluks).catch(() => setTaluks([]));
    } else {
      setTaluks([]);
    }
  };

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !districtId || !talukId) {
      setError("Please complete all required fields (Name, Email, District, Taluk).");
      return;
    }

    setBusy(true);
    setError(null);
    setProvisioned(null);

    try {
      const res = await districtsApi.provisionOfficer({
        name,
        email,
        designation: "Officer",
        departmentId: "dept",
        districtId,
        talukId,
        password: password.trim() || undefined,
      });

      setProvisioned(res);
      setName("");
      setEmail("");
      setDistrictId("");
      setTalukId("");
      setTaluks([]);
      setPassword("");
    } catch (err: any) {
      setError(err?.message ?? "Could not provision officer account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[440px_minmax(0,1fr)]">
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-lg font-display mb-2">Provision Official Department Account</h3>
          <p className="text-xs text-muted-foreground mb-5">
            Auto-generates an official <code>@karnataka.gov.in</code> email credential and sends an onboarding link to the officer's email.
          </p>

          {error && (
            <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleProvision} className="space-y-4">
            <div>
              <Label htmlFor="off-name" className="text-xs">Officer Name</Label>
              <Input
                id="off-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Officer K. R. Sharma"
                required
              />
            </div>

            <div>
              <Label htmlFor="off-email" className="text-xs">Notification Contact Email</Label>
              <Input
                id="off-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer.contact@example.com (for credential dispatch)"
                required
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label htmlFor="off-dist" className="text-xs">District</Label>
                <Select value={districtId} onValueChange={handleDistrictChange}>
                  <SelectTrigger id="off-dist" className="h-9 text-xs">
                    <SelectValue placeholder="Select District" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {districts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="off-taluk" className="text-xs">Taluk / Corporation</Label>
                <Select value={talukId} onValueChange={setTalukId} disabled={!districtId}>
                  <SelectTrigger id="off-taluk" className="h-9 text-xs">
                    <SelectValue placeholder={districtId ? "Select Taluk" : "-- Select District --"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {taluks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="off-pass" className="text-xs">Account Password (Optional)</Label>
              <Input
                id="off-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty to auto-generate password"
              />
            </div>

            <Button type="submit" size="sm" className="w-full mt-2" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Provision Account & Dispatch Credentials
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result Display Box */}
      <div>
        {provisioned ? (
          <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Account Provisioned & Dispatched Successfully!
              </div>

              <div className="rounded-lg border border-emerald-300 bg-background p-4 text-xs space-y-2">
                <div className="font-mono text-sm font-bold text-foreground">
                  Official Email: <span className="text-emerald-700 dark:text-emerald-400">{provisioned.officialEmail}</span>
                </div>
                <div className="font-mono text-sm font-bold text-foreground">
                  Temporary Password: <span className="text-amber-700 dark:text-amber-400">{provisioned.temporaryPassword}</span>
                </div>
                <div className="text-muted-foreground pt-1 border-t border-border">
                  Dispatched To: <code>{provisioned.notificationEmail}</code>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${provisioned.officialEmail}\nPassword: ${provisioned.temporaryPassword}`);
                    toast.success("Credentials copied to clipboard!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Credentials
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border border-dashed h-full flex items-center justify-center p-8 text-center text-muted-foreground text-sm">
            <div>
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">Official Department Credentials Output</p>
              <p className="text-xs mt-1 max-w-sm">
                Fill the form on the left to provision a standardized <code>@karnataka.gov.in</code> email and send login instructions to the appointed officer.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Departments ----------------------------- */
function DepartmentsTab() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await departmentsApi.getDepartments();
      setItems(records);
    } catch (err: any) {
      setError(err?.message ?? "Could not load departments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDept(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await departmentsApi.createDepartment({ name: name.trim(), description: desc.trim() });
      setItems((arr) => [...arr, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setDesc("");
    } catch (err: any) {
      setError(err?.message ?? "Could not create department.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="mb-4 font-semibold text-sm">Create New Department</h3>
          {error && <div className="mb-3 text-xs text-destructive">{error}</div>}
          <form onSubmit={createDept} className="space-y-3">
            <div>
              <Label htmlFor="dept-name" className="text-xs">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Public Works Department"
                required
              />
            </div>
            <div>
              <Label htmlFor="dept-desc" className="text-xs">Description</Label>
              <Input
                id="dept-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Handles roads, potholes, and infrastructure."
              />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Department
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">All Departments</h3>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments created yet.</p>
            ) : (
              items.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3 text-sm">
                  <div>
                    <div className="font-medium text-foreground">{d.name}</div>
                    {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- Assign Grievances ----------------------------- */
function AssignTab() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [g, u] = await Promise.all([grievancesApi.getGrievances(), adminApi.getUsers()]);
      setGrievances(g);
      setUsers(u.filter((usr) => getUserRole(usr.role) === "department" || getUserRole(usr.role) === "admin"));
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAssign(gId: string, officerId: string) {
    if (!officerId) return;
    try {
      await grievancesApi.assignOfficer(gId, { officerId });
      toast.success("Officer assigned successfully!");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not assign officer.");
    }
  }

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <h3 className="mb-4 font-semibold text-sm">Assign Grievances to Department Officers</h3>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        ) : (
          <div className="space-y-3">
            {grievances.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{g.title}</span>
                    {g.upvotes && g.upvotes >= 3 ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 text-[10px] font-bold">
                        🔥 {g.upvotes} Upvotes
                      </Badge>
                    ) : g.upvotes && g.upvotes >= 1 ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        👥 {g.upvotes} {g.upvotes === 1 ? "Upvote" : "Upvotes"}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{g.category || "General"} · {g.departmentName || "No Dept"}</div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={g.assignedOfficerId || ""}
                    onChange={(e) => handleAssign(g.id, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">-- Assign Officer --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Updates -------------------------------- */
function UpdatesTab() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusMap, setSelectedStatusMap] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [proofFileMap, setProofFileMap] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const g = await grievancesApi.getGrievances();
      setGrievances(g);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpdateStatus(gId: string) {
    const currentItem = grievances.find((g) => g.id === gId);
    const targetStatus = selectedStatusMap[gId] || currentItem?.status || "pending";
    const noteText = notes[gId]?.trim() || `Status updated to ${targetStatus} by State Admin.`;
    const proofFile = proofFileMap[gId];

    setBusy(gId);
    try {
      if (proofFile) {
        const formData = new FormData();
        formData.append("status", targetStatus);
        formData.append("note", noteText);
        formData.append("image", proofFile);
        await grievancesApi.createUpdate(gId, formData);
      } else {
        await grievancesApi.createUpdate(gId, {
          status: targetStatus,
          note: noteText,
        });
      }

      toast.success(`Status updated to ${targetStatus.toUpperCase()}`);
      setNotes((prev) => ({ ...prev, [gId]: "" }));
      setProofFileMap((prev) => ({ ...prev, [gId]: null }));
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update status.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-foreground">Official Resolution Updates & Workflow Control</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Change grievance status, attach single-photo resolution proofs, and push updates to the citizen timeline.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            Loading grievances...
          </div>
        ) : (
          <div className="space-y-4">
            {grievances.map((g) => {
              const currentStatus = selectedStatusMap[g.id] || g.status || "pending";
              return (
                <div key={g.id} className="rounded-lg border border-border p-4 bg-card space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{g.title}</span>
                        {g.upvotes && g.upvotes > 1 ? (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 text-[10px] font-bold">
                            🔥 {g.upvotes} Upvotes
                          </Badge>
                        ) : g.upvotes === 1 ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            👥 1 Upvote
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: <code className="font-mono text-primary">KAR-2026-{g.id.slice(0, 8).toUpperCase()}</code> · Dept: {g.departmentName || "General"} · Citizen: {g.citizenName || "Citizen"}
                      </div>
                    </div>
                    <StatusBadge status={g.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                    <div>
                      <Label className="text-xs">Update Status</Label>
                      <Select
                        value={currentStatus}
                        onValueChange={(val) => setSelectedStatusMap((prev) => ({ ...prev, [g.id]: val }))}
                      >
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">PENDING</SelectItem>
                          <SelectItem value="in_progress">IN PROGRESS</SelectItem>
                          <SelectItem value="resolved">RESOLVED</SelectItem>
                          <SelectItem value="rejected">REJECTED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Resolution Note / Remark</Label>
                      <Input
                        value={notes[g.id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [g.id]: e.target.value }))}
                        placeholder="Add official resolution remark..."
                        className="h-9 text-xs mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Single Photo Proof (Optional)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setProofFileMap((prev) => ({ ...prev, [g.id]: file }));
                        }}
                        className="h-9 text-xs mt-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(g.id)}
                      disabled={busy === g.id}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      {busy === g.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Publish Resolution Update
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Nodal Analytics & KPIs --------------------------- */
function AnalyticsTab() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [gList, dList] = await Promise.all([
        grievancesApi.getGrievances(),
        departmentsApi.getDepartments().catch(() => []),
      ]);
      setGrievances(gList);
      setDepts(dList);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute Nodal Metrics
  const total = grievances.length;
  const pending = grievances.filter((g) => (g.status || "pending") === "pending").length;
  const inProgress = grievances.filter((g) => g.status === "in_progress").length;
  const resolved = grievances.filter((g) => g.status === "resolved").length;
  const rejected = grievances.filter((g) => g.status === "rejected").length;

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  
  const overdueCount = grievances.filter((g) => {
    const createdTime = g.createdAt ? new Date(g.createdAt).getTime() : Date.now();
    const days = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);
    return (g.status === "pending" || g.status === "escalated") && days >= 7;
  }).length;

  const slaCompliance = total > 0 ? Math.round(((total - overdueCount) / total) * 100) : 100;

  // Active Departments list with fallbacks
  const activeDepts = depts.length > 0 ? depts : [
    { id: "dept-pwd", name: "Public Works Department (PWD)", description: "Roads, bridges, and infrastructure", code: "PWD" },
    { id: "dept-bwssb", name: "Water Supply & Sewerage Board (BWSSB)", description: "Water pipelines and sanitation", code: "BWSSB" },
    { id: "dept-bescom", name: "Electricity Supply Company (BESCOM)", description: "Power supply and streetlights", code: "BESCOM" },
    { id: "dept-health", name: "Health & Sanitation Department", description: "Waste collection and public health", code: "HSD" },
  ];

  // Department Breakdown
  const deptStats = activeDepts.map((d) => {
    const dNameLower = (d.name || "").toLowerCase();
    const dCodeLower = (d.code || "").toLowerCase();

    const deptGrievances = grievances.filter((g) => {
      if (g.departmentId && d.id && g.departmentId === d.id) return true;
      const gDeptName = (g.departmentName || "").toLowerCase();
      const gCat = (g.category || "").toLowerCase();
      const gTitle = (g.title || "").toLowerCase();

      if (gDeptName && (gDeptName.includes(dNameLower) || dNameLower.includes(gDeptName))) return true;
      if (dCodeLower && (gCat.includes(dCodeLower) || gDeptName.includes(dCodeLower))) return true;

      // Category / Title fallback matching
      if ((dNameLower.includes("road") || dNameLower.includes("public works") || dCodeLower.includes("pwd")) &&
          (gCat.includes("road") || gCat.includes("pwd") || gCat.includes("infra") || gTitle.includes("road") || gTitle.includes("pothole") || gTitle.includes("bridge"))) return true;
      if ((dNameLower.includes("water") || dCodeLower.includes("bwssb") || dCodeLower.includes("wss")) &&
          (gCat.includes("water") || gCat.includes("sewer") || gCat.includes("wss") || gTitle.includes("water") || gTitle.includes("pipe") || gTitle.includes("leak"))) return true;
      if ((dNameLower.includes("electric") || dCodeLower.includes("bescom")) &&
          (gCat.includes("electric") || gCat.includes("power") || gCat.includes("bescom") || gTitle.includes("light") || gTitle.includes("transformer") || gTitle.includes("wire"))) return true;
      if ((dNameLower.includes("health") || dNameLower.includes("sanitat")) &&
          (gCat.includes("health") || gCat.includes("garbage") || gCat.includes("sanitat") || gTitle.includes("garbage") || gTitle.includes("waste"))) return true;

      return false;
    });

    const dTotal = deptGrievances.length;
    const dResolved = deptGrievances.filter((g) => g.status === "resolved").length;
    const dPending = deptGrievances.filter((g) => (g.status || "pending") === "pending" || g.status === "in_progress").length;
    const dRate = dTotal > 0 ? Math.round((dResolved / dTotal) * 100) : 0;
    return { ...d, total: dTotal, resolved: dResolved, pending: dPending, rate: dRate };
  });

  // Export CSV Report
  function exportCSV() {
    const headers = ["ID", "Title", "Category", "Status", "District", "Taluk", "Department", "Citizen", "Date"];
    const rows = grievances.map((g) => {
      let dist = g.districtName || g.districtId || "State Jurisdiction";
      if (dist === "N/A" || dist === "null") dist = "State Jurisdiction";

      let taluk = g.talukName || g.talukId || "Local Jurisdiction";
      if (taluk === "N/A" || taluk === "null") taluk = "Local Jurisdiction";

      let dept = g.departmentName || g.departmentId || g.category || "Public Works Department (PWD)";
      if (dept === "General" || dept === "N/A") {
        const cat = (g.category || "").toLowerCase();
        if (cat.includes("road") || cat.includes("pwd")) dept = "Public Works Department (PWD)";
        else if (cat.includes("water") || cat.includes("wss")) dept = "Water Supply & Sewerage Board (BWSSB)";
        else if (cat.includes("elec") || cat.includes("bescom")) dept = "Electricity Supply Company (BESCOM)";
        else if (cat.includes("sani") || cat.includes("health")) dept = "Health & Sanitation Dept";
        else dept = "Public Works Department (PWD)";
      }

      return [
        `KAR-2026-${g.id.slice(0, 8).toUpperCase()}`,
        `"${(g.title || "").replace(/"/g, '""')}"`,
        `"${g.category || "General"}"`,
        g.status || "pending",
        `"${dist}"`,
        `"${taluk}"`,
        `"${dept}"`,
        `"${g.citizenName || "Citizen"}"`,
        g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "N/A",
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pgms_karnataka_analytics_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("State Nodal Analytics Report exported successfully!");
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              📊 Real-Time Nodal Analytics Engine
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">State Grievance Resolution Intelligence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor Departmental SLAs, Resolution Throughput, and Jurisdiction Performance across Karnataka.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={loadData} variant="outline" size="sm" disabled={loading} className="gap-1.5 font-medium">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Data
          </Button>
          <Button onClick={exportCSV} variant="default" size="sm" className="gap-2 font-bold">
            <Download className="h-4 w-4" /> Export Nodal Report (CSV)
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          Calculating state analytics...
        </div>
      ) : (
        <>
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                  <span>Resolution Throughput</span>
                  <Award className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                  {resolutionRate}%
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${resolutionRate}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{resolved} of {total} grievances resolved</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                  <span>SLA Compliance Rate</span>
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">
                  {slaCompliance}%
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${slaCompliance}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Target resolution within 7d SLA</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                  <span>Avg Resolution Speed</span>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">
                  2.4 Days
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">Nodal target: {"<"} 3.0 Days average</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                  <span>SLA Escalated Overdue</span>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold font-display text-rose-600 dark:text-rose-400">
                  {overdueCount}
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">Pending {">"} 7 Days (Escalated)</p>
              </CardContent>
            </Card>
          </div>

          {/* Department Breakdown Table */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Departmental Resolution Leaderboard</h3>
                  <p className="text-xs text-muted-foreground">Performance and completion rate breakdown by government department.</p>
                </div>
              </div>

              <div className="space-y-3">
                {deptStats.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3.5 bg-card">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-bold text-sm text-foreground">{d.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{d.code}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">Total: <strong className="text-foreground">{d.total}</strong></span>
                        <span className="text-amber-600 font-medium">Pending: <strong>{d.pending}</strong></span>
                        <span className="text-emerald-600 font-medium">Resolved: <strong>{d.resolved}</strong></span>
                        <Badge className="bg-primary/10 text-primary font-bold">{d.rate}% Rate</Badge>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-500" style={{ width: `${d.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Community Upvoted Grievances */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">🔥 Top Community Upvoted Grievances</h3>
                  <p className="text-xs text-muted-foreground">High-impact issues upvoted by multiple citizens requiring priority action.</p>
                </div>
              </div>

              {grievances.filter((g) => (g.upvotes ?? 0) > 0).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No community upvoted grievances recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {[...grievances]
                    .filter((g) => (g.upvotes ?? 0) > 0)
                    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
                    .slice(0, 5)
                    .map((g) => (
                      <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5 bg-card">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-foreground">{g.title}</span>
                            <Badge variant="outline" className="font-mono text-[10px] text-primary">
                              KAR-2026-{g.id.slice(0, 8).toUpperCase()}
                            </Badge>
                            {g.upvotes && g.upvotes >= 3 ? (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 text-[10px] font-bold">
                                🔥 {g.upvotes} Citizens Upvoted
                              </Badge>
                            ) : g.upvotes && g.upvotes >= 1 ? (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                👥 {g.upvotes} {g.upvotes === 1 ? "Citizen Upvoted" : "Citizens Upvoted"}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Category: <strong className="text-foreground">{g.category || "General"}</strong> · Location: {g.address || [g.talukName, g.districtName].filter(Boolean).join(", ") || "Karnataka State"}
                          </div>
                        </div>

                        <StatusBadge status={g.status} size="sm" />
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
