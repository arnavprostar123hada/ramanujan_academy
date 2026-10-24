import { useEffect, useRef, useState } from "react";
import {
  Camera, CheckCircle2, QrCode, ScanLine, ShieldCheck, XCircle,
  LogIn, LogOut, UserCheck, UserX, KeyRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { captureAveragedFaceDescriptor } from "@/lib/faceAttendance";

interface ScannerProps {
  students: { id: string; name: string; class: string; batch: string | null; access_code?: string }[];
  attendanceDate: string;
  onMarked?: () => void;
}
type KioskMatch = {
  student_ref: string;
  suggested: "in" | "out";
  method: "qr" | "face";
  match_distance?: number;
  match_token?: string;
  ambiguous?: boolean;
  ambiguous_reason?: string | null;
  last_direction?: string | null;
  last_at?: string | null;
};
type FaceConsent = { student_id: string; status: "not_requested" | "granted" | "revoked"; guardian_name: string | null };
const DEVICE_TOKEN_KEY = "ra_attendance_kiosk_token";

export function StudentAttendanceScanner({ students, attendanceDate, onMarked }: ScannerProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerAvailable, setScannerAvailable] = useState(true);
  const [cameraMode, setCameraMode] = useState<"qr" | "face" | null>(null);
  const [manualId, setManualId] = useState("");
  const [pendingCode, setPendingCode] = useState("");
  const [deviceToken, setDeviceToken] = useState(() => sessionStorage.getItem(DEVICE_TOKEN_KEY) || "");
  const [message, setMessage] = useState("Ready to scan");
  const [match, setMatch] = useState<KioskMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceName, setDeviceName] = useState("Ramanujan Entrance Kiosk");
  const [branchName, setBranchName] = useState("Main");
  const [newToken, setNewToken] = useState("");
  const [markedStudent, setMarkedStudent] = useState<{name:string; direction:"in"|"out"; at:string} | null>(null);
  const [faceConsents, setFaceConsents] = useState<Record<string, FaceConsent>>({});
  const [selectedFaceStudent, setSelectedFaceStudent] = useState(() => students[0]?.id || "");
  const [guardianName, setGuardianName] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentNotes, setConsentNotes] = useState("");

  useEffect(() => {
    if (!selectedFaceStudent && students.length > 0) setSelectedFaceStudent(students[0].id);
  }, [students, selectedFaceStudent]);

  useEffect(() => {
    let cancelled = false;
    const loadConsents = async () => {
      const { data, error } = await supabase
        .from("student_face_consent")
        .select("student_id,status,guardian_name");
      if (!cancelled && !error && data) {
        const next: Record<string, FaceConsent> = {};
        for (const row of data as FaceConsent[]) next[row.student_id] = row;
        setFaceConsents(next);
      }
    };
    void loadConsents();
    return () => { cancelled = true; };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
    setCameraMode(null);
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  const openCamera = async (mode: "qr" | "face") => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: mode === "face" ? "user" : "environment" } },
      audio: false,
    });
    streamRef.current = stream;
    setCameraMode(mode);
    setScanning(true);
    await new Promise<void>((resolve, reject) => {
      window.requestAnimationFrame(async () => {
        try {
          const video = videoRef.current;
          if (!video) throw new Error("Camera preview is not ready. Please retry.");
          video.srcObject = stream;
          await video.play();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  const lookup = async (payload: string) => {
    if (!deviceToken.trim()) {
      setMessage("Register a kiosk device, then enter its device token here.");
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
    setPendingCode(payload.trim());
    setMatch({ ...data, student_ref: data.student_ref || "", method: "qr" } as KioskMatch);
    setMessage("Student code matched. Confirm the student's IN/OUT direction.");
  };

  const markAttendance = async (direction: "in" | "out") => {
    if (!match || busy) return;
    setBusy(true);
    const idempotencyKey = crypto.randomUUID();
    let result: { data: any; error: any };
    if (match.method === "face") {
      if (!match.match_token) {
        setBusy(false);
        toast({ title: "Face confirmation expired", description: "Please scan the face again before recording IN/OUT.", variant: "destructive" });
        setMatch(null);
        return;
      }
      result = await supabase.rpc("kiosk_record_face", {
        p_device_token: deviceToken.trim(),
        p_match_token: match.match_token,
        p_direction: direction,
        p_idempotency_key: idempotencyKey,
      });
    } else {
      result = await supabase.rpc("kiosk_record", {
        p_device_token: deviceToken.trim(),
        p_code: pendingCode,
        p_direction: direction,
        p_idempotency_key: idempotencyKey,
      });
    }
    setBusy(false);
    const data = result.data;
    const error = result.error;
    if (error || !data?.ok) {
      const reason = data?.reason || error?.message || "Please retry.";
      toast({ title: "Attendance could not be recorded", description: reason, variant: "destructive" });
      setMessage(reason === "duplicate_direction" ? "This direction was already recorded. Please check the last event." : "Attendance was not recorded.");
      return;
    }
    const student = students.find((s) => s.id === match.student_ref);
    const record = { name: student?.name || "Student", direction, at: data.occurred_at || new Date().toISOString() };
    setMarkedStudent(record);
    setMessage(direction === "in" ? "Arrival recorded" : "Departure recorded");
    setMatch(null);
    setManualId("");
    setPendingCode("");
    onMarked?.();
    toast({ title: direction === "in" ? "Student arrived" : "Student departed", description: record.name });
    window.setTimeout(() => setMarkedStudent(null), 4000);
  };

  const handlePayload = (payload: string) => {
    const trimmed = payload.trim();
    const code = trimmed.startsWith("RA_ATTENDANCE:") ? trimmed.slice("RA_ATTENDANCE:".length).trim() : trimmed;
    if (!/^[a-z0-9]{8}$/i.test(code)) {
      setMessage("Use the private 8-character attendance QR or student access code.");
      toast({ title: "Invalid attendance code", description: "This QR does not contain a valid Ramanujan access code.", variant: "destructive" });
      return;
    }
    setManualId(trimmed);
    setPendingCode(trimmed);
    void lookup(trimmed);
  };

  const startQrScan = async () => {
    if (!deviceToken.trim()) {
      toast({ title: "Register the kiosk first", description: "A device token is required before scanning.", variant: "destructive" });
      return;
    }
    setMessage("Starting QR camera...");
    try {
      await openCamera("qr");
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        setScannerAvailable(false);
        setMessage("This browser has no built-in QR detector. Enter the 8-character access code below.");
        return;
      }
      setScannerAvailable(true);
      setMessage("Point the camera at the student's attendance QR");
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) {
            const payload = codes[0].rawValue as string;
            stopCamera();
            handlePayload(payload);
            return;
          }
        } catch { /* Keep scanning if a frame is temporarily unavailable. */ }
        window.requestAnimationFrame(scan);
      };
      window.requestAnimationFrame(scan);
    } catch (error: any) {
      stopCamera();
      setMessage("Camera permission was not granted");
      toast({ title: "Camera unavailable", description: error?.message || "Allow camera access to scan QR codes.", variant: "destructive" });
    }
  };

  const startFaceScan = async () => {
    if (!deviceToken.trim()) {
      toast({ title: "Register the kiosk first", description: "A device token is required before scanning.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setMessage("Loading the face model...");
    try {
      await openCamera("face");
      setMessage("Center one face in the frame; processing stays on this device.");
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const descriptor = await captureAveragedFaceDescriptor(videoRef.current!, 3);
      stopCamera();
      setMessage("Checking for a consented face template...");
      const { data, error } = await supabase.rpc("match_attendance_face", {
        p_device_token: deviceToken.trim(),
        p_descriptor: descriptor,
        p_threshold: 0.52,
      });
      setBusy(false);
      if (error || !data?.ok) {
        const reason = data?.reason || error?.message || "face_match_failed";
        setMessage(reason === "no_consented_templates" ? "No consented face templates are enrolled yet." : "No confident match. Use QR/access-code fallback.");
        toast({ title: "Face match not confirmed", description: "No attendance was recorded. Use the QR/access-code fallback or visually verify the student.", variant: "destructive" });
        return;
      }
      setMatch({
        student_ref: data.student_ref,
        method: "face",
        match_token: data.match_token,
        suggested: data.suggested === "out" ? "out" : "in",
        ambiguous: Boolean(data.ambiguous),
        ambiguous_reason: data.ambiguous_reason || null,
        last_direction: data.last_direction || null,
        last_at: data.last_at || null,
        match_distance: Number(data.match_distance),
      });
      setMessage("Face matched on-device. Verify the student, then confirm IN or OUT.");
    } catch (error: any) {
      stopCamera();
      setBusy(false);
      setMessage(error?.message || "Face scan could not be completed.");
      toast({ title: "Face scanning unavailable", description: error?.message || "Try QR/access-code fallback.", variant: "destructive" });
    }
  };

  const registerDevice = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("register_kiosk_device", {
      p_name: deviceName.trim(),
      p_branch: branchName.trim() || "Main",
    });
    setBusy(false);
    if (error || !data?.token) {
      toast({ title: "Could not register kiosk", description: error?.message || "Check that you are signed in as an admin or owner.", variant: "destructive" });
      return;
    }
    setDeviceToken(data.token);
    setNewToken(data.token);
    sessionStorage.setItem(DEVICE_TOKEN_KEY, data.token);
    toast({ title: "Kiosk registered", description: "Copy and store the token securely. It is displayed only once." });
  };

  const saveDeviceToken = () => {
    const value = deviceToken.trim();
    if (!value) { sessionStorage.removeItem(DEVICE_TOKEN_KEY); setDeviceToken(""); return; }
    sessionStorage.setItem(DEVICE_TOKEN_KEY, value);
    toast({ title: "Kiosk token saved", description: "It will be cleared when this browser session ends." });
  };

  const recordFaceConsent = async (status: "granted" | "revoked") => {
    if (!selectedFaceStudent) return;
    if (status === "granted" && (!consentConfirmed || !guardianName.trim())) {
      toast({ title: "Guardian consent required", description: "Confirm that signed parent/guardian consent has been obtained and enter the guardian's name.", variant: "destructive" });
      return;
    }
    if (status === "revoked" && !window.confirm("Revoke face attendance consent and delete this student's stored face descriptor?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_face_consent", {
      p_student_id: selectedFaceStudent,
      p_status: status,
      p_guardian_name: guardianName.trim() || faceConsents[selectedFaceStudent]?.guardian_name || null,
      p_notes: status === "granted"
        ? (consentNotes.trim() || "Signed parent/guardian consent was confirmed by authorized staff.")
        : "Face attendance consent revoked by authorized staff.",
    });
    setBusy(false);
    if (error) {
      toast({ title: "Consent status was not saved", description: error.message, variant: "destructive" });
      return;
    }
    setFaceConsents((current) => ({
      ...current,
      [selectedFaceStudent]: { student_id: selectedFaceStudent, status, guardian_name: guardianName.trim() || current[selectedFaceStudent]?.guardian_name || null },
    }));
    if (status === "revoked") toast({ title: "Consent revoked", description: "The student's face descriptor was deleted." });
    else toast({ title: "Consent recorded", description: "You can now enroll the face descriptor for this student." });
  };

  const enrollFace = async () => {
    if (!selectedFaceStudent) return;
    if (faceConsents[selectedFaceStudent]?.status !== "granted") {
      toast({ title: "Consent required first", description: "Record signed parent/guardian consent before enrollment.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setMessage("Loading the face model for enrollment...");
    try {
      await openCamera("face");
      setMessage("Keep one face centered; capturing three local samples...");
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const descriptor = await captureAveragedFaceDescriptor(videoRef.current!, 3);
      stopCamera();
      const { error } = await supabase.rpc("save_student_face_template", {
        p_student_id: selectedFaceStudent,
        p_descriptor: descriptor,
        p_model: "vladmandic-face-api@1.7.15",
      });
      setBusy(false);
      if (error) throw error;
      toast({ title: "Face descriptor enrolled", description: "Only a numeric descriptor was stored; source frames were not uploaded." });
      setMessage("Face enrollment complete. Test it with staff present before operational use.");
    } catch (error: any) {
      stopCamera();
      setBusy(false);
      setMessage(error?.message || "Face enrollment failed.");
      toast({ title: "Face enrollment failed", description: error?.message || "Try again or use access-code attendance.", variant: "destructive" });
    }
  };

  const selectedStudent = students.find((s) => s.id === selectedFaceStudent);
  const selectedConsent = faceConsents[selectedFaceStudent];

  return (
    <Card className="overflow-hidden border-primary/15 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-amber-500/10">
        <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /> Smart Student IN / OUT Attendance</CardTitle>
        <p className="text-sm text-muted-foreground">Single entrance/exit kiosk. Use face match only for students with recorded parent/guardian consent. QR/access-code remains the fallback; every match still requires explicit IN/OUT confirmation.</p>
      </CardHeader>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[280px] overflow-hidden rounded-3xl bg-slate-950">
          {scanning ? <><video ref={videoRef} playsInline muted className="h-full min-h-[280px] w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-cyan-300/70"><div className="absolute left-4 right-4 top-1/2 h-0.5 animate-pulse bg-cyan-300" /></div><div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white">{message}</div></> :
          <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center text-white"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10"><Camera className="h-9 w-9 text-cyan-300" /></div><p className="font-semibold">Entrance / Exit Scanner</p><p className="mt-1 text-xs text-white/65">Scan an attendance QR or use face matching for a consented student.</p><div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2"><Button onClick={startQrScan}><QrCode className="mr-2 h-4 w-4"/> QR scan</Button><Button variant="secondary" onClick={startFaceScan} disabled={busy}><UserCheck className="mr-2 h-4 w-4"/> Face scan</Button></div></div>}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Kiosk settings</div>
            <p className="mt-1 text-xs text-muted-foreground">Date: {attendanceDate}. Token is kept in session storage only.</p>
            <Input type="password" value={deviceToken} onChange={e=>setDeviceToken(e.target.value)} placeholder="Existing kiosk device token" className="mt-3" />
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={saveDeviceToken}>Save token for this session</Button>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold">Register this device (admin/owner)</summary>
              <Input value={deviceName} onChange={e=>setDeviceName(e.target.value)} placeholder="Device name" className="mt-2" />
              <Input value={branchName} onChange={e=>setBranchName(e.target.value)} placeholder="Branch" className="mt-2" />
              <Button size="sm" disabled={busy || !deviceName.trim()} className="mt-2 w-full" onClick={registerDevice}>Register kiosk</Button>
              {newToken && <div className="mt-3 space-y-2"><p className="text-xs text-amber-800">Copy and store this token securely. It is displayed once.</p><Input readOnly value={newToken} /><Button variant="outline" size="sm" className="w-full" onClick={()=>void navigator.clipboard.writeText(newToken)}>Copy device token</Button></div>}
            </details>
          </div>
          {match && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="font-bold">{students.find((s)=>s.id===match.student_ref)?.name || "Student identified"}</p><p className="text-sm text-muted-foreground">{match.method === "face" ? "Face descriptor matched a consented template on the server." : "The private student access code matched an active record."}</p>{match.ambiguous && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Please verify direction: {match.ambiguous_reason || "The last scan is ambiguous."}</p>}<p className="mt-3 text-xs text-muted-foreground">Suggested next event: {match.suggested.toUpperCase()} — confirm below. Face matching is a pilot and does not provide certified anti-spoof protection; visually verify the student.</p><div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={busy} onClick={()=>markAttendance("in")}><LogIn className="mr-2 h-4 w-4"/> IN / Arrived</Button><Button variant="secondary" disabled={busy} onClick={()=>markAttendance("out")}><LogOut className="mr-2 h-4 w-4"/> OUT / Left</Button></div></div>}
          {markedStudent && <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-800"><div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5"/>{markedStudent.direction==="in"?"Arrival recorded":"Departure recorded"}</div><p className="mt-1 text-sm">{markedStudent.name}</p><p className="text-xs">{new Date(markedStudent.at).toLocaleTimeString("en-IN")}</p></div>}
          <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">QR / access-code fallback</p><Input value={manualId} onChange={e=>setManualId(e.target.value)} placeholder="RA_ATTENDANCE:8-character access code" /><Button variant="outline" className="w-full" disabled={busy || !manualId.trim()} onClick={()=>handlePayload(manualId)}><QrCode className="mr-2 h-4 w-4"/> Identify student</Button></div>
          {!scannerAvailable && <p className="text-xs text-amber-700">This browser does not expose native QR detection. Use the manual 8-character access-code fallback.</p>}
          {scanning && <Button variant="ghost" className="w-full" onClick={stopCamera}><XCircle className="mr-2 h-4 w-4"/> Stop Camera</Button>}
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </CardContent>

      <div className="border-t bg-muted/20 p-5">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><KeyRound className="h-4 w-4"/> Consented face enrollment &amp; withdrawal</summary>
          <p className="mt-2 text-xs text-muted-foreground">Only record consent after receiving signed parent/guardian consent. Camera frames are processed in the browser; only a numeric descriptor is stored. Revoking consent deletes the descriptor. This pilot is not certified anti-spoofing and must be visually supervised.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">Student
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedFaceStudent} onChange={e=>setSelectedFaceStudent(e.target.value)}>
                <option value="">Select a student</option>
                {students.map(student => <option key={student.id} value={student.id}>{student.name} — {student.class}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Parent / guardian name
              <Input className="mt-1" value={guardianName} onChange={e=>setGuardianName(e.target.value)} placeholder={selectedConsent?.guardian_name || "Enter guardian's name"} />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="mt-0.5" checked={consentConfirmed} onChange={e=>setConsentConfirmed(e.target.checked)} />
            I confirm signed parent/guardian consent has been obtained for biometric attendance and the family has been told that QR/access-code attendance remains available.
          </label>
          <label className="mt-3 block text-sm font-medium">Consent record notes
            <Input className="mt-1" value={consentNotes} onChange={e=>setConsentNotes(e.target.value)} placeholder="Optional reference to consent form / date" />
          </label>
          <p className="mt-2 text-xs">Status: <strong>{selectedConsent?.status || "not_requested"}</strong>{selectedConsent?.guardian_name ? ` — ${selectedConsent.guardian_name}` : ""}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Button size="sm" disabled={busy || !selectedFaceStudent} onClick={()=>recordFaceConsent("granted")}><UserCheck className="mr-2 h-4 w-4"/> Record consent</Button>
            <Button size="sm" variant="outline" disabled={busy || !selectedFaceStudent || selectedConsent?.status!=="granted"} onClick={enrollFace}><Camera className="mr-2 h-4 w-4"/> Capture face</Button>
            <Button size="sm" variant="destructive" disabled={busy || !selectedFaceStudent || selectedConsent?.status!=="granted"} onClick={()=>recordFaceConsent("revoked")}><UserX className="mr-2 h-4 w-4"/> Revoke &amp; delete</Button>
          </div>
          {selectedStudent && <p className="mt-2 text-xs text-muted-foreground">Enrollment selected: {selectedStudent.name}. No raw face photo is stored by this feature.</p>}
        </details>
      </div>
    </Card>
  );
}

export function StudentAttendanceQR({ accessCode, studentName }: { accessCode: string; studentName: string }) {
  return <Card className="overflow-hidden border-violet-200/70 shadow-lg"><CardHeader className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10"><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-violet-600"/> My Attendance QR</CardTitle><p className="text-xs text-muted-foreground">Show this code at the attendance kiosk; a staff member confirms IN or OUT.</p></CardHeader><CardContent className="flex flex-col items-center gap-3 p-5"><div className="rounded-3xl border bg-white p-4 shadow-inner"><QRCodeSVG value={`RA_ATTENDANCE:${accessCode}`} size={190} includeMargin/></div><p className="text-center text-sm font-semibold">{studentName}</p><p className="text-center text-xs text-muted-foreground">Treat this QR as private. It contains your attendance access code.</p></CardContent></Card>;
}
