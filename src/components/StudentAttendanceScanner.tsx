import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, QrCode, ScanLine, ShieldCheck, XCircle, LogIn, LogOut } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScannerProps {
  students: { id: string; name: string; class: string; batch: string | null }[];
  attendanceDate: string;
  onMarked?: () => void;
}
type KioskMatch = { name: string; class?: string; suggested: "in" | "out"; ambiguous?: boolean; ambiguous_reason?: string | null; last_direction?: string | null; last_at?: string | null };
const DEVICE_TOKEN_KEY = "ra_attendance_kiosk_token";

export function StudentAttendanceScanner({ students, attendanceDate, onMarked }: ScannerProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerAvailable, setScannerAvailable] = useState(true);
  const [manualId, setManualId] = useState("");
  const [deviceToken, setDeviceToken] = useState(() => sessionStorage.getItem(DEVICE_TOKEN_KEY) || "");
  const [message, setMessage] = useState("Ready to scan");
  const [match, setMatch] = useState<KioskMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [markedStudent, setMarkedStudent] = useState<{name:string; direction:"in"|"out"; at:string} | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); }, []);

  const lookup = async (payload: string) => {
    if (!deviceToken.trim()) {
      setMessage("Register a kiosk device in attendance settings, then enter its device token here.");
      toast({ title: "Kiosk is not configured", description: "A device token is required before IN/OUT can be recorded.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setMatch(null);
    const { data, error } = await supabase.rpc("kiosk_lookup", { p_device_token: deviceToken.trim(), p_code: payload.trim() });
    setBusy(false);
    if (error || !data?.ok) {
      const reason = data?.reason || error?.message || "unknown";
      setMessage(reason === "cooldown" ? "Duplicate scan blocked for 60 seconds." : reason === "device_not_authorized" ? "Device token invalid or disabled." : "Student code not recognized.");
      toast({ title: "Unable to identify student", description: reason, variant: "destructive" });
      return;
    }
    setMatch(data as KioskMatch);
    setMessage("Confirm the student's direction before recording attendance.");
  };

  const markAttendance = async (direction: "in"|"out") => {
    if (!match || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("kiosk_record", {
      p_device_token: deviceToken.trim(),
      p_code: manualId.trim(),
      p_direction: direction,
      p_idempotency_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast({ title: "Attendance could not be recorded", description: data?.reason || error?.message || "Please retry or use admin manual attendance.", variant: "destructive" });
      return;
    }
    const record = { name: data.name || match.name, direction, at: data.occurred_at || new Date().toISOString() };
    setMarkedStudent(record);
    setMessage(direction === "in" ? "Arrival recorded" : "Departure recorded");
    setMatch(null);
    setManualId("");
    onMarked?.();
    toast({ title: direction === "in" ? "Student arrived" : "Student departed", description: record.name });
    window.setTimeout(() => setMarkedStudent(null), 4000);
  };

  const handlePayload = (payload: string) => {
    const trimmed = payload.trim();
    if (!trimmed.startsWith("RA_ATTENDANCE:") && !/^[a-z0-9]{6,12}$/i.test(trimmed)) {
      setMessage("Use a Ramanujan attendance QR or student's access code.");
      return;
    }
    setManualId(trimmed);
    void lookup(trimmed);
  };

  const startCamera = async () => {
    setMessage("Starting camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      setScanning(true);
      if (!BarcodeDetectorCtor) { setScannerAvailable(false); setMessage("Camera ready. Use manual code fallback on this browser."); return; }
      setScannerAvailable(true);
      setMessage("Point camera at the student's attendance QR");
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const scan = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) { stopCamera(); handlePayload(codes[0].rawValue); return; }
        } catch {}
        window.requestAnimationFrame(scan);
      };
      window.requestAnimationFrame(scan);
    } catch (error: any) {
      setScanning(false); setMessage("Camera permission was not granted");
      toast({ title: "Camera unavailable", description: error?.message || "Allow camera access to scan QR codes.", variant: "destructive" });
    }
  };

  const saveDeviceToken = () => {
    const value = deviceToken.trim();
    if (!value) { sessionStorage.removeItem(DEVICE_TOKEN_KEY); return; }
    sessionStorage.setItem(DEVICE_TOKEN_KEY, value);
    toast({ title: "Kiosk token saved", description: "It will be cleared when this browser session ends." });
  };

  return (
    <Card className="overflow-hidden border-primary/15 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-amber-500/10">
        <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /> Smart Student IN / OUT Attendance</CardTitle>
        <p className="text-sm text-muted-foreground">Single entrance/exit kiosk. QR and access-code fallback are supported. Face matching is not active until a consented, validated recognition module is installed.</p>
      </CardHeader>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[280px] overflow-hidden rounded-3xl bg-slate-950">
          {scanning ? <><video ref={videoRef} playsInline muted className="h-full min-h-[280px] w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-cyan-300/70"><div className="absolute left-4 right-4 top-1/2 h-0.5 animate-pulse bg-cyan-300" /></div><div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white">{message}</div></> :
          <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center text-white"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10"><Camera className="h-9 w-9 text-cyan-300" /></div><p className="font-semibold">Entrance / Exit Scanner</p><p className="mt-1 text-xs text-white/65">Scan attendance QR or enter access code.</p><Button className="mt-5" onClick={startCamera}><Camera className="mr-2 h-4 w-4" /> Start Camera</Button></div>}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Kiosk settings</div><p className="mt-1 text-xs text-muted-foreground">Date: {attendanceDate}. Token is kept in session storage only.</p><Input type="password" value={deviceToken} onChange={e=>setDeviceToken(e.target.value)} placeholder="Kiosk device token" className="mt-3" /><Button variant="outline" size="sm" className="mt-2 w-full" onClick={saveDeviceToken}>Save token for this session</Button></div>
          {match && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="font-bold">{match.name}</p><p className="text-sm text-muted-foreground">Class {match.class || "—"}</p>{match.ambiguous && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Please verify direction: {match.ambiguous_reason || "The last scan is ambiguous."}</p>}<p className="mt-3 text-xs text-muted-foreground">Suggested next event: {match.suggested.toUpperCase()} — confirm below.</p><div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={busy} onClick={()=>markAttendance("in")}><LogIn className="mr-2 h-4 w-4"/> IN / Arrived</Button><Button variant="secondary" disabled={busy} onClick={()=>markAttendance("out")}><LogOut className="mr-2 h-4 w-4"/> OUT / Left</Button></div></div>}
          {markedStudent && <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-800"><div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5"/>{markedStudent.direction==="in"?"Arrival recorded":"Departure recorded"}</div><p className="mt-1 text-sm">{markedStudent.name}</p><p className="text-xs">{new Date(markedStudent.at).toLocaleTimeString("en-IN")}</p></div>}
          <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">QR / access-code fallback</p><Input value={manualId} onChange={e=>setManualId(e.target.value)} placeholder="RA_ATTENDANCE:student-id or access code" /><Button variant="outline" className="w-full" disabled={busy || !manualId.trim()} onClick={()=>handlePayload(manualId)}><QrCode className="mr-2 h-4 w-4"/> Identify student</Button></div>
          {!scannerAvailable && scanning && <p className="text-xs text-amber-700">This browser does not expose native QR detection. Use manual code fallback.</p>}
          {scanning && <Button variant="ghost" className="w-full" onClick={stopCamera}><XCircle className="mr-2 h-4 w-4"/> Stop Camera</Button>}
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentAttendanceQR({ studentId, studentName }: { studentId: string; studentName: string }) {
  return <Card className="overflow-hidden border-violet-200/70 shadow-lg"><CardHeader className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10"><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-violet-600"/> My Attendance QR</CardTitle><p className="text-xs text-muted-foreground">Show this code at the attendance kiosk; a staff member confirms IN or OUT.</p></CardHeader><CardContent className="flex flex-col items-center gap-3 p-5"><div className="rounded-3xl border bg-white p-4 shadow-inner"><QRCodeSVG value={`RA_ATTENDANCE:${studentId}`} size={190} includeMargin/></div><p className="text-center text-sm font-semibold">{studentName}</p><p className="text-center text-xs text-muted-foreground">Keep the QR visible only while checking in or out.</p></CardContent></Card>;
}
