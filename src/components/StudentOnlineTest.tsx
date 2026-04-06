import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CheckCircle, FileText, Send, Loader2,
  AlertTriangle, Trophy, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  starts_at: string | null;
  ends_at: string | null;
}

interface TestQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  marks: number;
  question_order: number;
}

interface Props {
  studentId: string;
  studentClass: string;
}

const StudentOnlineTest = ({ studentId, studentClass }: Props) => {
  const { toast } = useToast();
  const [tests, setTests] = useState<OnlineTest[]>([]);
  const [activeTest, setActiveTest] = useState<OnlineTest | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ test_id: string; total: number; max: number; status: string }[]>([]);

  useEffect(() => {
    loadTests();
  }, [studentClass]);

  const loadTests = async () => {
    const { data } = await supabase
      .from("online_tests")
      .select("*")
      .eq("is_published", true)
      .eq("class", studentClass);
    if (data) setTests(data as OnlineTest[]);

    // Load past results
    const { data: subs } = await supabase
      .from("online_test_submissions")
      .select("test_id, total_marks_obtained, status")
      .eq("student_id", studentId);
    if (subs) {
      const res = subs.map(s => {
        const t = (data || []).find((t: any) => t.id === s.test_id);
        return { test_id: s.test_id, total: s.total_marks_obtained as number, max: t?.max_marks || 0, status: s.status };
      });
      setResults(res);
    }
  };

  const startTest = async (test: OnlineTest) => {
    // Check if already submitted
    const existing = results.find(r => r.test_id === test.id);
    if (existing && existing.status !== "in_progress") {
      toast({ title: "You've already submitted this test", variant: "destructive" });
      return;
    }

    setLoading(true);
    // Load questions
    const { data: qs } = await supabase
      .from("online_test_questions")
      .select("id, question_text, question_type, options, marks, question_order")
      .eq("test_id", test.id)
      .order("question_order");
    if (!qs?.length) {
      toast({ title: "No questions in this test yet", variant: "destructive" });
      setLoading(false);
      return;
    }
    setQuestions(qs as TestQuestion[]);

    // Create or resume submission
    let subId: string;
    const { data: existingSub } = await supabase
      .from("online_test_submissions")
      .select("id")
      .eq("test_id", test.id)
      .eq("student_id", studentId)
      .eq("status", "in_progress")
      .maybeSingle();
    
    if (existingSub) {
      subId = existingSub.id;
    } else {
      const { data: newSub, error } = await supabase
        .from("online_test_submissions")
        .insert({ test_id: test.id, student_id: studentId })
        .select("id")
        .single();
      if (error || !newSub) {
        toast({ title: "Failed to start test", variant: "destructive" });
        setLoading(false);
        return;
      }
      subId = newSub.id;
    }

    setSubmissionId(subId);
    setActiveTest(test);
    setTimeLeft(test.duration_minutes * 60);
    setAnswers({});
    setSubmitted(false);
    setLoading(false);
  };

  // Timer
  useEffect(() => {
    if (!activeTest || timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTest, submitted]);

  const handleSubmit = useCallback(async () => {
    if (!submissionId || !activeTest || submitted) return;
    setLoading(true);
    setSubmitted(true);

    // Save all answers
    const answerRows = questions.map(q => {
      const answerText = answers[q.id] || "";
      let isCorrect: boolean | null = null;
      let marksAwarded = 0;

      // Auto-grade MCQ
      if (q.question_type === "mcq") {
        // We need the correct answer - fetch it
        // For now, we'll let the backend handle grading for MCQs too
      }

      return {
        submission_id: submissionId,
        question_id: q.id,
        answer_text: answerText,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
      };
    });

    await supabase.from("online_test_answers").insert(answerRows);

    // Auto-grade MCQs
    const { data: fullQs } = await supabase
      .from("online_test_questions")
      .select("id, correct_answer, marks, question_type")
      .eq("test_id", activeTest.id);

    let autoTotal = 0;
    let allGraded = true;
    for (const q of (fullQs || [])) {
      if (q.question_type === "mcq" && q.correct_answer) {
        const studentAnswer = answers[q.id] || "";
        const correct = studentAnswer === q.correct_answer;
        const marks = correct ? q.marks : 0;
        autoTotal += marks;
        await supabase.from("online_test_answers")
          .update({ is_correct: correct, marks_awarded: marks })
          .eq("submission_id", submissionId)
          .eq("question_id", q.id);
      } else if (q.question_type === "written") {
        allGraded = false;
      }
    }

    await supabase.from("online_test_submissions").update({
      submitted_at: new Date().toISOString(),
      status: allGraded ? "graded" : "submitted",
      total_marks_obtained: autoTotal,
      is_graded: allGraded,
    }).eq("id", submissionId);

    toast({ title: allGraded ? `✅ Test submitted! Score: ${autoTotal}/${activeTest.max_marks}` : "✅ Test submitted! Written answers will be graded by your teacher." });
    setLoading(false);
    loadTests();
  }, [submissionId, activeTest, submitted, questions, answers, toast]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (activeTest && !submitted) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {/* Test Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10 p-3 rounded-xl">
          <div>
            <h3 className="font-bold text-sm">{activeTest.title}</h3>
            <p className="text-xs text-muted-foreground">{activeTest.subject} • {activeTest.max_marks} marks</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold ${timeLeft < 60 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted"}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {questions.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <Badge variant="secondary" className="shrink-0">{q.marks}m</Badge>
                  <p className="text-sm font-medium">{q.question_text}</p>
                </div>
                {q.question_type === "mcq" && q.options ? (
                  <div className="space-y-1.5 ml-8">
                    {(q.options as string[]).map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                          answers[q.id] === opt
                            ? "border-primary bg-primary/5 font-medium"
                            : "border-border/40 hover:border-primary/40"
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Write your answer..."
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    className="ml-8 mt-1 min-h-[80px] text-sm"
                  />
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <Button onClick={handleSubmit} className="w-full" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Submit Test
        </Button>
      </motion.div>
    );
  }

  // Test list
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="text-center py-3">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-2">
          <FileText className="w-6 h-6 text-green-500" />
        </div>
        <h3 className="font-bold text-sm">Online Tests</h3>
        <p className="text-[10px] text-muted-foreground">Complete tests assigned by your teachers</p>
      </div>

      {tests.length === 0 && (
        <p className="text-center text-muted-foreground text-xs py-6">No tests available for your class right now</p>
      )}

      {tests.map(test => {
        const result = results.find(r => r.test_id === test.id);
        const isCompleted = result && result.status !== "in_progress";
        return (
          <motion.div key={test.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Card
              className={`p-3 cursor-pointer transition-all hover:shadow-md ${isCompleted ? "opacity-75" : ""}`}
              onClick={() => !isCompleted && startTest(test)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{test.title}</h4>
                    <Badge variant="outline" className="text-[10px]">{test.test_type.toUpperCase()}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{test.subject} • {test.duration_minutes} min • {test.max_marks} marks</p>
                </div>
                {isCompleted ? (
                  <Badge variant={result.status === "graded" ? "default" : "secondary"}>
                    {result.status === "graded" ? `${result.total}/${result.max}` : "Pending Grade"}
                  </Badge>
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}

      {submitted && activeTest && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800">
          <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="font-bold">Test Submitted!</p>
          <p className="text-xs text-muted-foreground mt-1">Your results will appear here once graded</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => { setActiveTest(null); setSubmitted(false); }}>
            Back to Tests
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StudentOnlineTest;
