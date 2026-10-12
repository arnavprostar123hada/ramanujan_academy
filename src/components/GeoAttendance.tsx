import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { distanceMeters, formatDistance, minutesLate, LATE_GRACE_MINUTES } from "@/lib/geo";
import {
  MapPin,
  LogIn,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Radar,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface Props {
  teacherId: string;
  teacherName: string;
  expectedCheckIn?: string | null;
  expectedCheckOut?: string | null;
  /** "teacher" (default) or "admin" staff */
  kind?: "teacher" | "admin";
  /** Keep GPS attendance tracking active without rendering the attendance card. */
  trackingOnly?: boolean;
}

interface Fence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface Record {
  id: string;
  attendance_date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean | null;
  check_in_method: string | null;
  geo_verified: boolean | null;
  check_in_distance_m: number | null;
  worked_minutes: number | null;
}

const today = () => format(new Date(), "yyyy-MM-dd");
const nowTime = () => format(new Date(), "HH:mm:ss");

export function GeoAttendance({ teacherId, teacherName, expectedCheckIn, expectedCheckOut, kind = "teacher", trackingOnly = false }: Props) {
  const table = (kind === "admin" ? "admin_attendance" : "teacher_attendance") as "teacher_attendance";
  const idCol = (kind === "admin" ? "admin_staff_id" : "teacher_id") as "teacher_id";
  const { toast } = useToast();
  const [fence, setFence] = useState<Fence | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [record, setRecord] = useState<Record | null>(null);
  const [history, setHistory] = useState<Record[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clockTick, setClockTick] = useState(0);
  const watchId = useRef<number | null>(null);
  const autoRef = useRef({ checkingIn: false, checkingOut: false });
  const insideSince = useRef<number | null>(null);
  const outsideSince = useRef<number | null>(null);

  const inside = fence && distance !== null ? distance <= fence.radius_meters : false;

  const load = useCallback(async () => {
    if (kind === "teacher") {
      const accessCode = localStorage.getItem("teacher_access_code") || "";
      const { data, error } = await supabase.rpc("teacher_geo_attendance", {
        p_teacher_id: teacherId,
        p_access_code: accessCode,
        p_action: "load",
      });
      if (error) {
        setGeoError(error.message);
        setLoading(false);
        return;
      }
      const payload = data as unknown as { fence?: Fence; record?: Record | null; history?: Record[] } | null;
      setFence(payload?.fence ?? null);
      const rows = payload?.history ?? [];
      setHistory(rows);
      setRecord(payload?.record ?? rows.find((r) => r.attendance_date === today()) ?? null);
      setLoading(false);
      return;
    }

    const [{ data: fenceData }, { data: attData }] = await Promise.all([
      supabase.from("geofence_locations").select("*").eq("is_active", true).order("created_at", { ascending: true }).limit(1),
      supabase.from(table).select("*").eq(idCol, teacherId).order("attendance_date", { ascending: false }).limit(14),
    ]);
    setFence((fenceData?.[0] as Fence) ?? null);
    const rows = (attData ?? []) as unknown as Record[];
    setHistory(rows);
    setRecord(rows.find((r) => r.attendance_date === today()) ?? null);
    setLoading(false);
  }, [teacherId, table, idCol, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("This device does not support location.");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        setAccuracy(pos.coords.accuracy);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  useEffect(() => {
    if (!fence || !coords) return;
    setDistance(distanceMeters(coords.lat, coords.lng, fence.latitude, fence.longitude));
  }, [fence, coords]);

  const doCheckIn = useCallback(
    async (method: "auto" | "manual") => {
      if (!coords || !fence || record?.check_in_time) return;
      const dist = distanceMeters(coords.lat, coords.lng, fence.latitude, fence.longitude);
      if (dist > fence.radius_meters) {
        toast({
          title: "You are outside the academy boundary",
          description: `You are ${formatDistance(dist)} away.`,
          variant: "destructive",
        });
        return;
      }
      setBusy(true);
      const late = minutesLate(expectedCheckIn, new Date());
      const isLate = late !== null && late > LATE_GRACE_MINUTES;

      if (kind === "teacher") {
        const { data, error } = await supabase.rpc("teacher_geo_attendance", {
          p_teacher_id: teacherId,
          p_access_code: localStorage.getItem("teacher_access_code") || "",
          p_action: "check_in",
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_accuracy: accuracy,
          p_is_late: isLate,
          p_method: method,
        });
        setBusy(false);
        if (error) {
          toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
          return;
        }
        const payload = data as unknown as { record?: Record } | null;
        if (!payload?.record) {
          toast({ title: "Check-in failed", description: "No attendance record was returned.", variant: "destructive" });
          return;
        }
        setRecord(payload.record);
        void load();
        toast({
          title: isLate ? "Checked in (late mark)" : "Checked in",
          description: isLate
            ? `You arrived ${late} minutes after ${expectedCheckIn?.slice(0, 5)}.`
            : `Welcome, ${teacherName}. Marked present at ${format(new Date(), "hh:mm a")}.`,
        });
        return;
      }

      const { data, error } = await supabase
        .from(table)
        .upsert(
          {
            [idCol]: teacherId,
            attendance_date: today(),
            status: "present",
            check_in_time: nowTime(),
            is_late: isLate,
            check_in_lat: coords.lat,
            check_in_lng: coords.lng,
            check_in_distance_m: dist,
            check_in_method: method,
            geo_verified: true,
          },
          { onConflict: `${idCol},attendance_date` }
        )
        .select()
        .maybeSingle();
      setBusy(false);
      if (error) {
        toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
        return;
      }
      setRecord(data as unknown as Record);
      void load();
      toast({
        title: isLate ? "Checked in (late mark)" : "Checked in",
        description: isLate
          ? `You arrived ${late} minutes after ${expectedCheckIn?.slice(0, 5)}.`
          : `Welcome, ${teacherName}. Marked present at ${format(new Date(), "hh:mm a")}.`,
      });
    },
    [coords, fence, record, expectedCheckIn, teacherId, teacherName, toast, load, table, idCol, kind, accuracy]
  );

  const doCheckOut = useCallback(
    async (method: "auto" | "manual") => {
      if (!record?.id || !record.check_in_time || record.check_out_time) return;
      setBusy(true);
      const out = nowTime();
      const [ih, im] = record.check_in_time.split(":").map(Number);
      const [oh, om] = out.split(":").map(Number);
      const worked = Math.max(0, oh * 60 + om - (ih * 60 + im));
      const dist =
        coords && fence
          ? distanceMeters(coords.lat, coords.lng, fence.latitude, fence.longitude)
          : null;

      if (kind === "teacher") {
        const { data, error } = await supabase.rpc("teacher_geo_attendance", {
          p_teacher_id: teacherId,
          p_access_code: localStorage.getItem("teacher_access_code") || "",
          p_action: "check_out",
          p_lat: coords?.lat ?? null,
          p_lng: coords?.lng ?? null,
          p_accuracy: accuracy,
          p_method: method,
        });
        setBusy(false);
        if (error) {
          toast({ title: "Check-out failed", description: error.message, variant: "destructive" });
          return;
        }
        const payload = data as unknown as { record?: Record } | null;
        if (!payload?.record) {
          toast({ title: "Check-out failed", description: "No attendance record was returned.", variant: "destructive" });
          return;
        }
        setRecord(payload.record);
        void load();
        const workedMinutes = payload.record.worked_minutes ?? 0;
        toast({
          title: method === "auto" ? "Auto checked out" : "Checked out",
          description: `Worked ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m today.`,
        });
        return;
      }

      const { data, error } = await supabase
        .from(table)
        .update({
          check_out_time: out,
          check_out_lat: coords?.lat ?? null,
          check_out_lng: coords?.lng ?? null,
          check_out_distance_m: dist,
          worked_minutes: worked,
        })
        .eq("id", record.id)
        .select()
        .maybeSingle();
      setBusy(false);
      if (error) {
        toast({ title: "Check-out failed", description: error.message, variant: "destructive" });
        return;
      }
      setRecord(data as unknown as Record);
      void load();
      toast({
        title: method === "auto" ? "Auto checked out" : "Checked out",
        description: `Worked ${Math.floor(worked / 60)}h ${worked % 60}m today.`,
      });
    },
    [record, coords, fence, toast, load, kind, teacherId, accuracy]
  );

  // Keep the auto-attendance decision loop alive even when the GPS provider is not emitting a new position.
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Check-in is explicit/manual; auto check-out remains enabled after 3 min continuously outside.
  useEffect(() => {
    if (!fence || distance === null || loading) return;
    // Do not auto-mark when GPS accuracy is too poor; this avoids false attendance.
    if (accuracy !== null && accuracy > Math.max(100, fence.radius_meters)) return;
    const now = Date.now();
    if (inside) {
      outsideSince.current = null;
      insideSince.current = now;
    } else {
      insideSince.current = null;
      if (outsideSince.current === null) outsideSince.current = now;
      if (
        record?.check_in_time &&
        !record.check_out_time &&
        !autoRef.current.checkingOut &&
        now - outsideSince.current > 180000
      ) {
        autoRef.current.checkingOut = true;
        void doCheckOut("auto").finally(() => {
          autoRef.current.checkingOut = false;
        });
      }
    }
  }, [inside, distance, fence, record, loading, accuracy, doCheckIn, doCheckOut, clockTick]);

  // Re-check location when the staff member returns to the app or the device wakes.
  useEffect(() => {
    const refreshLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoError(null);
          setAccuracy(pos.coords.accuracy);
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => setGeoError(err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };
    window.addEventListener("focus", refreshLocation);
    document.addEventListener("visibilitychange", refreshLocation);
    return () => {
      window.removeEventListener("focus", refreshLocation);
      document.removeEventListener("visibilitychange", refreshLocation);
    };
  }, []);

  if (trackingOnly) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="premium-card animated-border overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="premium-icon inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30"><Radar className="w-5 h-5" /></span><span>Location Attendance</span><Badge className="ml-auto bg-emerald-500/10 text-emerald-700 border-emerald-300">GPS Verified</Badge>
          </CardTitle>
          <CardDescription>
            {fence
              ? "Inside the academy? Tap Check In. Your GPS location is verified before attendance is recorded."
              : "Your admin has not set the academy location yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Radar visual */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative w-44 h-44 flex items-center justify-center premium-radar">
              <AnimatePresence>
                {inside && (
                  <>
                    <motion.span
                      className="absolute inset-0 rounded-full bg-green-400/25"
                      initial={{ scale: 0.6, opacity: 0.8 }}
                      animate={{ scale: 1.15, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.span
                      className="absolute inset-4 rounded-full bg-green-400/30"
                      initial={{ scale: 0.7, opacity: 0.8 }}
                      animate={{ scale: 1.1, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.6, ease: "easeOut" }}
                    />
                  </>
                )}
              </AnimatePresence>
              <motion.div
                animate={{ scale: inside ? [1, 1.06, 1] : 1 }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center shadow-2xl ${
                  inside ? "bg-gradient-to-br from-emerald-400 via-green-500 to-cyan-500 shadow-emerald-500/40" : "bg-gradient-to-br from-slate-300 to-slate-500 shadow-slate-400/30"
                }`}
              >
                <MapPin
                  className={`w-10 h-10 ${inside ? "text-white" : "text-muted-foreground"}`}
                />
              </motion.div>
            </div>

            {geoError ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> {geoError}
              </Badge>
            ) : distance === null ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Finding your location…
              </Badge>
            ) : (
              <div className="text-center space-y-1">
                <Badge
                  className={inside ? "bg-green-600 hover:bg-green-600" : ""}
                  variant={inside ? "default" : "destructive"}
                >
                  {inside ? "Inside academy boundary" : "Outside academy boundary"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {formatDistance(distance)} from the academy
                  {accuracy ? ` · GPS accuracy ±${Math.round(accuracy)} m` : ""}
                </p>
              </div>
            )}
          </div>

          {/* Today's status */}
          <div className="premium-card rounded-2xl border p-5 space-y-3 bg-white/60 dark:bg-slate-950/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today · {format(new Date(), "dd MMM yyyy")}
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              {record?.check_in_time ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" /> In{" "}
                  {record.check_in_time.slice(0, 5)}
                  {record.check_in_method === "auto" ? " (auto)" : ""}
                </Badge>
              ) : (
                <Badge variant="outline">Not checked in</Badge>
              )}
              {record?.check_out_time && (
                <Badge variant="secondary">Out {record.check_out_time.slice(0, 5)}</Badge>
              )}
              {record?.is_late && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> Late mark
                </Badge>
              )}
              {record?.worked_minutes != null && (
                <Badge variant="outline">
                  {Math.floor(record.worked_minutes / 60)}h {record.worked_minutes % 60}m
                </Badge>
              )}
            </div>
            {expectedCheckIn && (
              <p className="text-xs text-muted-foreground">
                Your shift: {expectedCheckIn.slice(0, 5)}
                {expectedCheckOut ? ` – ${expectedCheckOut.slice(0, 5)}` : ""} ·{" "}
                {LATE_GRACE_MINUTES} min grace
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => doCheckIn("manual")
              }
              disabled={busy || !inside || !!record?.check_in_time || !fence}
              className="premium-cta min-h-12 flex-1 text-base font-bold shadow-xl"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Check In
            </Button>
            <Button
              variant="outline"
              onClick={() => doCheckOut("manual")}
              disabled={busy || !record?.check_in_time || !!record?.check_out_time}
              className="min-h-12 sm:flex-1"
            >
              <LogOut className="w-4 h-4 mr-2" /> Check Out
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Once you see Inside academy boundary, tap Check In. Your attendance is not recorded until you confirm the check-in.
          </p>
        </CardContent>
      </Card>

      {/* Recent days */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-600" /> Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border text-sm"
                >
                  <span className="font-medium">
                    {format(new Date(h.attendance_date), "dd MMM yyyy")}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {h.check_in_time ? h.check_in_time.slice(0, 5) : "--:--"} →{" "}
                    {h.check_out_time ? h.check_out_time.slice(0, 5) : "--:--"}
                    {h.geo_verified && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <MapPin className="w-3 h-3" /> Verified
                      </Badge>
                    )}
                    {h.is_late && <Badge variant="destructive" className="text-xs">Late</Badge>}
                    <Badge
                      variant="secondary"
                      className={
                        h.status === "present"
                          ? "bg-green-100 text-green-800"
                          : h.status === "half_day"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {h.status.replace("_", " ")}
                    </Badge>
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
