import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, FileText, BookOpen, Library, CheckCircle2,
  Printer, Plus, Trash2, Edit3, Save, GraduationCap, SlidersHorizontal,
  WandSparkles, Loader2, Search, Filter, RefreshCw, ShieldCheck,
  CircleHelp, FileCheck2, Layers3, Target
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type Question = { id: string; type: string; text: string; marks: number; options?: string[]; answer?: string; explanation?: string };
type PaperDraft = {
  id?: string; title: string; board: "CBSE" | "ICSE"; className: string; subject: string;
  academicYear: string; totalMarks: number; duration: number; difficulty: string;
  chapters: string; instructions: string; questionTypes: string[]; questions: Question[];
  answerKey: boolean; markingScheme: boolean; status: string; created_at?: string;
};

const questionTypeOptions = [
  { id: "mcq", label: "MCQ", hint: "Objective · 1 mark" },
  { id: "assertion", label: "Assertion–Reason", hint: "Reasoning" },
  { id: "case", label: "Case-based", hint: "Application" },
  { id: "competency", label: "Competency", hint: "HOTS / skills" },
  { id: "short", label: "Short answer", hint: "2–3 marks" },
  { id: "long", label: "Long answer", hint: "4–6 marks" },
];
const subjectsByClass: Record<string, string[]> = {
  "6": ["Mathematics", "Science", "English", "Social Science"],
  "7": ["Mathematics", "Science", "English", "Social Science"],
  "8": ["Mathematics", "Science", "English", "Social Science"],
  "9": ["Mathematics", "Science", "English", "Social Science"],
  "10": ["Mathematics", "Science", "English", "Social Science"],
  "11": ["Mathematics", "Physics", "Chemistry", "Biology", "English"],
  "12": ["Mathematics", "Physics", "Chemistry", "Biology", "English"],
};
const initialDraft = (): PaperDraft => ({
  title: "Practice Assessment", board: "CBSE", className: "8", subject: "Mathematics",
  academicYear: "2026–27", totalMarks: 40, duration: 90, difficulty: "Balanced",
  chapters: "", instructions: "All questions are compulsory. Show all necessary working.",
  questionTypes: ["mcq", "short", "long", "case"], questions: [],
  answerKey: true, markingScheme: true, status: "draft",
});

