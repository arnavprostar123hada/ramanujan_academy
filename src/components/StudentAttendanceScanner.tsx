import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, QrCode, ScanLine, ShieldCheck, XCircle } from "lucide-react";
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

export function StudentAttendanceScanner({ students, attendanceDate, onMarked }: ScannerProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerAvailable, setScannerAvailable] = useState(true);
  const [manualId, setManualId] = useState("");
  const [message, setMessage] = useState("Ready to scan");
  const [markedStudent, setMarkedStudent] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const markAttendance = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      setMessage("Student not found");
      toast({ title: "Student not found", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("student_attendance").upsert(
      { student_id: studentId, attendance_date: attendanceDate, status: "present", remarks: "QR classroom scan" },
      { onConflict: "student_id,attendance_date" }
    );

    if (error) {
      toast({ title: "Attendance could not be marked", description: error.message, variant: "destructive" });
      return;
    }

    setMarkedStudent(student.name);
    setMessage("Attendance marked successfully");
    onMarked?.();
    window.setTimeout(() => setMarkedStudent(null), 2500);
  };

  const handlePayload = (payload: string) => {
    if (!payload.startsWith("RA_ATTENDANCE:")) {
      setMessage("Invalid Ramanujan Academy attendance QR");
      return;
    }
    const studentId = payload.replace("RA_ATTENDANCE:", "").trim();
    if (studentId) void markAttendance(studentId);
  };

  const startCamera = async () => {
    setMessage("Starting camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      setScanning(true);
      if (!BarcodeDetectorCtor) {
        setScannerAvailable(false);
        setMessage("Camera ready. Use the manual fallback on this browser.");
        return;
      }

      setScannerAvailable(true);
      setMessage("Point the camera at the student's QR");
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });

      const scan = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) {
            handlePayload(codes[0].rawValue);
            stopCamera();
            return;
          }
        } catch {}
        window.requestAnimationFrame(scan);
      };
      window.requestAnimationFrame(scan);
    } catch (error: any) {
      setScanning(false);
      setMessage("Camera permission was not granted");
      toast({
        title: "Camera unavailable",
        description: error?.message || "Allow camera access to scan QR codes.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="overflow-hidden border-primary/15 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-amber-500/10">
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          Smart Student Attendance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Camera-based QR check-in — no face images or biometric templates are stored.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[280px] overflow-hidden rounded-3xl bg-slate-950">
          {scanning ? (
            <>
              <video ref={videoRef} playsInline muted className="h-full min-h-[280px] w-full object-cover" />
              <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-cyan-300/70 shadow-[0_0_60px_rgba(34,211,238,.22)]">
                <div className="absolute left-4 right-4 top-1/2 h-0.5 animate-pulse bg-cyan-300" />
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                {message}
              </div>
            </>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center text-white">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
                <Camera className="h-9 w-9 text-cyan-300" />
              </div>
              <p className="font-semibold">Attendance Scanner</p>
              <p className="mt-1 text-xs text-white/65">Scan a student's personal attendance QR.</p>
              <Button className="mt-5" onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" /> Start Camera
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Classroom verification
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Date: {attendanceDate} · duplicate scans update the same attendance record.
            </p>
          </div>
          {markedStudent && (
            <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-800">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" /> Present</div>
              <p className="mt-1 text-sm">{markedStudent}</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manual QR ID fallback</p>
            <Input value={manualId} onChange={e => setManualId(e.target.value)} placeholder="Paste RA_ATTENDANCE:student-id" />
            <Button variant="outline" className="w-full" onClick={() => handlePayload(manualId)}>
              <QrCode className="mr-2 h-4 w-4" /> Mark Attendance
            </Button>
          </div>
          {!scannerAvailable && scanning && (
            <p className="text-xs text-amber-700">This browser exposes the camera but not native QR detection. Use the fallback or a browser with BarcodeDetector support.</p>
          )}
          {scanning && (
            <Button variant="ghost" className="w-full" onClick={stopCamera}>
              <XCircle className="mr-2 h-4 w-4" /> Stop Camera
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentAttendanceQR({ studentId, studentName }: { studentId: string; studentName: string }) {
  return (
    <Card className="overflow-hidden border-violet-200/70 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10">
        <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-violet-600" /> My Attendance QR</CardTitle>
        <p className="text-xs text-muted-foreground">Show this code at the classroom attendance scanner.</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 p-5">
        <div className="rounded-3xl border bg-white p-4 shadow-inner">
          <QRCodeSVG value={`RA_ATTENDANCE:${studentId}`} size={190} includeMargin />
        </div>
        <p className="text-center text-sm font-semibold">{studentName}</p>
        <p className="text-center text-xs text-muted-foreground">Keep the QR visible only while checking in.</p>
      </CardContent>
    </Card>
  );
}
