import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Network, StickyNote, Plus, Trash2, Save,
  BookOpen, Loader2, ChevronRight, ChevronDown, X, FileText,
  Trophy, Brain, Wand2, CheckCircle2, XCircle, Upload, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;

type Msg = { role: "user" | "assistant"; content: string };

interface MindMapNode { title: string; children: MindMapNode[]; }

interface Note {
  id: string; title: string; content: string;
  createdAt: string; updatedAt: string;
}

interface QuizQuestion {
  question: string; options: string[];
  correct: number; explanation: string;
}

interface Quiz {
  title: string; questions: QuizQuestion[];
}

// ─── RA Points Manager ───
function getRAPoints(): { points: number; lastReset: string } {
  try {
    const stored = JSON.parse(localStorage.getItem("ra_points") || "{}");
    const now = new Date();
    const lastReset = stored.lastReset ? new Date(stored.lastReset) : null;
    if (!lastReset || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      const fresh = { points: 100, lastReset: now.toISOString() };
      localStorage.setItem("ra_points", JSON.stringify(fresh));
      return fresh;
    }
    return stored;
  } catch {
    return { points: 100, lastReset: new Date().toISOString() };
  }
}

function useRAPoints() {
  const [data, setData] = useState(getRAPoints);

  const spend = (n: number) => {
    const cur = getRAPoints();
    if (cur.points < n) return false;
    const next = { ...cur, points: cur.points - n };
    localStorage.setItem("ra_points", JSON.stringify(next));
    setData(next);
    return true;
  };

  const earn = (n: number) => {
    const cur = getRAPoints();
    const next = { ...cur, points: cur.points + n };
    localStorage.setItem("ra_points", JSON.stringify(next));
    setData(next);
  };

  return { points: data.points, spend, earn };
}

// ─── JSON extractor ───
function extractJson<T>(response: string): T | null {
  let cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const s = cleaned.indexOf("{"); const e = cleaned.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  cleaned = cleaned.substring(s, e + 1).replace(/[\x00-\x1F\x7F]/g, ch =>
    ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""
  );
  try { return JSON.parse(cleaned); } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try { return JSON.parse(cleaned); } catch { return null; }
  }
}

// ─── Streaming helper ───
async function streamChat({ messages, mode, sourceText, onDelta, onDone }: {
  messages: Msg[]; mode: string; sourceText?: string;
  onDelta: (t: string) => void; onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, mode, sourceText }),
  });
  if (!resp.ok || !resp.body) {
    if (resp.status === 429) throw new Error("Rate limit exceeded. Please wait a moment.");
    if (resp.status === 402) throw new Error("AI credits exhausted.");
    throw new Error("Failed to get AI response");
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let ni: number;
    while ((ni = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, ni); buf = buf.slice(ni + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || !line.trim() || !line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); }
      catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

// ─── Non-streaming fetch ───
async function fetchAI(messages: Msg[], mode: string, sourceText?: string) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, mode, sourceText }),
  });
  if (!resp.ok) throw new Error("AI request failed");
  return resp.json();
}

