import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Eye, CheckCircle, Clock, FileText, Send,
  Loader2, X, ChevronDown, ChevronRight, Pencil, GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OnlineTest {
  id: string;
  title: string;
  description: string | null;
  class: string;
  subject: string;
  test_type: string;
  duration_minutes: number;
  max_marks: number;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

interface TestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string | null;
  marks: number;
  question_order: number;
}

interface Submission {
  id: string;
  test_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  total_marks_obtained: number;
  is_graded: boolean;
  status: string;
}

interface Answer {
  id: string;
  submission_id: string;
  question_id: string;
  answer_text: string | null;
  is_correct: boolean | null;
  marks_awarded: number;
}

const CLASSES = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

const OnlineTestManagement = ({ students }: { students: { id: string; name: string; class: string }[] }) => {
  const { toast } = useToast();
  const [tests, setTests] = useState<OnlineTest[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<OnlineTest | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);

  const [newTest, setNewTest] = useState({
    title: "", description: "", class: "10th", subject: "",
    test_type: "mcq", duration_minutes: 60, max_marks: 100,
    starts_at: "", ends_at: "",
  });

  const [newQuestion, setNewQuestion] = useState({
    question_text: "", question_type: "mcq",
    options: ["", "", "", ""], correct_answer: "", marks: 1,
  });

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    const { data } = await supabase.from("online_tests").select("*").order("created_at", { ascending: false });
    if (data) setTests(data as OnlineTest[]);
  };

  const createTest = async () => {
    if (!newTest.title.trim() || !newTest.subject.trim()) {
      toast({ title: "Title and subject are required", variant: "destructive" });
      return;
    }
    if (newTest.duration_minutes <= 0 || newTest.max_marks <= 0) {
      toast({ title: "Duration and max marks must be greater than zero", variant: "destructive" });
      return;
    }
    if (newTest.starts_at && newTest.ends_at && new Date(newTest.ends_at) <= new Date(newTest.starts_at)) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("online_tests").insert({
      title: newTest.title.trim(),
      description: newTest.description.trim() || null,
      class: newTest.class,
      subject: newTest.subject.trim(),
      test_type: newTest.test_type,
      duration_minutes: newTest.duration_minutes,
      max_marks: newTest.max_marks,
      starts_at: newTest.starts_at || null,
      ends_at: newTest.ends_at || null,
    });
    if (error) {
      console.error("Online test creation failed:", error);
      toast({ title: "Failed to create test", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Test created!" });
      setIsCreateOpen(false);
      setNewTest({ title: "", description: "", class: "10th", subject: "", test_type: "mcq", duration_minutes: 60, max_marks: 100, starts_at: "", ends_at: "" });
      loadTests();
    }
    setLoading(false);
  };

  const togglePublish = async (test: OnlineTest) => {
    const { error } = await supabase
      .from("online_tests")
      .update({ is_published: !test.is_published })
      .eq("id", test.id);
    if (error) {
      console.error("Online test publish failed:", error);
      toast({ title: "Could not update publication", description: error.message, variant: "destructive" });
      return;
    }
    await loadTests();
    toast({
      title: test.is_published ? "Test unpublished" : "Test published!",
      description: test.is_published
        ? "The test is no longer available to students."
        : "The test is now visible in the matching parent portal and a parent notification has been queued.",
    });
  };

  const deleteTest = async (id: string) => {
    await supabase.from("online_tests").delete().eq("id", id);
    loadTests();
    toast({ title: "Test deleted" });
  };

  const openQuestions = async (test: OnlineTest) => {
    setSelectedTest(test);
    const { data } = await supabase.from("online_test_questions").select("*").eq("test_id", test.id).order("question_order");
    setQuestions((data || []) as TestQuestion[]);
    setIsQuestionsOpen(true);
  };

  const addQuestion = async () => {
    if (!selectedTest || !newQuestion.question_text.trim()) return;
    setLoading(true);
    const qData: any = {
      test_id: selectedTest.id,
      question_text: newQuestion.question_text,
      question_type: newQuestion.question_type,
      marks: newQuestion.marks,
      question_order: questions.length,
    };
    if (newQuestion.question_type === "mcq") {
      qData.options = newQuestion.options.filter(o => o.trim());
      qData.correct_answer = newQuestion.correct_answer;
    }
    const { error } = await supabase.from("online_test_questions").insert(qData);
    if (error) toast({ title: "Failed to add question", variant: "destructive" });
    else {
      toast({ title: "Question added! ✅" });
      setNewQuestion({ question_text: "", question_type: "mcq", options: ["", "", "", ""], correct_answer: "", marks: 1 });
      const { data } = await supabase.from("online_test_questions").select("*").eq("test_id", selectedTest.id).order("question_order");
      setQuestions((data || []) as TestQuestion[]);
    }
    setLoading(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!selectedTest) return;
    await supabase.from("online_test_questions").delete().eq("id", id);
    const { data } = await supabase.from("online_test_questions").select("*").eq("test_id", selectedTest.id).order("question_order");
    setQuestions((data || []) as TestQuestion[]);
    toast({ title: "Question removed" });
  };

  const openGrading = async (test: OnlineTest) => {
    setSelectedTest(test);
    const { data: subs } = await supabase.from("online_test_submissions").select("*").eq("test_id", test.id);
    setSubmissions((subs || []) as Submission[]);
    if (subs?.length) {
      const subIds = subs.map(s => s.id);
      const { data: ans } = await supabase.from("online_test_answers").select("*").in("submission_id", subIds);
      setAnswers((ans || []) as Answer[]);
    } else {
      setAnswers([]);
    }
    const { data: qs } = await supabase.from("online_test_questions").select("*").eq("test_id", test.id).order("question_order");
    setQuestions((qs || []) as TestQuestion[]);
    setIsGradingOpen(true);
  };

  const gradeAnswer = async (answerId: string, marks: number, isCorrect: boolean) => {
    await supabase.from("online_test_answers").update({ marks_awarded: marks, is_correct: isCorrect }).eq("id", answerId);
    setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, marks_awarded: marks, is_correct: isCorrect } : a));
  };

  const finalizeGrading = async (submission: Submission) => {
    const subAnswers = answers.filter(a => a.submission_id === submission.id);
    const total = subAnswers.reduce((sum, a) => sum + (a.marks_awarded || 0), 0);
    await supabase.from("online_test_submissions").update({
      total_marks_obtained: total, is_graded: true, status: "graded"
    }).eq("id", submission.id);
    setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, total_marks_obtained: total, is_graded: true, status: "graded" } : s));
    toast({ title: `✅ Graded! Total: ${total} marks` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Online Tests</h3>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Test
        </Button>
      </div>

      <div className="space-y-3">
        {tests.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No online tests yet. Create one to get started!</p>
          </Card>
        )}
        {tests.map(test => (
          <motion.div key={test.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{test.title}</h4>
                    <Badge variant={test.is_published ? "default" : "secondary"}>
                      {test.is_published ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant="outline">{test.test_type.toUpperCase()}</Badge>
                    <Badge variant="outline">Class {test.class}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {test.subject} • {test.duration_minutes} min • {test.max_marks} marks
                  </p>
                  {test.description && <p className="text-xs text-muted-foreground mt-1">{test.description}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openQuestions(test)} className="gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Questions
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openGrading(test)} className="gap-1">
                    <Eye className="w-3.5 h-3.5" /> Grade
                  </Button>
                  <Button size="sm" variant={test.is_published ? "secondary" : "default"} onClick={() => togglePublish(test)}>
                    {test.is_published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteTest(test.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Online Test</DialogTitle>
            <DialogDescription>Set up a new test for students to take</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={newTest.title} onChange={e => setNewTest({ ...newTest, title: e.target.value })} placeholder="e.g., Mid-term Math Test" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newTest.description} onChange={e => setNewTest({ ...newTest, description: e.target.value })} placeholder="Instructions for students..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Class</Label>
                <select value={newTest.class} onChange={e => setNewTest({ ...newTest, class: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={newTest.subject} onChange={e => setNewTest({ ...newTest, subject: e.target.value })} placeholder="e.g., Mathematics" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <select value={newTest.test_type} onChange={e => setNewTest({ ...newTest, test_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="mcq">MCQ Only</option>
                  <option value="written">Written Only</option>
                  <option value="mixed">MCQ + Written</option>
                </select>
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={newTest.duration_minutes} onChange={e => setNewTest({ ...newTest, duration_minutes: parseInt(e.target.value) || 60 })} />
              </div>
              <div>
                <Label>Max Marks</Label>
                <Input type="number" value={newTest.max_marks} onChange={e => setNewTest({ ...newTest, max_marks: parseInt(e.target.value) || 100 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts At</Label>
                <Input type="datetime-local" value={newTest.starts_at} onChange={e => setNewTest({ ...newTest, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Ends At</Label>
                <Input type="datetime-local" value={newTest.ends_at} onChange={e => setNewTest({ ...newTest, ends_at: e.target.value })} />
              </div>
            </div>
            <Button onClick={createTest} disabled={loading || !newTest.title.trim() || !newTest.subject.trim()} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuestionsOpen} onOpenChange={setIsQuestionsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTest?.title} - Questions</DialogTitle>
            <DialogDescription>{questions.length} question(s) added</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <Card key={q.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Q{i + 1}. {q.question_text}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{q.question_type.toUpperCase()}</Badge>
                      <Badge variant="secondary" className="text-xs">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
                    </div>
                    {q.question_type === "mcq" && q.options && (
                      <div className="mt-2 space-y-1">
                        {(q.options as string[]).map((opt, oi) => (
                          <p key={oi} className={`text-xs pl-3 ${opt === q.correct_answer ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>
                            {String.fromCharCode(65 + oi)}. {opt} {opt === q.correct_answer && "✓"}
                          </p>
                        ))}
                      </div>
                    )}
                    {q.question_type === "written" && q.correct_answer && (
                      <p className="text-xs text-green-600 mt-1">Answer: {q.correct_answer}</p>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}

            <Card className="p-4 border-dashed">
              <h4 className="font-semibold text-sm mb-3">Add Question</h4>
              <div className="space-y-3">
                <Textarea
                  placeholder="Enter question text..."
                  value={newQuestion.question_text}
                  onChange={e => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <select value={newQuestion.question_type} onChange={e => setNewQuestion({ ...newQuestion, question_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {(selectedTest?.test_type === "mcq" || selectedTest?.test_type === "mixed") && <option value="mcq">MCQ</option>}
                      {(selectedTest?.test_type === "written" || selectedTest?.test_type === "mixed") && <option value="written">Written</option>}
                    </select>
                  </div>
                  <div>
                    <Label>Marks</Label>
                    <Input type="number" value={newQuestion.marks} onChange={e => setNewQuestion({ ...newQuestion, marks: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                {newQuestion.question_type === "mcq" && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    {newQuestion.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-medium w-5">{String.fromCharCode(65 + i)}.</span>
                        <Input
                          value={opt}
                          onChange={e => {
                            const opts = [...newQuestion.options];
                            opts[i] = e.target.value;
                            setNewQuestion({ ...newQuestion, options: opts });
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + i)}`}
                          className="flex-1"
                        />
                      </div>
                    ))}
                    <div>
                      <Label>Correct Answer</Label>
                      <select value={newQuestion.correct_answer} onChange={e => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Select correct answer</option>
                        {newQuestion.options.filter(o => o.trim()).map((opt, i) => (
                          <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {newQuestion.question_type === "written" && (
                  <div>
                    <Label>Model Answer (optional, for reference)</Label>
                    <Textarea
                      value={newQuestion.correct_answer}
                      onChange={e => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })}
                      placeholder="Enter the expected answer..."
                    />
                  </div>
                )}
                <Button onClick={addQuestion} disabled={loading || !newQuestion.question_text.trim()} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add Question
                </Button>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGradingOpen} onOpenChange={setIsGradingOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTest?.title} - Submissions & Grading</DialogTitle>
            <DialogDescription>{submissions.length} submission(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {submissions.length === 0 && (
              <p className="text-center text-muted-foreground py-6">No submissions yet</p>
            )}
            {submissions.map(sub => {
              const student = students.find(s => s.id === sub.student_id);
              const subAnswers = answers.filter(a => a.submission_id === sub.id);
              return (
                <Card key={sub.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{student?.name || "Unknown"}</h4>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "In progress"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sub.is_graded ? "default" : sub.status === "submitted" ? "secondary" : "outline"}>
                        {sub.is_graded ? `${sub.total_marks_obtained}/${selectedTest?.max_marks}` : sub.status}
                      </Badge>
                      {sub.status === "submitted" && !sub.is_graded && (
                        <Button size="sm" onClick={() => finalizeGrading(sub)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Finalize
                        </Button>
                      )}
                    </div>
                  </div>
                  {sub.status !== "in_progress" && (
                    <div className="space-y-2 border-t pt-3">
                      {questions.map((q, qi) => {
                        const ans = subAnswers.find(a => a.question_id === q.id);
                        return (
                          <div key={q.id} className="p-2 rounded-lg bg-muted/30 space-y-1">
                            <p className="text-xs font-medium">Q{qi + 1}. {q.question_text}</p>
                            <p className="text-sm">{ans?.answer_text || <span className="text-muted-foreground italic">No answer</span>}</p>
                            {q.correct_answer && (
                              <p className="text-xs text-green-600">Expected: {q.correct_answer}</p>
                            )}
                            {!sub.is_graded && q.question_type === "written" && ans && (
                              <div className="flex items-center gap-2 mt-1">
                                <Label className="text-xs">Marks:</Label>
                                <Input
                                  type="number"
                                  className="w-20 h-7 text-xs"
                                  value={ans.marks_awarded}
                                  onChange={e => gradeAnswer(ans.id, parseFloat(e.target.value) || 0, parseFloat(e.target.value) > 0)}
                                  max={q.marks}
                                  min={0}
                                />
                                <span className="text-xs text-muted-foreground">/ {q.marks}</span>
                              </div>
                            )}
                            {sub.is_graded && (
                              <Badge variant={ans?.is_correct ? "default" : "destructive"} className="text-xs">
                                {ans?.marks_awarded || 0}/{q.marks}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnlineTestManagement;