export default function AIPaperSetter() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PaperDraft>(initialDraft);
  const [activeWorkspace, setActiveWorkspace] = useState("create");
  const [papers, setPapers] = useState<PaperDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBoard, setFilterBoard] = useState("all");
  const [preview, setPreview] = useState(false);

  const subjects = subjectsByClass[draft.className] || subjectsByClass["8"];
  const totalQuestionMarks = useMemo(() => draft.questions.reduce((n, q) => n + Number(q.marks || 0), 0), [draft.questions]);

  const update = <K extends keyof PaperDraft>(key: K, value: PaperDraft[K]) => setDraft(old => ({ ...old, [key]: value }));

  const loadPapers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("ai_generated_papers").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          setPapers([]);
          return;
        }
        throw error;
      }
      setPapers((data || []).map((row: any) => ({ ...row, questions: row.questions || [], questionTypes: row.question_types || [] })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load saved papers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPapers(); }, []);

  const generateDraft = () => {
    if (!draft.subject.trim() || !draft.chapters.trim()) {
      toast.error("Enter a subject and at least one chapter or syllabus unit.");
      return;
    }
    // Ask the authenticated server-side function to generate structured questions.
    // No provider secret is ever exposed to this browser client.
    setLoading(true);
    void supabase.functions.invoke("ai-paper-setter", { body: {
      board: draft.board, className: draft.className, subject: draft.subject,
      chapters: draft.chapters, totalMarks: draft.totalMarks, duration: draft.duration,
      difficulty: draft.difficulty, questionTypes: draft.questionTypes,
      academicYear: draft.academicYear, instructions: draft.instructions,
    }}).then(({ data, error }) => {
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!questions.length) throw new Error("The AI provider returned no questions. Please retry.");
      update("questions", questions.map((q: any, i: number) => ({
        id: q.id || crypto.randomUUID(), type: String(q.type || "Question"),
        text: String(q.text || q.question || ""), marks: Number(q.marks || 0),
        options: Array.isArray(q.options) ? q.options.map(String) : undefined,
        answer: q.answer ? String(q.answer) : undefined,
        explanation: q.explanation ? String(q.explanation) : undefined,
      })));
      setPreview(true);
      toast.success("AI draft generated. Verify the questions and answer key before use.");
    }).catch((error) => toast.error(error instanceof Error ? error.message : "AI generation failed."))
      .finally(() => setLoading(false));
  };

  const savePaper = async () => {
    if (!draft.questions.length) {
      toast.error("Create the paper structure before saving.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again to save papers.");
      const payload = {
        created_by: auth.user.id, title: draft.title, board: draft.board,
        class_name: draft.className, subject: draft.subject,
        academic_year: draft.academicYear, total_marks: draft.totalMarks,
        duration_minutes: draft.duration, difficulty: draft.difficulty,
        chapters: draft.chapters, instructions: draft.instructions,
        question_types: draft.questionTypes, questions: draft.questions,
        answer_key: draft.answerKey, marking_scheme: draft.markingScheme,
        status: "draft",
      };
      const query = draft.id
        ? supabase.from("ai_generated_papers").update(payload).eq("id", draft.id).select().single()
        : supabase.from("ai_generated_papers").insert(payload).select().single();
      const { data, error } = await query;
      if (error) throw error;
      setDraft(old => ({ ...old, id: data.id, created_at: data.created_at }));
      toast.success("Paper draft saved.");
      await loadPapers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the paper. Check the module database migration.");
    } finally {
      setSaving(false);
    }
  };

  const openPaper = (paper: PaperDraft) => {
    setDraft({ ...initialDraft(), ...paper, questions: paper.questions || [], questionTypes: paper.questionTypes || [] });
    setPreview(true);
    setActiveWorkspace("create");
  };

  const exportPaper = () => {
    if (!draft.questions.length) return;
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
    const questions = draft.questions.map((q, i) => `<article class="q"><b>Q${i + 1}. ${esc(q.text)}</b><span class="marks">[${q.marks} marks]</span>${q.options ? `<ol type="A">${q.options.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}</article>`).join("");
    const answer = draft.answerKey ? `<h2>Answer Key — teacher verification required</h2>${draft.questions.map((q, i) => `<p><b>Q${i + 1}.</b> ${esc(q.answer || "To be completed")}</p>`).join("")}` : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(draft.title)}</title><style>body{font:14px Arial;color:#111;margin:28px;line-height:1.5}h1,h2{text-align:center}.meta{display:flex;justify-content:space-between;border-block:1px solid #aaa;padding:8px 0}.q{margin:18px 0;break-inside:avoid}.marks{float:right}.foot{margin-top:22px;font-size:12px;color:#555}@media print{button{display:none}}</style></head><body><h1>RAMANUJAN ACADEMY</h1><h2>${esc(draft.title)}</h2><div class="meta"><span>${draft.board} · Class ${esc(draft.className)} · ${esc(draft.subject)}</span><span>Marks: ${draft.totalMarks} · Duration: ${draft.duration} min</span></div><p><b>Instructions:</b> ${esc(draft.instructions)}</p>${questions}${answer}<p class="foot">AI-assisted draft. Verify syllabus alignment, factual accuracy, mark totals and board pattern before printing or sharing.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const win = window.open(url, "_blank");
    if (!win) toast.error("Allow pop-ups to export the paper.");
  };

  const filteredPapers = papers.filter(p => (filterBoard === "all" || p.board === filterBoard) && `${p.title} ${p.subject} ${p.className}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/80 via-background to-background dark:from-indigo-950/20 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/dashboard")} className="rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard</Button>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-2xl sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap items-center gap-3"><img src="/ramanujan-academy-logo.svg" alt="Ramanujan Academy logo" className="h-16 w-16 rounded-full bg-white object-contain p-1 shadow-lg ring-2 ring-white/40" /><div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide backdrop-blur"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> RAMANUJAN ACADEMY · ACADEMICS INTELLIGENCE</div></div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">AI Paper Setter</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">Build structured question papers, manage drafts and prepare print-ready assessments from one focused academic workspace.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[["Saved papers", papers.length], ["Current marks", draft.totalMarks], ["Questions", draft.questions.length]].map(([label, value]) => <div key={String(label)} className="min-w-24 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-[11px] text-indigo-100">{label}</p></div>)}
            </div>
          </div>
        </motion.section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Board aware", desc: "Keep CBSE and ICSE configurations distinct.", icon: GraduationCap, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950" },
            { title: "Question mix", desc: "Balance objective, case and descriptive types.", icon: Layers3, color: "text-violet-600 bg-violet-100 dark:bg-violet-950" },
            { title: "Teacher review", desc: "Review each draft before publishing.", icon: ShieldCheck, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950" },
            { title: "Print ready", desc: "Preview and export a clean paper layout.", icon: FileCheck2, color: "text-sky-600 bg-sky-100 dark:bg-sky-950" },
          ].map(({ title, desc, icon: Icon, color }) => <Card key={title} className="rounded-2xl border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-start gap-3 p-4"><div className={`rounded-xl p-2.5 ${color}`}><Icon className="h-5 w-5" /></div><div><p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></div></CardContent></Card>)}
        </div>

        <Tabs value={activeWorkspace} onValueChange={setActiveWorkspace} className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl border bg-card p-1.5">
            <TabsTrigger value="create" className="gap-2 rounded-xl py-3"><WandSparkles className="h-4 w-4" /><span className="hidden sm:inline">Paper Builder</span><span className="sm:hidden">Builder</span></TabsTrigger>
            <TabsTrigger value="library" className="gap-2 rounded-xl py-3"><Library className="h-4 w-4" /><span>Paper Library</span></TabsTrigger>
            <TabsTrigger value="guide" className="gap-2 rounded-xl py-3"><BookOpen className="h-4 w-4" /><span className="hidden sm:inline">Pattern Guide</span><span className="sm:hidden">Guide</span></TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-5">
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
              <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="border-b bg-muted/20 px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-xl"><SlidersHorizontal className="h-5 w-5 text-primary" /> Paper configuration</CardTitle><CardDescription className="mt-1">Set the assessment scope and structure.</CardDescription></div><Badge variant="outline" className="rounded-lg">Step 1 of 2</Badge></div></CardHeader>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Paper title</Label><Input value={draft.title} onChange={e => update("title", e.target.value)} className="h-11 rounded-xl" /></div>
                    <div className="space-y-2"><Label>Academic year</Label><Input value={draft.academicYear} onChange={e => update("academicYear", e.target.value)} className="h-11 rounded-xl" /></div>
                    <div className="space-y-2"><Label>Board / curriculum</Label><Select value={draft.board} onValueChange={v => update("board", v as PaperDraft["board"])}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CBSE">CBSE</SelectItem><SelectItem value="ICSE">ICSE</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Class / standard</Label><Select value={draft.className} onValueChange={v => { update("className", v); if (!(subjectsByClass[v] || []).includes(draft.subject)) update("subject", (subjectsByClass[v] || ["Mathematics"])[0]); }}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(subjectsByClass).map(v => <SelectItem key={v} value={v}>Class {v}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Subject</Label><Select value={draft.subject} onValueChange={v => update("subject", v)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{subjects.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Total marks</Label><Select value={String(draft.totalMarks)} onValueChange={v => update("totalMarks", Number(v))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{[20, 25, 30, 40, 50, 80, 100].map(v => <SelectItem key={v} value={String(v)}>{v} marks</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Duration</Label><Select value={String(draft.duration)} onValueChange={v => update("duration", Number(v))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{[30, 45, 60, 90, 120, 180].map(v => <SelectItem key={v} value={String(v)}>{v} minutes</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Difficulty level</Label><Select value={draft.difficulty} onValueChange={v => update("difficulty", v)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["Easy", "Moderate", "Difficult", "Balanced"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="space-y-2"><Label>Chapters / units</Label><Textarea value={draft.chapters} onChange={e => update("chapters", e.target.value)} placeholder="Example: Rational Numbers, Linear Equations, Understanding Quadrilaterals…" rows={3} className="rounded-xl" /><p className="text-xs text-muted-foreground">Use chapter names from the current prescribed textbook or syllabus. Multiple chapters can be separated by commas.</p></div>
                  <div className="space-y-3"><div><Label>Question type mix</Label><p className="mt-1 text-xs text-muted-foreground">Choose the formats to include in the paper.</p></div><div className="grid gap-2 sm:grid-cols-2">{questionTypeOptions.map(o => <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${draft.questionTypes.includes(o.id) ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40"}`}><Checkbox checked={draft.questionTypes.includes(o.id)} onCheckedChange={checked => update("questionTypes", checked ? [...draft.questionTypes, o.id] : draft.questionTypes.filter(k => k !== o.id))} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{o.label}</span><span className="block text-xs text-muted-foreground">{o.hint}</span></span></label>)}</div></div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={draft.answerKey} onCheckedChange={v => update("answerKey", Boolean(v))} /><span><span className="block text-sm font-medium">Include answer key</span><span className="text-xs text-muted-foreground">Draft answers for teacher review</span></span></label><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={draft.markingScheme} onCheckedChange={v => update("markingScheme", Boolean(v))} /><span><span className="block text-sm font-medium">Include marking scheme</span><span className="text-xs text-muted-foreground">Question-wise mark allocation</span></span></label></div>
                  <div className="space-y-2"><Label>General instructions</Label><Textarea rows={2} value={draft.instructions} onChange={e => update("instructions", e.target.value)} className="rounded-xl" /></div>
                  <Button onClick={generateDraft} className="h-12 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700"><Sparkles className="mr-2 h-4 w-4" /> Build paper structure</Button>
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
                  <CardHeader className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white"><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Assessment overview</CardTitle><CardDescription className="text-indigo-100">Live configuration summary</CardDescription></CardHeader>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Curriculum</span><Badge className="rounded-lg">{draft.board}</Badge></div>
                    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Standard</span><span className="font-semibold">Class {draft.className}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Subject</span><span className="font-semibold">{draft.subject}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Marks / duration</span><span className="font-semibold">{draft.totalMarks} · {draft.duration} min</span></div>
                    <div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Difficulty</span><span className="font-medium">{draft.difficulty}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${draft.difficulty === "Easy" ? "w-1/4 bg-emerald-500" : draft.difficulty === "Moderate" ? "w-2/4 bg-sky-500" : draft.difficulty === "Difficult" ? "w-full bg-rose-500" : "w-3/4 bg-violet-500"}`} /></div></div>
                    <div className="border-t pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected question types</p><div className="flex flex-wrap gap-1.5">{draft.questionTypes.map(k => <Badge key={k} variant="secondary" className="rounded-md">{questionTypeOptions.find(o => o.id === k)?.label || k}</Badge>)}{draft.questionTypes.length === 0 && <span className="text-xs text-muted-foreground">Choose at least one type</span>}</div></div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-border/70 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><CircleHelp className="h-5 w-5" /></div><div><p className="font-semibold">Pattern verification</p><p className="text-xs text-muted-foreground">Check current board documents before finalizing.</p></div></div><p className="text-sm leading-6 text-muted-foreground">CBSE and ICSE differ by class, subject and examination year. This builder does not claim an official paper pattern until a verified syllabus and sample-paper source is attached.</p></CardContent></Card>
                <div className="flex gap-2"><Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => { setDraft(initialDraft()); setPreview(false); }}><RefreshCw className="mr-2 h-4 w-4" /> Reset</Button><Button className="h-11 flex-1 rounded-xl" onClick={savePaper} disabled={!draft.questions.length || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save draft</Button></div>
              </div>
            </div>

            {preview && <Card className="overflow-hidden rounded-3xl border-primary/20 shadow-lg"><CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Paper preview</CardTitle><CardDescription>Editable draft · verify every question before printing.</CardDescription></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={exportPaper}><Printer className="mr-2 h-4 w-4" /> Print / PDF</Button><Button size="sm" onClick={savePaper} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save</Button></div></CardHeader><CardContent className="p-5 sm:p-7"><div className="mx-auto max-w-3xl rounded-xl border bg-white p-5 text-slate-900 shadow-sm sm:p-9"><div className="text-center"><p className="text-xs font-bold tracking-[.22em] text-indigo-600">RAMANUJAN ACADEMY</p><h2 className="mt-2 text-2xl font-bold">{draft.title}</h2><p className="mt-1 text-sm">{draft.board} · Class {draft.className} · {draft.subject} · {draft.academicYear}</p></div><div className="my-5 flex justify-between border-y py-2 text-sm font-semibold"><span>Maximum Marks: {draft.totalMarks}</span><span>Time: {draft.duration} minutes</span></div><p className="mb-4 text-sm"><b>Instructions:</b> {draft.instructions}</p><div className="space-y-5">{draft.questions.map((q,i) => <div key={q.id} className="border-b border-dashed pb-4"><div className="flex items-start justify-between gap-3"><div className="flex-1"><p className="text-sm font-semibold">Q{i+1}. {q.text}</p>{q.options && <ol className="mt-2 ml-6 list-[upper-alpha] space-y-1 text-sm">{q.options.map((o,j)=><li key={j}>{o}</li>)}</ol>}</div><Badge variant="outline" className="shrink-0">{q.marks} M</Badge></div><div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => update("questions", draft.questions.filter(x => x.id !== q.id))}><Trash2 className="mr-1 h-3 w-3" /> Remove</Button></div></div>)}</div><div className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Teacher review required: draft prompts and answer guidance must be replaced/verified. Confirm total marks equal {draft.totalMarks} before use.</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Current question marks: {totalQuestionMarks} / {draft.totalMarks}</span><span className={totalQuestionMarks === draft.totalMarks ? "text-emerald-600" : "text-amber-600"}>{totalQuestionMarks === draft.totalMarks ? "Mark total balanced" : "Check mark total"}</span></div></CardContent></Card>}
          </TabsContent>

          <TabsContent value="library" className="space-y-4">
            <Card className="rounded-3xl border-border/70 shadow-sm"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" /> Saved paper library</CardTitle><CardDescription>Search, reopen and continue editing saved drafts.</CardDescription></div><Button variant="outline" onClick={loadPapers} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button></div></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by paper, subject or class…" className="pl-9" /></div><Select value={filterBoard} onValueChange={setFilterBoard}><SelectTrigger className="w-full sm:w-40"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All boards</SelectItem><SelectItem value="CBSE">CBSE</SelectItem><SelectItem value="ICSE">ICSE</SelectItem></SelectContent></Select></div>{loading ? <div className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading papers…</div> : filteredPapers.length === 0 ? <div className="rounded-2xl border border-dashed py-12 text-center"><Library className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-semibold">No saved papers yet</p><p className="mt-1 text-sm text-muted-foreground">Build and save your first assessment to see it here.</p><Button className="mt-4" onClick={()=>setActiveWorkspace("create")}><Plus className="mr-2 h-4 w-4" /> Create paper</Button></div> : <div className="grid gap-3 md:grid-cols-2">{filteredPapers.map(p=><div key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge>{p.board}</Badge><Badge variant="outline">Class {p.className}</Badge><Badge variant="secondary">{p.totalMarks} marks</Badge></div><p className="mt-2 truncate font-semibold">{p.title}</p><p className="text-sm text-muted-foreground">{p.subject} · {p.difficulty}</p><p className="mt-2 text-xs text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleString("en-IN") : "Saved draft"}</p></div><Button size="sm" variant="outline" onClick={()=>openPaper(p)}><Edit3 className="mr-1 h-4 w-4" /> Open</Button></div>)}</div>}</CardContent></Card>
          </TabsContent>

          <TabsContent value="guide">
            <Card className="rounded-3xl border-border/70"><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Board pattern checklist</CardTitle><CardDescription>Use this checklist before approving a paper.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{[{title:"CBSE",items:["Confirm current academic year and class-specific curriculum.","Use official CBSE sample question paper and marking scheme for the subject.","Check competency-based question requirements and internal choices.","Verify section-wise question count and marks against the official sample."]},{title:"ICSE",items:["Confirm current CISCE syllabus and subject paper structure.","Use the relevant official specimen paper and marking scheme.","Check subject-specific question format, compulsory sections and choices.","Validate terminology, scope and prescribed texts for the selected year."]}].map(board=><div key={board.title} className="rounded-2xl border p-5"><div className="flex items-center gap-2"><Badge className="text-sm">{board.title}</Badge><span className="font-semibold">Verification steps</span></div><ul className="mt-4 space-y-3">{board.items.map(item=><li key={item} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>)}</CardContent></Card>
          </TabsContent>
        </Tabs>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-xs leading-5">Academic quality control: this version creates and saves structured draft templates. It does not yet generate subject-verified question content or certify official CBSE/ICSE pattern compliance. A teacher must validate question accuracy, syllabus coverage, answer key and marking scheme before classroom use.</p></div>
      </div>
    </main>
  );
}
