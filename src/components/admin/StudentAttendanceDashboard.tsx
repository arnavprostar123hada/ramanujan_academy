import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, Camera, CheckCircle2, Clock3, RefreshCw, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type AttendanceEvent = {
  id: string;
  student_id: string;
  direction: "in" | "out" | "void";
  occurred_at: string;
  method: string;
  needs_review: boolean;
  review_reason: string | null;
  branch: string;
  student?: { name?: string; class?: string } | null;
};

type Device = { id: string; name: string; branch: string; is_active: boolean; last_seen_at: string | null };
type Consent = { status: string };
type QueueAlert = { id: string; event_key: string; status: string; failure_reason: string | null; created_at: string };

function indiaDateKey() {
  return new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
}
function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

export function StudentAttendanceDashboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [alerts, setAlerts] = useState<QueueAlert[]>([]);
  const [alertQueryError, setAlertQueryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const date = indiaDateKey();
    const start = new Date(date + "T00:00:00+05:30").toISOString();
    const [eventResult, deviceResult, consentResult, alertResult] = await Promise.all([
      supabase.from("student_attendance_events")
        .select("id,student_id,direction,occurred_at,method,needs_review,review_reason,branch,students(name,class)")
        .gte("occurred_at", start).order("occurred_at", { ascending: false }).limit(150),
      supabase.from("attendance_kiosk_devices").select("id,name,branch,is_active,last_seen_at").order("created_at", { ascending: false }),
      supabase.from("student_face_consent").select("status"),
      supabase.from("communication_queue")
        .select("id,event_key,status,failure_reason,created_at")
        .in("event_key", ["student_arrival", "student_departure"])
        .order("created_at", { ascending: false }).limit(20),
    ]);
    if (eventResult.error || deviceResult.error || consentResult.error) {
      setError(eventResult.error?.message || deviceResult.error?.message || consentResult.error?.message || "Could not load attendance insights.");
    } else {
      setEvents(((eventResult.data || []) as any[]).map((row) => ({
        ...row,
        student: Array.isArray(row.students) ? row.students[0] : row.students,
      })) as AttendanceEvent[]);
      setDevices((deviceResult.data || []) as Device[]);
      setConsents((consentResult.data || []) as Consent[]);
      setAlerts((alertResult.data || []) as QueueAlert[]);
      setAlertQueryError(alertResult.error?.message || "");
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    const listener = () => { void load(); };
    window.addEventListener("ra-attendance-updated", listener);
    return () => window.removeEventListener("ra-attendance-updated", listener);
  }, [load]);

  const activeEvents = useMemo(() => events.filter((event) => event.direction !== "void"), [events]);
  const arrivals = activeEvents.filter((event) => event.direction === "in").length;
  const departures = activeEvents.filter((event) => event.direction === "out").length;
  const reviewCount = activeEvents.filter((event) => event.needs_review).length;
  const grantedConsent = consents.filter((consent) => consent.status === "granted").length;
  const activeDevices = devices.filter((device) => device.is_active).length;

  const metrics = [
    { label: "Arrivals today", value: arrivals, icon: ArrowDownLeft, tone: "text-emerald-600", detail: "IN events" },
    { label: "Departures today", value: departures, icon: ArrowUpRight, tone: "text-blue-600", detail: "OUT events" },
    { label: "Needs review", value: reviewCount, icon: ShieldAlert, tone: reviewCount ? "text-amber-600" : "text-emerald-600", detail: "Manual verification" },
    { label: "Guardian consent granted", value: grantedConsent, icon: ShieldCheck, tone: "text-violet-600", detail: "Biometric opt-ins only" },
  ];

  return (
    <div className="mb-5 space-y-4">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-200"><Activity className="h-4 w-4"/><span className="text-xs font-semibold uppercase tracking-[0.18em]">Ramanujan Academy • Live attendance</span></div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Entrance &amp; Exit Command Centre</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Track student arrivals and departures from one shared entrance. Every scan needs an explicit direction confirmation; uncertain face matches require staff verification.</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5"/> {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}` : "Loading today's events"} · India Standard Time</p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading} className="bg-white text-slate-900 hover:bg-slate-100"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}/> Refresh</Button>
        </CardContent>
      </Card>

      {error && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-800">Attendance insights could not load: {error}. Confirm this account has the admin/owner role and then refresh.</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{loading ? "—" : metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p></div>
              <div className="rounded-2xl bg-muted/70 p-3"><metric.icon className={`h-5 w-5 ${metric.tone}`}/></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div><CardTitle className="text-base">Today's activity</CardTitle><p className="mt-1 text-xs text-muted-foreground">Most recent IN/OUT events</p></div>
            <Badge variant="outline">{activeEvents.length} events</Badge>
          </CardHeader>
          <CardContent>
            {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading attendance activity…</p> :
              activeEvents.length === 0 ? <div className="flex flex-col items-center py-8 text-center"><Activity className="mb-2 h-8 w-8 text-muted-foreground/50"/><p className="text-sm font-medium">No attendance events today</p><p className="mt-1 text-xs text-muted-foreground">Events will appear after a kiosk scan is confirmed.</p></div> :
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                {activeEvents.slice(0, 40).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className={`rounded-xl p-2 ${event.direction === "in" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{event.direction === "in" ? <ArrowDownLeft className="h-4 w-4"/> : <ArrowUpRight className="h-4 w-4"/>}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.student?.name || "Student"}</p><p className="text-xs text-muted-foreground">{event.student?.class || "Class not set"} · {event.branch} · {event.method.replace("_"," ")}</p>{event.needs_review && <p className="mt-1 text-xs text-amber-700">{event.review_reason || "Requires staff verification"}</p>}</div>
                    <div className="flex flex-col items-end gap-1"><Badge variant={event.direction === "in" ? "default" : "secondary"}>{event.direction === "in" ? "IN" : "OUT"}</Badge><span className="text-xs tabular-nums text-muted-foreground">{timeLabel(event.occurred_at)}</span></div>
                  </div>
                ))}
              </div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Parent alert pipeline</CardTitle><p className="text-xs text-muted-foreground">Arrival / departure WhatsApp notifications</p></CardHeader>
            <CardContent className="space-y-3">
              {alertQueryError ? <p className="text-xs text-amber-800">Queue status is not available for this account.</p> : alerts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-3"><p className="text-sm font-medium">No attendance alerts queued yet</p><p className="mt-1 text-xs text-muted-foreground">A linked parent phone is required to create a queue item. Delivery also requires AiSensy API credentials and a valid default campaign.</p></div>
              ) : alerts.slice(0,5).map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                  <div><p className="text-sm font-medium">{alert.event_key === "student_arrival" ? "Arrival alert" : "Departure alert"}</p><p className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString("en-IN", {timeZone:"Asia/Kolkata"})}</p>{alert.status === "failed" && alert.failure_reason && <p className="mt-1 text-xs text-red-700">{alert.failure_reason.includes("AISENSY_API_KEY") ? "AiSensy API key is not configured; delivery is blocked." : alert.failure_reason.slice(0,140)}</p>}</div>
                  <Badge variant={alert.status === "sent" ? "default" : alert.status === "failed" ? "destructive" : "secondary"}>{alert.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Kiosk health</CardTitle><p className="text-xs text-muted-foreground">Registered tablets and laptops</p></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border p-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><Smartphone className="h-4 w-4"/></div><div><p className="text-sm font-semibold">Registered devices</p><p className="text-xs text-muted-foreground">Active / total</p></div></div><p className="text-lg font-bold tabular-nums">{loading ? "—" : `${activeDevices}/${devices.length}`}</p></div>
              {devices.length > 0 ? devices.map((device) => <div key={device.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{device.name}</p><p className="text-xs text-muted-foreground">{device.branch}{device.last_seen_at ? ` · Seen ${timeLabel(device.last_seen_at)}` : " · Not used yet"}</p></div><Badge variant={device.is_active ? "outline" : "secondary"}>{device.is_active ? "Active" : "Disabled"}</Badge></div>) : <p className="text-xs text-muted-foreground">No kiosk is registered yet.</p>}
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4 text-violet-600"/> Face attendance safeguards</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Guardian consents recorded</span><strong>{loading ? "—" : grantedConsent}</strong></div>
              <div className="rounded-lg bg-violet-50 p-3 text-xs text-violet-950">Face matching is an opt-in pilot: camera frames stay on the device, face descriptors are stored privately, and a QR/access-code fallback remains available.</div>
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950">No certified liveness detection is installed. Staff must visually verify the student; a face match alone must not be treated as proof of identity.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
