import { useEffect, useState } from "react";
import { BookOpen, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CLASSES = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"];
const BOARDS = ["CBSE","ICSE","SSC","All"];
const SUBJECTS = ["Mathematics","Science","Physics","Chemistry","Biology","English","Geography","History","Civics","Computer Science","Other"];

type Syllabus = {
  id: string;
  board: string;
  class_level: string;
  subject: string;
  title: string;
  academic_year: string;
  syllabus_content: string;
  is_active: boolean;
  created_at: string;
};

const emptyForm = {
  board: "CBSE",
  class_level: "8th",
  subject: "Science",
  title: "",
  academic_year: "2026-27",
  syllabus_content: "",
};

export function AcademicSyllabusManagement() {
  const { toast } = useToast();
  const [items, setItems] = useState<Syllabus[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("academic_syllabi")
      .select("*")
      .order("class_level")
      .order("subject");
    if (error) toast({ title: "Could not load syllabus", description: error.message, variant: "destructive" });
    setItems((data || []) as Syllabus[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const save = async () => {
    if (!form.title.trim() || !form.syllabus_content.trim()) {
      toast({ title: "Add a syllabus title and content", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      board: form.board,
      class_level: form.class_level,
      subject: form.subject,
      title: form.title.trim(),
      academic_year: form.academic_year.trim() || "2026-27",
      syllabus_content: form.syllabus_content.trim(),
      is_active: true,
    };
    const result = editingId
      ? await supabase.from("academic_syllabi").update(payload).eq("id", editingId)
      : await supabase.from("academic_syllabi").insert(payload);
    if (result.error) {
      toast({ title: "Could not save syllabus", description: result.error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Syllabus updated" : "Syllabus added", description: "Students can now use it in AI Study Planner." });
      reset();
      await load();
    }
    setSaving(false);
  };

  const edit = (item: Syllabus) => {
    setEditingId(item.id);
    setForm({
      board: item.board,
      class_level: item.class_level,
      subject: item.subject,
      title: item.title,
      academic_year: item.academic_year,
      syllabus_content: item.syllabus_content,
    });
    setShowForm(true);
    window.setTimeout(() => document.getElementById("syllabus-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this syllabus? Students will no longer receive it in the planner.")) return;
    const { error } = await supabase.from("academic_syllabi").delete().eq("id", id);
    if (error) toast({ title: "Could not delete syllabus", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Syllabus deleted" });
      setItems(prev => prev.filter(x => x.id !== id));
    }
  };

  const extractFile = async (file: File) => {
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      if (sessionData.session?.access_token) headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) throw new Error("Could not extract the syllabus file.");
      const result = await response.json();
      if (!result.text?.trim()) throw new Error("No readable text was found in the file.");
      setForm(prev => ({ ...prev, syllabus_content: prev.syllabus_content ? prev.syllabus_content + "\n\n" + result.text : result.text }));
      toast({ title: "Syllabus file imported", description: `${result.text.length} characters extracted.` });
    } catch (error) {
      toast({ title: "File import failed", description: error instanceof Error ? error.message : "Try pasting the syllabus text.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/15">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-background to-amber-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Academy Syllabus Library</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Manage the syllabus that powers the student AI Study Planner.</p>
            </div>
            <Button onClick={() => { reset(); setShowForm(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Syllabus
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showForm && (
        <Card id="syllabus-editor" className="border-primary/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{editingId ? "Edit Syllabus" : "Add Academy Syllabus"}</CardTitle>
              <Button size="icon" variant="ghost" onClick={reset}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><Label>Board</Label><NativeSelect value={form.board} onValueChange={v => setForm(p => ({ ...p, board: v }))} options={BOARDS.map(v => ({ value: v, label: v }))} /></div>
              <div><Label>Class</Label><NativeSelect value={form.class_level} onValueChange={v => setForm(p => ({ ...p, class_level: v }))} options={CLASSES.map(v => ({ value: v, label: v }))} /></div>
              <div><Label>Subject</Label><NativeSelect value={form.subject} onValueChange={v => setForm(p => ({ ...p, subject: v }))} options={SUBJECTS.map(v => ({ value: v, label: v }))} /></div>
              <div><Label>Academic Year</Label><Input value={form.academic_year} onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))} /></div>
            </div>
            <div><Label>Syllabus Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Class 8 CBSE Science Full Year Syllabus" /></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" disabled={extracting} onClick={() => document.getElementById("syllabus-file")?.click()}>
                {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Import PDF / DOC / TXT
              </Button>
              <input id="syllabus-file" type="file" accept=".pdf,.doc,.docx,.txt,.md" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void extractFile(file); e.currentTarget.value = ""; }} />
              <span className="text-xs text-muted-foreground">or paste the syllabus below</span>
            </div>
            <Textarea value={form.syllabus_content} onChange={e => setForm(p => ({ ...p, syllabus_content: e.target.value }))} placeholder="Paste chapter names, units, topics, learning outcomes, practicals, etc." className="min-h-[280px]" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editingId ? "Update Syllabus" : "Save Syllabus"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Published Syllabus</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-10 text-center text-muted-foreground">Loading syllabus...</div> : items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No syllabus added yet</p>
              <p className="text-sm text-muted-foreground">Add your CBSE / ICSE / SSC syllabus here. Students will see it automatically in Study Planner.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map(item => (
                <div key={item.id} className="rounded-2xl border p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{item.board}</Badge>
                        <Badge variant="outline">Class {item.class_level}</Badge>
                        <Badge variant="outline">{item.subject}</Badge>
                        <Badge variant="outline">{item.academic_year}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">{item.syllabus_content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