// ─── Mind Map Renderer ───
const MindMapNodeView = ({ node, depth = 0 }: { node: MindMapNode; depth?: number }) => {
  const [open, setOpen] = useState(true);
  const colors = [
    "border-l-4 border-blue-400 bg-blue-50/80 dark:bg-blue-950/30",
    "border-l-4 border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30",
    "border-l-4 border-purple-400 bg-purple-50/80 dark:bg-purple-950/30",
    "border-l-4 border-amber-400 bg-amber-50/80 dark:bg-amber-950/30",
    "border-l-4 border-rose-400 bg-rose-50/80 dark:bg-rose-950/30",
  ];
  const hasChildren = node.children?.length > 0;
  return (
    <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: depth * 0.04 }} className="ml-2">
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-r-lg ${colors[depth % 5]} mb-1.5 cursor-pointer transition-all hover:shadow-sm`}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />) : <span className="w-2 h-2 rounded-full bg-foreground/40 shrink-0" />}
        <span className="text-sm font-medium">{node.title}</span>
      </div>
      <AnimatePresence>
        {open && hasChildren && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="ml-4 border-l-2 border-muted pl-2">
            {node.children.map((c, i) => <MindMapNodeView key={i} node={c} depth={depth + 1} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Component ───
const StudyAssistant = ({ studentName }: { studentName: string }) => {
  const { toast } = useToast();
  const { points, spend, earn } = useRAPoints();

  // Chat
  const [chatMessages, setChatMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Notebook (our built-in NotebookLM)
  const [notebookSource, setNotebookSource] = useState("");
  const [notebookMessages, setNotebookMessages] = useState<Msg[]>([]);
  const [notebookInput, setNotebookInput] = useState("");
  const [isNotebookLoading, setIsNotebookLoading] = useState(false);
  const [sourceUploaded, setSourceUploaded] = useState(false);
  const notebookEndRef = useRef<HTMLDivElement>(null);

  // Mind Map
  const [mindMapSource, setMindMapSource] = useState("");
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [isMindMapLoading, setIsMindMapLoading] = useState(false);

  // Quiz
  const [quizTopic, setQuizTopic] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(localStorage.getItem("student_notes") || "[]"); } catch { return []; }
  });
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isNoteSolving, setIsNoteSolving] = useState(false);
  const [noteSolution, setNoteSolution] = useState("");

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { notebookEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [notebookMessages]);
  useEffect(() => { localStorage.setItem("student_notes", JSON.stringify(notes)); }, [notes]);

  // ─── Chat ───
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;
    if (!spend(1)) { toast({ title: "Not enough RA Points! 😅", description: "Earn points by taking quizzes.", variant: "destructive" }); return; }
    const userMsg: Msg = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);
    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        return [...prev, { role: "assistant", content: assistant }];
      });
    };
    try {
      await streamChat({ messages: [...chatMessages, userMsg], mode: "chat", onDelta: upsert, onDone: () => setIsChatLoading(false) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to get AI response", variant: "destructive" });
      setIsChatLoading(false);
    }
  }, [chatInput, chatMessages, isChatLoading, toast, spend]);

  // ─── Notebook ───
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setNotebookSource(prev => prev + "\n\n" + text);
      setSourceUploaded(true);
      toast({ title: `📄 "${file.name}" uploaded!`, description: "You can now ask questions about this material." });
    };
    if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      reader.readAsText(file);
    } else {
      toast({ title: "Supported: .txt, .md files", description: "For PDFs, paste the text content directly.", variant: "destructive" });
    }
  };

  const sendNotebook = useCallback(async () => {
    if (!notebookInput.trim() || isNotebookLoading) return;
    if (!notebookSource.trim()) { toast({ title: "Please add source material first!", variant: "destructive" }); return; }
    if (!spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    const userMsg: Msg = { role: "user", content: notebookInput.trim() };
    setNotebookMessages(prev => [...prev, userMsg]);
    setNotebookInput("");
    setIsNotebookLoading(true);
    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      setNotebookMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        return [...prev, { role: "assistant", content: assistant }];
      });
    };
    try {
      await streamChat({ messages: [...notebookMessages, userMsg], mode: "notebook", sourceText: notebookSource, onDelta: upsert, onDone: () => setIsNotebookLoading(false) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
      setIsNotebookLoading(false);
    }
  }, [notebookInput, notebookMessages, notebookSource, isNotebookLoading, toast, spend]);

  // ─── Mind Map ───
  const generateMindMap = async () => {
    if (!mindMapSource.trim()) return;
    if (!spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    setIsMindMapLoading(true);
    setMindMapData(null);
    let raw = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: mindMapSource.trim() }], mode: "mindmap",
        onDelta: (c) => { raw += c; },
        onDone: () => {
          const parsed = extractJson<MindMapNode>(raw);
          if (parsed) setMindMapData(parsed);
          else toast({ title: "Failed to parse mind map. Try again.", variant: "destructive" });
          setIsMindMapLoading(false);
        },
      });
    } catch { toast({ title: "Failed to generate mind map", variant: "destructive" }); setIsMindMapLoading(false); }
  };

  // ─── Quiz ───
  const generateQuiz = async () => {
    if (!quizTopic.trim()) return;
    if (!spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    setIsQuizLoading(true);
    setQuiz(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    try {
      const data = await fetchAI([{ role: "user", content: `Generate a quiz about: ${quizTopic.trim()}` }], "quiz");
      const parsed = extractJson<Quiz>(data.content);
      if (parsed?.questions?.length) setQuiz(parsed);
      else toast({ title: "Failed to generate quiz. Try again.", variant: "destructive" });
    } catch {
      toast({ title: "Failed to generate quiz", variant: "destructive" });
    } finally { setIsQuizLoading(false); }
  };

  const submitQuiz = () => {
    if (!quiz) return;
    setQuizSubmitted(true);
    const correct = quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length;
    earn(correct * 2); // 2 points per correct answer
    toast({ title: `🎉 Score: ${correct}/${quiz.questions.length}`, description: `You earned ${correct * 2} RA Points!` });
  };

  // ─── Notes AI Solve ───
  const solveNote = async () => {
    if (!noteContent.trim()) return;
    if (!spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    setIsNoteSolving(true);
    setNoteSolution("");
    let sol = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: noteContent.trim() }], mode: "solve",
        onDelta: (c) => { sol += c; setNoteSolution(sol); },
        onDone: () => setIsNoteSolving(false),
      });
    } catch { toast({ title: "Failed to solve", variant: "destructive" }); setIsNoteSolving(false); }
  };

  // Notes CRUD
  const createNote = () => {
    const note: Note = { id: crypto.randomUUID(), title: "Untitled Note", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setNotes(prev => [note, ...prev]);
    setActiveNote(note); setNoteTitle(note.title); setNoteContent(note.content); setNoteSolution("");
  };
  const saveNote = () => {
    if (!activeNote) return;
    const updated = { ...activeNote, title: noteTitle || "Untitled", content: noteContent, updatedAt: new Date().toISOString() };
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setActiveNote(updated);
    toast({ title: "Note saved! ✅" });
  };
  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote?.id === id) { setActiveNote(null); setNoteTitle(""); setNoteContent(""); setNoteSolution(""); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-primary/20 overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
                <Sparkles className="w-5 h-5 text-primary" />
              </motion.div>
              AI Study Hub
            </CardTitle>
            <motion.div
              key={points}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full"
            >
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-sm">{points}</span>
              <span className="text-xs text-muted-foreground">RA</span>
            </motion.div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hi {studentName}! 1 point per AI query • Earn points via quizzes 🎯
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="w-full rounded-none grid grid-cols-5 h-11 bg-muted/50">
              <TabsTrigger value="chat" className="flex items-center gap-1 text-[10px] sm:text-xs">
                <Bot className="w-3.5 h-3.5" /> Ask AI
              </TabsTrigger>
              <TabsTrigger value="notebook" className="flex items-center gap-1 text-[10px] sm:text-xs">
                <BookOpen className="w-3.5 h-3.5" /> Notebook
              </TabsTrigger>
              <TabsTrigger value="quiz" className="flex items-center gap-1 text-[10px] sm:text-xs">
                <Brain className="w-3.5 h-3.5" /> Quiz
              </TabsTrigger>
              <TabsTrigger value="mindmap" className="flex items-center gap-1 text-[10px] sm:text-xs">
                <Network className="w-3.5 h-3.5" /> Map
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1 text-[10px] sm:text-xs">
                <StickyNote className="w-3.5 h-3.5" /> Notes
              </TabsTrigger>
            </TabsList>

            {/* ─── AI Chat ─── */}
            <TabsContent value="chat" className="m-0 p-3">
              <div className="h-[320px] overflow-y-auto border rounded-xl p-3 space-y-3 bg-muted/20 mb-3">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <Bot className="w-10 h-10 opacity-30" />
                    </motion.div>
                    <p className="text-xs text-center">Ask me anything! 📚 Math, Science, History...</p>
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  {chatMessages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border shadow-sm rounded-bl-sm"}`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-background border shadow-sm px-4 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                <Input placeholder="Ask a question... 🎓" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isChatLoading} className="rounded-full text-sm" />
                <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={isChatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </TabsContent>

            {/* ─── Notebook (Built-in NotebookLM) ─── */}
            <TabsContent value="notebook" className="m-0 p-3 space-y-3">
              {!sourceUploaded ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="text-center py-4">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <BookOpen className="w-12 h-12 mx-auto text-primary/40 mb-2" />
                    </motion.div>
                    <h3 className="font-bold text-sm">📓 Upload Study Material</h3>
                    <p className="text-xs text-muted-foreground mt-1">Add your notes, textbook content, or any study material. AI will answer questions based on it.</p>
                  </div>
                  <Textarea
                    placeholder="Paste your study material here... (textbook content, notes, articles)"
                    value={notebookSource}
                    onChange={(e) => setNotebookSource(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
                      <Button variant="outline" className="w-full" asChild>
                        <span><Upload className="w-4 h-4 mr-1.5" /> Upload File</span>
                      </Button>
                    </label>
                    <Button className="flex-1" onClick={() => { if (notebookSource.trim()) { setSourceUploaded(true); toast({ title: "✅ Source added!" }); } }} disabled={!notebookSource.trim()}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Add Source
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1"><FileText className="w-3 h-3" /> Source loaded ({notebookSource.length} chars)</Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setSourceUploaded(false); setNotebookSource(""); setNotebookMessages([]); }}>
                      <X className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                  </div>
                  <div className="h-[260px] overflow-y-auto border rounded-xl p-3 space-y-3 bg-muted/20">
                    {notebookMessages.length === 0 && (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p className="text-xs text-center">Ask questions about your uploaded material! 📖</p>
                      </div>
                    )}
                    {notebookMessages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border shadow-sm rounded-bl-sm"}`}>
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : msg.content}
                        </div>
                      </motion.div>
                    ))}
                    {isNotebookLoading && notebookMessages[notebookMessages.length - 1]?.role !== "assistant" && (
                      <div className="flex justify-start">
                        <div className="bg-background border px-4 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Analyzing source...</span>
                        </div>
                      </div>
                    )}
                    <div ref={notebookEndRef} />
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); sendNotebook(); }} className="flex gap-2">
                    <Input placeholder="Ask about your material... 📖" value={notebookInput} onChange={(e) => setNotebookInput(e.target.value)} disabled={isNotebookLoading} className="rounded-full text-sm" />
                    <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={isNotebookLoading || !notebookInput.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </motion.div>
              )}
            </TabsContent>

            {/* ─── Quiz ─── */}
            <TabsContent value="quiz" className="m-0 p-3 space-y-3">
              {!quiz ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="text-center py-3">
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <Trophy className="w-10 h-10 mx-auto text-yellow-500/60 mb-2" />
                    </motion.div>
                    <h3 className="font-bold text-sm">🧠 Quiz Generator</h3>
                    <p className="text-xs text-muted-foreground mt-1">Enter a topic and AI will create a practice quiz. Earn 2 RA points per correct answer!</p>
                  </div>
                  <Input placeholder="Enter a topic (e.g., Photosynthesis, WW2, Algebra)" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} className="text-sm" />
                  <Button onClick={generateQuiz} disabled={isQuizLoading || !quizTopic.trim()} className="w-full">
                    {isQuizLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Brain className="w-4 h-4 mr-2" /> Generate Quiz</>}
                  </Button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{quiz.title}</h3>
                    <Button variant="ghost" size="sm" onClick={() => { setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false); }}>
                      <X className="w-3.5 h-3.5 mr-1" /> New Quiz
                    </Button>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
                    {quiz.questions.map((q, qi) => (
                      <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.08 }} className="p-3 border rounded-xl bg-background">
                        <p className="text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => {
                            const isSelected = quizAnswers[qi] === oi;
                            const isCorrect = quizSubmitted && oi === q.correct;
                            const isWrong = quizSubmitted && isSelected && oi !== q.correct;
                            return (
                              <button
                                key={oi}
                                onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [qi]: oi })}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                                  isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950/30" :
                                  isWrong ? "border-red-500 bg-red-50 dark:bg-red-950/30" :
                                  isSelected ? "border-primary bg-primary/5" :
                                  "border-muted hover:border-primary/40"
                                } ${quizSubmitted ? "cursor-default" : "cursor-pointer"}`}
                              >
                                <span className="flex items-center gap-2">
                                  {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                                  {isWrong && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                                  {opt}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {quizSubmitted && (
                          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded-lg">
                            💡 {q.explanation}
                          </motion.p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  {!quizSubmitted ? (
                    <Button onClick={submitQuiz} className="w-full" disabled={Object.keys(quizAnswers).length < quiz.questions.length}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Submit Quiz ({Object.keys(quizAnswers).length}/{quiz.questions.length})
                    </Button>
                  ) : (
                    <div className="text-center py-2">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                        <p className="font-bold text-lg">
                          🎉 {quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length}/{quiz.questions.length} Correct!
                        </p>
                        <p className="text-xs text-muted-foreground">+{quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length * 2} RA Points earned</p>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )}
            </TabsContent>

            {/* ─── Mind Map ─── */}
            <TabsContent value="mindmap" className="m-0 p-3 space-y-3">
              <p className="text-xs text-muted-foreground">Enter a topic or paste notes to generate a visual mind map with emojis 🗺️</p>
              <Textarea placeholder="e.g. 'Photosynthesis' or paste your notes..." value={mindMapSource} onChange={(e) => setMindMapSource(e.target.value)} className="min-h-[80px] text-sm" />
              <Button onClick={generateMindMap} disabled={isMindMapLoading || !mindMapSource.trim()} className="w-full">
                {isMindMapLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Network className="w-4 h-4 mr-2" /> Generate Mind Map</>}
              </Button>
              {mindMapData && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="border rounded-xl p-3 bg-muted/20 overflow-auto max-h-[350px]">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" /> {mindMapData.title}
                  </h3>
                  {mindMapData.children?.map((c, i) => <MindMapNodeView key={i} node={c} depth={0} />)}
                </motion.div>
              )}
              {!mindMapData && !isMindMapLoading && (
                <div className="text-center py-6 text-muted-foreground">
                  <Network className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Mind map will appear here</p>
                </div>
              )}
            </TabsContent>

            {/* ─── Notes ─── */}
            <TabsContent value="notes" className="m-0 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={createNote} variant="outline" className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> New
                </Button>
              </div>

              {activeNote ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setActiveNote(null); setNoteTitle(""); setNoteContent(""); setNoteSolution(""); }}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title" className="font-semibold h-8 text-sm" />
                    <Button size="sm" className="h-8" onClick={saveNote}><Save className="w-3.5 h-3.5" /></Button>
                  </div>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write your notes, questions, or problems here... ✍️"
                    className="min-h-[150px] text-sm"
                  />
                  <Button variant="secondary" className="w-full h-9 text-xs" onClick={solveNote} disabled={isNoteSolving || !noteContent.trim()}>
                    {isNoteSolving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Solving...</> : <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> AI Solve / Explain</>}
                  </Button>
                  {noteSolution && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-xl p-3 bg-muted/30 max-h-[200px] overflow-y-auto">
                      <p className="text-xs font-bold text-primary mb-1.5 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Solution</p>
                      <div className="prose prose-sm max-w-none dark:prose-invert text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{noteSolution}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-xs">No notes yet. Create one!</p>
                    </div>
                  ) : (
                    notes.map(note => (
                      <motion.div key={note.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => { setActiveNote(note); setNoteTitle(note.title); setNoteContent(note.content); setNoteSolution(""); }}
                      >
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{note.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{note.content || "Empty"}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 shrink-0 h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StudyAssistant;
