import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Network, StickyNote, Plus, Trash2, Save,
  BookOpen, Loader2, ChevronRight, ChevronDown, X, FileText,
  Trophy, Brain, Wand2, CheckCircle2, XCircle, Upload, Star,
  ExternalLink, Award, Medal, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;

type Msg = { role: "user" | "assistant"; content: string };
interface MindMapNode { title: string; children: MindMapNode[]; }
interface Note { id: string; title: string; content: string; createdAt: string; updatedAt: string; }
interface QuizQuestion { question: string; options: string[]; correct: number; explanation: string; }
interface Quiz { title: string; questions: QuizQuestion[]; }

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
  } catch { return { points: 100, lastReset: new Date().toISOString() }; }
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

// ─── Tree Mind Map (like NotebookLM reference) ───
const TreeNode = ({ node, depth = 0, isLast = false }: { node: MindMapNode; depth?: number; isLast?: boolean }) => {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  const bgColors = [
    "bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.4)]",
    "bg-[hsl(var(--accent)/0.15)] border-[hsl(var(--accent)/0.4)]",
    "bg-[hsl(var(--secondary)/0.2)] border-[hsl(var(--secondary)/0.4)]",
    "bg-muted/60 border-muted-foreground/20",
  ];
  const colorClass = bgColors[Math.min(depth, bgColors.length - 1)];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: depth * 0.03, duration: 0.3 }}
      className="relative"
    >
      {/* Connector lines */}
      {depth > 0 && (
        <div className="absolute left-[-20px] top-0 h-[18px] w-[20px] border-l-2 border-b-2 border-muted-foreground/20 rounded-bl-lg" />
      )}
      {depth > 0 && !isLast && (
        <div className="absolute left-[-20px] top-0 bottom-0 border-l-2 border-muted-foreground/20" />
      )}

      <div
        onClick={() => hasChildren && setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium mb-2 cursor-pointer transition-all hover:shadow-md ${colorClass}`}
      >
        {hasChildren && (
          <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
          </motion.div>
        )}
        {!hasChildren && <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />}
        <span>{node.title}</span>
      </div>

      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="ml-[20px] relative"
          >
            {node.children.map((c, i) => (
              <TreeNode key={i} node={c} depth={depth + 1} isLast={i === node.children.length - 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Leaderboard data (mock — would come from DB in production) ───
function getLeaderboard(currentStudentName: string, currentPoints: number) {
  const stored: { name: string; points: number }[] = JSON.parse(localStorage.getItem("ra_leaderboard") || "[]");
  const idx = stored.findIndex(s => s.name === currentStudentName);
  if (idx >= 0) stored[idx].points = currentPoints;
  else stored.push({ name: currentStudentName, points: currentPoints });
  localStorage.setItem("ra_leaderboard", JSON.stringify(stored));
  return stored.sort((a, b) => b.points - a.points).slice(0, 10);
}

// ─── Tab button ───
const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
      active
        ? "bg-primary text-primary-foreground shadow-md"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

// ─── Main Component ───
const StudyAssistant = ({ studentName }: { studentName: string }) => {
  const { toast } = useToast();
  const { points, spend, earn } = useRAPoints();
  const [activeTab, setActiveTab] = useState("chat");

  // Chat
  const [chatMessages, setChatMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Notebook
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
      toast({ title: `📄 "${file.name}" uploaded!` });
    };
    if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      reader.readAsText(file);
    } else {
      toast({ title: "Supported: .txt, .md files", variant: "destructive" });
    }
  };

  const sendNotebook = useCallback(async () => {
    if (!notebookInput.trim() || isNotebookLoading) return;
    if (!notebookSource.trim()) { toast({ title: "Add source material first!", variant: "destructive" }); return; }
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
    setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false);
    try {
      const data = await fetchAI([{ role: "user", content: `Generate a quiz about: ${quizTopic.trim()}` }], "quiz");
      const parsed = extractJson<Quiz>(data.content);
      if (parsed?.questions?.length) setQuiz(parsed);
      else toast({ title: "Failed to generate quiz. Try again.", variant: "destructive" });
    } catch { toast({ title: "Failed to generate quiz", variant: "destructive" }); }
    finally { setIsQuizLoading(false); }
  };

  const submitQuiz = () => {
    if (!quiz) return;
    setQuizSubmitted(true);
    const correct = quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length;
    earn(correct * 2);
    toast({ title: `🎉 Score: ${correct}/${quiz.questions.length}`, description: `+${correct * 2} RA Points!` });
  };

  // ─── Notes ───
  const solveNote = async () => {
    if (!noteContent.trim()) return;
    if (!spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    setIsNoteSolving(true); setNoteSolution("");
    let sol = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: noteContent.trim() }], mode: "solve",
        onDelta: (c) => { sol += c; setNoteSolution(sol); },
        onDone: () => setIsNoteSolving(false),
      });
    } catch { toast({ title: "Failed to solve", variant: "destructive" }); setIsNoteSolving(false); }
  };

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

  const leaderboard = getLeaderboard(studentName, points);

  const tabs = [
    { id: "chat", icon: Bot, label: "Chat" },
    { id: "notebook", icon: BookOpen, label: "Sources" },
    { id: "quiz", icon: Brain, label: "Quiz" },
    { id: "mindmap", icon: Network, label: "Mind Map" },
    { id: "notes", icon: StickyNote, label: "Notes" },
    { id: "leaderboard", icon: Trophy, label: "Ranks" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 overflow-hidden shadow-2xl bg-card rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-accent/10 px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-sm leading-tight">AI Study Hub</h2>
                <p className="text-[10px] text-muted-foreground">Hi {studentName} 👋</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://notebooklm.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3 h-3" />
                NotebookLM
              </a>
              <motion.div
                key={points}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 bg-yellow-500/15 px-2.5 py-1.5 rounded-lg"
              >
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span className="font-bold text-xs">{points}</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 py-2 border-b border-border/30 overflow-x-auto">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
              />
            ))}
          </div>
        </div>

        <CardContent className="p-0">
          {/* ─── Chat ─── */}
          {activeTab === "chat" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3">
              <div className="h-[340px] overflow-y-auto rounded-xl p-3 space-y-3 bg-muted/20 border border-border/30 mb-3">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Bot className="w-7 h-7 text-primary/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground/60">Ask me anything</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Math, Science, History, Languages...</p>
                    </div>
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  {chatMessages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border/50 shadow-sm rounded-bl-md"
                      }`}>
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
                    <div className="bg-card border border-border/50 shadow-sm px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Start typing..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isChatLoading}
                    className="rounded-xl text-sm pr-4 bg-muted/30 border-border/40 focus-visible:border-primary/50"
                  />
                </div>
                <Button type="submit" size="icon" className="rounded-xl shrink-0 h-10 w-10" disabled={isChatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </motion.div>
          )}

          {/* ─── Notebook (Sources) ─── */}
          {activeTab === "notebook" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              {!sourceUploaded ? (
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-7 h-7 text-primary/40" />
                    </div>
                    <h3 className="font-bold text-sm">Add your sources</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">pdf, text files, docs, and more</p>
                  </div>
                  <Textarea
                    placeholder="Paste your study material here..."
                    value={notebookSource}
                    onChange={(e) => setNotebookSource(e.target.value)}
                    className="min-h-[100px] text-sm bg-muted/30 border-border/40 rounded-xl"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <input type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
                      <Button variant="outline" className="w-full rounded-xl" asChild>
                        <span><Upload className="w-4 h-4 mr-1.5" /> Upload files</span>
                      </Button>
                    </label>
                    <Button className="rounded-xl" onClick={() => { if (notebookSource.trim()) { setSourceUploaded(true); toast({ title: "✅ Source added!" }); } }} disabled={!notebookSource.trim()}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Add Source
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-muted-foreground"
                    onClick={() => window.open("https://notebooklm.google.com", "_blank")}
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" /> Open Google NotebookLM
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1 rounded-lg"><FileText className="w-3 h-3" /> Source loaded ({notebookSource.length} chars)</Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setSourceUploaded(false); setNotebookSource(""); setNotebookMessages([]); }} className="h-7 text-xs">
                      <X className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                  </div>
                  <div className="h-[280px] overflow-y-auto rounded-xl p-3 space-y-3 bg-muted/20 border border-border/30">
                    {notebookMessages.length === 0 && (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p className="text-xs text-center">Ask questions about your uploaded material</p>
                      </div>
                    )}
                    {notebookMessages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-card border border-border/50 shadow-sm rounded-bl-md"
                        }`}>
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
                        <div className="bg-card border px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Analyzing...</span>
                        </div>
                      </div>
                    )}
                    <div ref={notebookEndRef} />
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); sendNotebook(); }} className="flex gap-2">
                    <Input placeholder="Ask about your material..." value={notebookInput} onChange={(e) => setNotebookInput(e.target.value)} disabled={isNotebookLoading} className="rounded-xl text-sm bg-muted/30 border-border/40" />
                    <Button type="submit" size="icon" className="rounded-xl shrink-0" disabled={isNotebookLoading || !notebookInput.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Quiz ─── */}
          {activeTab === "quiz" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              {!quiz ? (
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
                      <Trophy className="w-7 h-7 text-yellow-500/60" />
                    </div>
                    <h3 className="font-bold text-sm">Quiz Generator</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">Earn 2 RA points per correct answer</p>
                  </div>
                  <Input placeholder="Enter a topic (e.g., Photosynthesis, WW2)" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} className="text-sm rounded-xl bg-muted/30 border-border/40" />
                  <Button onClick={generateQuiz} disabled={isQuizLoading || !quizTopic.trim()} className="w-full rounded-xl">
                    {isQuizLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Brain className="w-4 h-4 mr-2" /> Generate Quiz</>}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{quiz.title}</h3>
                    <Button variant="ghost" size="sm" onClick={() => { setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false); }} className="h-7 text-xs">
                      <X className="w-3.5 h-3.5 mr-1" /> New
                    </Button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
                    {quiz.questions.map((q, qi) => (
                      <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.08 }} className="p-3 border border-border/40 rounded-xl bg-card">
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
                                  "border-border/40 hover:border-primary/40"
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
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded-lg">
                            💡 {q.explanation}
                          </motion.p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  {!quizSubmitted ? (
                    <Button onClick={submitQuiz} className="w-full rounded-xl" disabled={Object.keys(quizAnswers).length < quiz.questions.length}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Submit ({Object.keys(quizAnswers).length}/{quiz.questions.length})
                    </Button>
                  ) : (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-3 bg-primary/5 rounded-xl border border-primary/20">
                      <p className="font-bold text-lg">🎉 {quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length}/{quiz.questions.length}</p>
                      <p className="text-xs text-muted-foreground">+{quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length * 2} RA Points</p>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Mind Map (Tree style like NotebookLM) ─── */}
          {activeTab === "mindmap" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              <Textarea
                placeholder="Enter a topic or paste your notes to generate a mind map..."
                value={mindMapSource}
                onChange={(e) => setMindMapSource(e.target.value)}
                className="min-h-[70px] text-sm rounded-xl bg-muted/30 border-border/40"
              />
              <Button onClick={generateMindMap} disabled={isMindMapLoading || !mindMapSource.trim()} className="w-full rounded-xl">
                {isMindMapLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Network className="w-4 h-4 mr-2" /> Generate Mind Map</>}
              </Button>
              {mindMapData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="border border-border/30 rounded-xl p-4 bg-muted/10 overflow-auto max-h-[380px]"
                >
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/20">
                    <Network className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-sm">{mindMapData.title}</h3>
                  </div>
                  <div className="pl-2">
                    {mindMapData.children?.map((c, i) => (
                      <TreeNode key={i} node={c} depth={0} isLast={i === (mindMapData.children?.length || 0) - 1} />
                    ))}
                  </div>
                </motion.div>
              )}
              {!mindMapData && !isMindMapLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                    <Network className="w-7 h-7 opacity-30" />
                  </div>
                  <p className="text-xs">Mind map will appear here</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Notes ─── */}
          {activeTab === "notes" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={createNote} variant="outline" className="h-8 text-xs rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1" /> New
                </Button>
              </div>
              {activeNote ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setActiveNote(null); setNoteTitle(""); setNoteContent(""); setNoteSolution(""); }}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title" className="font-semibold h-8 text-sm rounded-lg" />
                    <Button size="sm" className="h-8 rounded-lg" onClick={saveNote}><Save className="w-3.5 h-3.5" /></Button>
                  </div>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write your notes, questions, or problems here..."
                    className="min-h-[140px] text-sm rounded-xl bg-muted/30 border-border/40"
                  />
                  <Button variant="secondary" className="w-full h-9 text-xs rounded-xl" onClick={solveNote} disabled={isNoteSolving || !noteContent.trim()}>
                    {isNoteSolving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Solving...</> : <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> AI Solve / Explain</>}
                  </Button>
                  {noteSolution && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border border-border/30 rounded-xl p-3 bg-muted/20 max-h-[200px] overflow-y-auto">
                      <p className="text-xs font-bold text-primary mb-1.5 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Solution</p>
                      <div className="prose prose-sm max-w-none dark:prose-invert text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{noteSolution}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                        <StickyNote className="w-7 h-7 opacity-30" />
                      </div>
                      <p className="text-xs">No notes yet. Create one!</p>
                    </div>
                  ) : (
                    notes.map(note => (
                      <motion.div key={note.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors cursor-pointer group"
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
            </motion.div>
          )}

          {/* ─── Leaderboard ─── */}
          {activeTab === "leaderboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              <div className="text-center py-3">
                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-2">
                  <Award className="w-7 h-7 text-yellow-500" />
                </div>
                <h3 className="font-bold text-sm">RA Points Leaderboard</h3>
                <p className="text-[10px] text-muted-foreground">Top students by points earned</p>
              </div>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => {
                  const isMe = entry.name === studentName;
                  const rankIcon = i === 0 ? <Crown className="w-4 h-4 text-yellow-500" /> :
                                   i === 1 ? <Medal className="w-4 h-4 text-gray-400" /> :
                                   i === 2 ? <Medal className="w-4 h-4 text-amber-700" /> : null;
                  return (
                    <motion.div
                      key={entry.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isMe ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/30 bg-card"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-yellow-500/20 text-yellow-600" :
                        i === 1 ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300" :
                        i === 2 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {rankIcon || `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isMe ? "text-primary" : ""}`}>
                          {entry.name} {isMe && <span className="text-[10px] text-muted-foreground">(You)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-sm">{entry.points}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {leaderboard.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-xs">No leaderboard data yet</p>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StudyAssistant;
