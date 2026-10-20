import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FileImage, Loader2, ScanText } from "lucide-react";
import { useNavigate } from "react-router-dom";

type CheckResult = {
  id: string;
  status: string;
  suggested_marks: number;
  max_marks: number;
  extracted_answers: {
    summary?: string;
    confidence?: string;
    needs_teacher_attention?: boolean;
    questions?: Array<{ question?: string; student_answer?: string; expected_answer?: string; marks_awarded?: number; marks_available?: number; feedback?: string }>;
  };
  feedback?: string;
  student_name?: string | null;
  subject: string;
  class_name?: string | null;
};

export default function AIPaperChecker() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [maxMarks, setMaxMarks] = useState("50");
  const [answerKey, setAnswerKey] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  const runCheck = async () => {
    if (!subject.trim() || !answerKey.trim() || !image || Number(maxMarks) <= 0) {
      toast.error("Enter the subject, answer key, maximum marks and upload a paper image.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) {
      toast.error("Please upload a PNG, JPG or WebP image.");
      return;
    }
    if (image.size > 4 * 1024 * 1024) {
      toast.error("Image must be 4 MB or smaller.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image"));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(image);
      });
      const { data, error } = await supabase.functions.invoke("ai-paper-checker", {
        body: { action: "check", studentName, studentId: studentId || null, subject, className, maxMarks: Number(maxMarks), answerKey, imageDataUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.check);
      toast.success(data.cached ? "Loaded a cached AI analysis. Please review it." : "Draft marking created. Teacher approval is still required.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check this paper.");
    } finally {
      setBusy(false);
    }
  };

  const review = async (action: "approve" | "reject") => {
    if (!result) return;
    setBusy(true);
    try {
      const marks = Number(result.suggested_marks);
      const { data, error } = await supabase.functions.invoke("ai-paper-checker", {
        body: { action, id: result.id, marks },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ ...result, status: action === "approve" ? "approved" : "rejected", suggested_marks: marks });
      toast.success(action === "approve" ? "Marks approved by you." : "Draft rejected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary"><ScanText className="h-6 w-6" /><span className="text-sm font-semibold uppercase tracking-wide">Ramanujan Academy AI</span></div>
            <h1 className="text-3xl font-bold tracking-tight">AI Paper Checker</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Upload a student's answer sheet and marking key. AI prepares suggested marks and question-wise feedback; a teacher must review the draft.</p>
          </div>
          <Badge variant="outline">Teacher approval required</Badge>
        </div>
        <Card>
          <CardHeader><CardTitle>Paper details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Student name (optional)</Label><Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Student name" /></div>
            <div className="space-y-2"><Label>Student ID (optional)</Label><Input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Student UUID if available" /></div>
            <div className="space-y-2"><Label>Class / standard</Label><Input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. 8th CBSE" /></div>
            <div className="space-y-2"><Label>Subject *</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
            <div className="space-y-2"><Label>Maximum marks *</Label><Input type="number" min="1" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} /></div>
            <div className="space-y-2"><Label>Answer sheet image *</Label><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0] || null; setImage(file); setResult(null); if (!file) { setImagePreview(null); return; } const reader = new FileReader(); reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : null); reader.onerror = () => setImagePreview(null); reader.readAsDataURL(file); }} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Answer key / marking scheme *</Label><Textarea value={answerKey} onChange={e => setAnswerKey(e.target.value)} rows={6} placeholder={"Paste correct answers and marking scheme. Include question-wise marks and partial-credit rules."} /></div>
            {image && <div className="space-y-2 md:col-span-2"><div className="flex items-center gap-2 text-sm text-muted-foreground"><FileImage className="h-4 w-4" />{image.name} · {(image.size / 1024).toFixed(0)} KB</div>{imagePreview && <div className="space-y-1"><p className="text-sm font-medium">Preview — confirm this is the student’s handwritten/typed answer sheet before checking.</p><img src={imagePreview} alt="Selected answer sheet preview" className="max-h-[520px] max-w-full rounded-lg border object-contain" /></div>}</div>}
            <div className="md:col-span-2"><Button onClick={runCheck} disabled={busy} className="w-full sm:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanText className="mr-2 h-4 w-4" />} Check paper and prepare draft</Button></div>
          </CardContent>
        </Card>
        {result && <Card>
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Teacher review</CardTitle><Badge variant={result.status === "approved" ? "default" : "outline"}>{result.status.replace("_", " ")}</Badge></div></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Suggested score</p><p className="text-2xl font-bold">{result.suggested_marks} / {result.max_marks}</p></div>
              <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">AI confidence</p><p className="text-lg font-semibold capitalize">{result.extracted_answers?.confidence || "low"}</p></div>
              <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Needs attention</p><p className="text-lg font-semibold">{result.extracted_answers?.needs_teacher_attention ? "Yes — review carefully" : "Review all answers"}</p></div>
            </div>
            <p className="text-sm text-muted-foreground">{result.feedback || result.extracted_answers?.summary}</p>
            <div className="space-y-3">
              {(result.extracted_answers?.questions || []).map((q, i) => <div key={i} className="rounded-lg border p-4">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{q.question || `Question ${i + 1}`}</h3><Badge variant="secondary">{q.marks_awarded ?? 0} / {q.marks_available ?? "?"}</Badge></div>
                <p className="mt-2 text-sm"><strong>Student answer:</strong> {q.student_answer || "Unclear / not detected"}</p>
                <p className="mt-1 text-sm"><strong>Expected:</strong> {q.expected_answer || "See marking scheme"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{q.feedback}</p>
              </div>)}
            </div>
            {result.status === "pending_review" && <div className="flex flex-wrap gap-3 border-t pt-4"><Button disabled={busy} onClick={() => review("approve")}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve suggested marks</Button><Button disabled={busy} variant="outline" onClick={() => review("reject")}>Reject draft</Button><p className="basis-full text-xs text-muted-foreground">Approval records the reviewing user. This feature does not automatically notify parents or publish results.</p></div>}
          </CardContent>
        </Card>}
      </div>
    </main>
  );
}
