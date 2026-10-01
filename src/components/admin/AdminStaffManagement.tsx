import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Loader2, UserPlus, Trash2, KeyRound, ShieldCheck, ShieldOff, Clock, MapPin } from "lucide-react";
import { AdminStaffPayroll } from "@/components/admin/AdminStaffPayroll";

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  monthly_salary: number;
  expected_check_in: string | null;
  expected_check_out: string | null;
}
interface Att {
  id: string;
  admin_staff_id: string;
  attendance_date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean | null;
  worked_minutes: number | null;
  geo_verified: boolean | null;
}

export function AdminStaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const load = async () => {
    setLoading(true);
    const d = new Date(month + "-01");
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("admin_staff").select("*").order("created_at"),
      supabase
        .from("admin_attendance")
        .select("*")
        .gte("attendance_date", format(startOfMonth(d), "yyyy-MM-dd"))
        .lte("attendance_date", format(endOfMonth(d), "yyyy-MM-dd"))
        .order("attendance_date", { ascending: false }),
    ]);
    setStaff((s ?? []) as Staff[]);
    setAtt((a ?? []) as Att[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-admin-staff", { body });
    setBusy(false);
    const msg = error?.message || (data as { error?: string })?.error;
    if (msg) {
      toast({ title: "Something went wrong", description: msg, variant: "destructive" });
      return false;
    }
    toast({ title: ok });
    void load();
    return true;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call({ action: "create", ...form }, "Admin account created")) {
      setForm({ name: "", email: "", phone: "", password: "" });
    }
  };

  const saveTiming = async (s: Staff, field: "expected_check_in" | "expected_check_out", v: string) => {
    await supabase.from("admin_staff").update({ [field]: v || null }).eq("id", s.id);
    void load();
  };

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add Admin Staff</CardTitle>
          <CardDescription>Admin staff sign in at /admin and mark attendance by location.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>Password</Label><Input required minLength={6} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Admin Staff ({staff.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin staff yet.</p>
          ) : staff.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border">
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium flex items-center gap-2">
                  {s.name}
                  <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Blocked"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{s.email}{s.phone ? ` · ${s.phone}` : ""}</div>
                <div className="text-xs text-muted-foreground mt-1">Salary: ₹{Number(s.monthly_salary || 0).toLocaleString("en-IN")}</div>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" />
                <Input type="time" className="h-8 w-28" defaultValue={s.expected_check_in?.slice(0, 5) ?? ""} onBlur={(e) => saveTiming(s, "expected_check_in", e.target.value)} />
                <span>to</span>
                <Input type="time" className="h-8 w-28" defaultValue={s.expected_check_out?.slice(0, 5) ?? ""} onBlur={(e) => saveTiming(s, "expected_check_out", e.target.value)} />
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => call({ action: "set_active", staffId: s.id, isActive: !s.is_active }, s.is_active ? "Access blocked" : "Access restored")}>
                {s.is_active ? <><ShieldOff className="w-4 h-4 mr-1" />Block</> : <><ShieldCheck className="w-4 h-4 mr-1" />Allow</>}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                const p = window.prompt(`New password for ${s.name} (min 6 characters)`);
                if (p) void call({ action: "reset_password", staffId: s.id, password: p }, "Password changed");
              }}><KeyRound className="w-4 h-4 mr-1" />Password</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => {
                if (window.confirm(`Remove ${s.name}? Their attendance will also be deleted.`)) void call({ action: "delete", staffId: s.id }, "Admin removed");
              }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Admin Attendance</CardTitle>
          <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
        </CardHeader>
        <CardContent>
          {staff.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
              {staff.map((s) => {
                const rows = att.filter((a) => a.admin_staff_id === s.id);
                const lates = rows.filter((r) => r.is_late).length;
                const mins = rows.reduce((t, r) => t + (r.worked_minutes ?? 0), 0);
                return (
                  <div key={s.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-muted-foreground">{rows.length} days present · {lates} late · {Math.floor(mins / 60)}h worked</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Date</th><th>Name</th><th>In</th><th>Out</th><th>Worked</th><th>Status</th>
              </tr></thead>
              <tbody>
                {att.length === 0 ? (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No records this month.</td></tr>
                ) : att.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2">{format(new Date(a.attendance_date), "dd MMM")}</td>
                    <td>{nameOf(a.admin_staff_id)}</td>
                    <td>{a.check_in_time?.slice(0, 5) ?? "—"}</td>
                    <td>{a.check_out_time?.slice(0, 5) ?? "—"}</td>
                    <td>{a.worked_minutes != null ? `${Math.floor(a.worked_minutes / 60)}h ${a.worked_minutes % 60}m` : "—"}</td>
                    <td className="space-x-1">
                      <Badge variant="secondary">{a.status}</Badge>
                      {a.is_late && <Badge variant="destructive">Late</Badge>}
                      {a.geo_verified && <Badge variant="outline">GPS</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AdminStaffPayroll />
    </div>
  );
}
