import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Network, StickyNote, Plus, Trash2, Save,
  BookOpen, Loader2, ChevronRight, X, FileText,
  Trophy, Brain, Wand2, CheckCircle2, XCircle, Upload, Star,
  ExternalLink, Award, Medal, Crown, Image as ImageIcon,
  Volume2, VolumeX, ZoomIn, ZoomOut, Move
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import StudentOnlineTest from "@/components/StudentOnlineTest";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;
const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`;

type Msg = { role: "user" | "assistant"; content: string };
interface MindMapNode { title: string; children: MindMapNode[]; }
interface Note { id: string; title: string; content: string; createdAt: string; updatedAt: string; }
interface QuizQuestion { question: string; options: string[]; correct: number; explanation: string; }
interface Quiz { title: string; questions: QuizQuestion[]; }

// ─── RA Points (DB-backed) ───
function useRAPoints(studentId: string, isOnline = false) {
  const monthlyAllowance = isOnline ? 20 : 100;
  const [points, setPoints] = useState(monthlyAllowance);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      const { data } = await supabase
        .from("ra_points")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle();
      if (data) {
        const lastReset = new Date(data.last_reset);
        const now = new Date();
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
          await supabase.from("ra_points").update({ points: monthlyAllowance, last_reset: now.toISOString(), updated_at: now.toISOString() }).eq("student_id", studentId);
          setPoints(monthlyAllowance);
        } else {
          setPoints(data.points);
        }
      } else {
        await supabase.from("ra_points").insert({ student_id: studentId, points: monthlyAllowance });
        setPoints(monthlyAllowance);
      }
      setLoaded(true);
    };
    load();
  }, [studentId]);

  const updateDB = async (newPoints: number) => {
    setPoints(newPoints);
    await supabase.from("ra_points").update({ points: newPoints, updated_at: new Date().toISOString() }).eq("student_id", studentId);
  };

  const spend = async (n: number) => {
    if (points < n) return false;
    await updateDB(points - n);
    return true;
  };
  const earn = async (n: number) => {
    await updateDB(points + n);
  };

  return { points, spend, earn, loaded };
}

// ─── Leaderboard (DB-backed) ───
function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<{ name: string; points: number; student_id: string }[]>([]);
  const load = async () => {
    const { data: raData } = await supabase.from("ra_points").select("student_id, points").order("points", { ascending: false }).limit(20);
    if (!raData?.length) return;
    const studentIds = raData.map(r => r.student_id);
    const { data: students } = await supabase.from("students").select("id, name").in("id", studentIds);
    if (!students) return;
    const nameMap = new Map(students.map(s => [s.id, s.name]));
    setLeaderboard(raData.filter(r => nameMap.has(r.student_id)).map(r => ({ name: nameMap.get(r.student_id)!, points: r.points, student_id: r.student_id })));
  };
  useEffect(() => { load(); }, []);
  return { leaderboard, refresh: load };
}

// ─── Chat persistence ───
function useChatPersistence(studentId: string, mode: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      const { data } = await supabase
        .from("student_chat_messages")
        .select("role, content")
        .eq("student_id", studentId)
        .eq("mode", mode)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as Msg[]);
      setLoaded(true);
    };
    load();
  }, [studentId, mode]);

  const saveMessage = async (msg: Msg) => {
    await supabase.from("student_chat_messages").insert({
      student_id: studentId,
      role: msg.role,
      content: msg.content,
      mode,
    });
  };

  const clearMessages = async () => {
    await supabase.from("student_chat_messages").delete().eq("student_id", studentId).eq("mode", mode);
    setMessages([]);
  };

  return { messages, setMessages, saveMessage, clearMessages, loaded };
}

// ─── Extract text from file via edge function ───
async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(EXTRACT_URL, {
    method: "POST",
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: formData,
  });
  if (!resp.ok) throw new Error("Failed to extract text");
  const data = await resp.json();
  return data.text || "";
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
    headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ messages, mode, sourceText, actorRole: "student" }),
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
    body: JSON.stringify({ messages, mode, sourceText, actorRole: "student" }),
  });
  if (!resp.ok) throw new Error("AI request failed");
  return resp.json();
}

// ─── Interactive Mind Map with pan/zoom ───
const BRANCH_COLORS = [
  "hsl(var(--primary))",
  "hsl(160, 60%, 40%)",
  "hsl(200, 70%, 45%)",
  "hsl(280, 50%, 50%)",
  "hsl(30, 70%, 50%)",
  "hsl(340, 60%, 50%)",
  "hsl(100, 50%, 40%)",
  "hsl(220, 60%, 50%)",
];

const InteractiveMindMap = ({ data }: { data: MindMapNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  type NodeData = { node: MindMapNode; x: number; y: number; w: number; h: number; depth: number; color: string; parentX?: number; parentY?: number; id: string };
  const allNodes: NodeData[] = [];

  const getNodeDim = (text: string, depth: number) => {
    const charW = depth === 0 ? 9 : depth === 1 ? 7.5 : 6.5;
    const displayLen = Math.min(text.length, depth === 0 ? 25 : 23);
    const w = Math.max(depth === 0 ? 140 : 80, displayLen * charW + (depth === 0 ? 40 : 24));
    const h = depth === 0 ? 44 : depth === 1 ? 34 : 28;
    return { w, h };
  };

  const layout = (node: MindMapNode, x: number, y: number, angle: number, depth: number, color: string, parentX?: number, parentY?: number, idPrefix = "0") => {
    const { w, h } = getNodeDim(node.title, depth);
    const id = idPrefix;
    allNodes.push({ node, x, y, w, h, depth, color, parentX, parentY, id });
    if (!node.children?.length || collapsed.has(id)) return;
    const count = node.children.length;
    const spread = depth === 0 ? Math.PI * 1.8 : Math.min(Math.PI * 0.8, count * 0.45);
    const startAngle = depth === 0 ? -Math.PI * 0.9 : angle - spread / 2;
    const radius = depth === 0 ? 200 : depth === 1 ? 160 : 120;

    node.children.forEach((child, i) => {
      const a = startAngle + (count > 1 ? (i / (count - 1)) * spread : spread / 2);
      const cx = x + Math.cos(a) * radius;
      const cy = y + Math.sin(a) * radius;
      const childColor = depth === 0 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : color;
      layout(child, cx, cy, a, depth + 1, childColor, x, y, `${id}-${i}`);
    });
  };

  layout(data, 450, 350, 0, 0, BRANCH_COLORS[0]);

  // Compute viewBox
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  allNodes.forEach(n => {
    minX = Math.min(minX, n.x - n.w / 2 - 30);
    maxX = Math.max(maxX, n.x + n.w / 2 + 30);
    minY = Math.min(minY, n.y - n.h / 2 - 30);
    maxY = Math.max(maxY, n.y + n.h / 2 + 30);
  });
  const vbW = maxX - minX + 60;
  const vbH = maxY - minY + 60;
  const viewBox = `${minX - 30 - pan.x / scale} ${minY - 30 - pan.y / scale} ${vbW / scale} ${vbH / scale}`;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(3, Math.max(0.3, prev * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setScale(prev => Math.min(3, prev * 1.2))}><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setScale(prev => Math.max(0.3, prev * 0.8))}><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}><Move className="w-3.5 h-3.5" /></Button>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-border/30 bg-muted/10 cursor-grab active:cursor-grabbing"
        style={{ height: 420 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg viewBox={viewBox} className="w-full h-full" style={{ touchAction: "none" }}>
          {/* Curved connection lines */}
          {allNodes.filter(n => n.parentX !== undefined).map((n, i) => {
            const mx = (n.parentX! + n.x) / 2;
            const my = (n.parentY! + n.y) / 2;
            return (
              <path
                key={`line-${i}`}
                d={`M ${n.parentX} ${n.parentY} Q ${mx} ${n.parentY}, ${mx} ${my} T ${n.x} ${n.y}`}
                fill="none"
                stroke={n.color}
                strokeWidth={n.depth === 1 ? 2.5 : 1.5}
                strokeOpacity={0.5}
              />
            );
          })}
          {/* Nodes */}
          {allNodes.map((n, i) => {
            const rx = n.depth === 0 ? 22 : n.depth === 1 ? 16 : 12;
            const fontSize = n.depth === 0 ? 14 : n.depth === 1 ? 11 : 9.5;
            const fontWeight = n.depth <= 1 ? "600" : "500";
            const hasChildren = n.node.children?.length > 0;
            return (
              <g key={`node-${i}`} onClick={() => hasChildren && toggleCollapse(n.id)} style={{ cursor: hasChildren ? "pointer" : "default" }}>
                <motion.rect
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.02, type: "spring", stiffness: 200 }}
                  x={n.x - n.w / 2}
                  y={n.y - n.h / 2}
                  width={n.w}
                  height={n.h}
                  rx={rx}
                  fill={n.color}
                  fillOpacity={n.depth === 0 ? 1 : 0.85}
                  stroke={n.color}
                  strokeWidth={n.depth === 0 ? 2 : 1}
                  strokeOpacity={0.6}
                />
                <text
                  x={n.x}
                  y={n.y + fontSize * 0.35}
                  textAnchor="middle"
                  fill="white"
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  fontFamily="system-ui, sans-serif"
                >
                  {n.node.title.length > 28 ? n.node.title.slice(0, 26) + "…" : n.node.title}
                </text>
                {hasChildren && collapsed.has(n.id) && (
                  <text x={n.x + n.w / 2 - 8} y={n.y + 4} fontSize={10} fill="white" fillOpacity={0.7}>+</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

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

// ─── File upload button ───
const FileUploadButton = ({ onUpload, loading, accept, label }: { onUpload: (f: File) => void; loading: boolean; accept: string; label: string }) => (
  <label className="cursor-pointer">
    <input
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      disabled={loading}
    />
    <Button variant="outline" className="w-full rounded-xl pointer-events-none" disabled={loading} asChild>
      <span>{loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />} {label}</span>
    </Button>
  </label>
);

// ─── Audio Summary Component ───
const AudioSummary = ({ sourceText, studentId, spend }: { sourceText: string; studentId: string; spend: (n: number) => Promise<boolean> }) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const generateSummary = async () => {
    if (!sourceText.trim()) { toast({ title: "Add source material first!", variant: "destructive" }); return; }
    if (!await spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    setIsGenerating(true);
    setSummary("");
    let text = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: `Create a concise audio-friendly summary (no markdown, no special formatting, plain text only) of this material for a student to listen to. Make it engaging and educational:\n\n${sourceText.slice(0, 3000)}` }],
        mode: "chat",
        onDelta: (c) => { text += c; setSummary(text); },
        onDone: () => setIsGenerating(false),
      });
    } catch { toast({ title: "Failed to generate summary", variant: "destructive" }); setIsGenerating(false); }
  };

  const speak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  return (
    <div className="space-y-3">
      <Button onClick={generateSummary} disabled={isGenerating || !sourceText.trim()} className="w-full rounded-xl" variant="secondary">
        {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Volume2 className="w-4 h-4 mr-2" /> Generate Audio Summary</>}
      </Button>
      {summary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30 max-h-[150px] overflow-y-auto">
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
          <Button onClick={speak} className="w-full rounded-xl" variant={isSpeaking ? "destructive" : "default"}>
            {isSpeaking ? <><VolumeX className="w-4 h-4 mr-2" /> Stop</> : <><Volume2 className="w-4 h-4 mr-2" /> 🔊 Listen</>}
          </Button>
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Component ───
const StudyAssistant = ({ studentName, studentId, studentClass, isOnlineStudent }: { studentName: string; studentId: string; studentClass?: string; isOnlineStudent?: boolean }) => {
  const { toast } = useToast();
  const { points, spend, earn } = useRAPoints(studentId, isOnlineStudent);
  const { leaderboard, refresh: refreshLeaderboard } = useLeaderboard();
  const [activeTab, setActiveTab] = useState("chat");

  // Chat with persistence
  const chatPersistence = useChatPersistence(studentId, "chat");
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Notebook
  const [notebookSource, setNotebookSource] = useState("");
  const notebookPersistence = useChatPersistence(studentId, "notebook");
  const [notebookInput, setNotebookInput] = useState("");
  const [isNotebookLoading, setIsNotebookLoading] = useState(false);
  const [sourceUploaded, setSourceUploaded] = useState(false);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const notebookEndRef = useRef<HTMLDivElement>(null);

  // Mind Map
  const [mindMapSource, setMindMapSource] = useState("");
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [isMindMapLoading, setIsMindMapLoading] = useState(false);
  const [isMindMapExtractingFile, setIsMindMapExtractingFile] = useState(false);

  // Quiz
  const [quizTopic, setQuizTopic] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(localStorage.getItem(`student_notes_${studentId}`) || "[]"); } catch { return []; }
  });
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isNoteSolving, setIsNoteSolving] = useState(false);
  const [noteSolution, setNoteSolution] = useState("");

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatPersistence.messages]);
  useEffect(() => { notebookEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [notebookPersistence.messages]);
  useEffect(() => { localStorage.setItem(`student_notes_${studentId}`, JSON.stringify(notes)); }, [notes, studentId]);

  // ─── File upload handlers ───
  const handleNotebookFileUpload = async (file: File) => {
    setIsExtractingFile(true);
    try {
      const text = await extractTextFromFile(file);
      if (text.trim()) {
        setNotebookSource(prev => prev ? prev + "\n\n---\n\n" + text : text);
        toast({ title: `📄 "${file.name}" extracted!`, description: `${text.length} characters extracted.` });
      } else {
        toast({ title: "No text could be extracted", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to extract text from file", variant: "destructive" });
    } finally {
      setIsExtractingFile(false);
    }
  };

  const handleMindMapFileUpload = async (file: File) => {
    setIsMindMapExtractingFile(true);
    try {
      const text = await extractTextFromFile(file);
      if (text.trim()) {
        setMindMapSource(prev => prev ? prev + "\n\n" + text : text);
        toast({ title: `📄 "${file.name}" loaded for mind map!` });
      } else {
        toast({ title: "No text could be extracted", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to extract text from file", variant: "destructive" });
    } finally {
      setIsMindMapExtractingFile(false);
    }
  };

  // ─── Chat with persistence ───
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;
    if (!await spend(1)) { toast({ title: "Not enough RA Points! 😅", description: "Earn points by taking quizzes.", variant: "destructive" }); return; }
    const userMsg: Msg = { role: "user", content: chatInput.trim() };
    chatPersistence.setMessages(prev => [...prev, userMsg]);
    chatPersistence.saveMessage(userMsg);
    setChatInput("");
    setIsChatLoading(true);
    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      chatPersistence.setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        return [...prev, { role: "assistant", content: assistant }];
      });
    };
    try {
      await streamChat({ messages: [...chatPersistence.messages, userMsg], mode: "chat", onDelta: upsert, onDone: () => {
        setIsChatLoading(false);
        chatPersistence.saveMessage({ role: "assistant", content: assistant });
      }});
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to get AI response", variant: "destructive" });
      setIsChatLoading(false);
    }
  }, [chatInput, chatPersistence.messages, isChatLoading, toast, spend]);

  // ─── Notebook ───
  const sendNotebook = useCallback(async () => {
    if (!notebookInput.trim() || isNotebookLoading) return;
    if (!notebookSource.trim()) { toast({ title: "Add source material first!", variant: "destructive" }); return; }
    if (!await spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
    const userMsg: Msg = { role: "user", content: notebookInput.trim() };
    notebookPersistence.setMessages(prev => [...prev, userMsg]);
    notebookPersistence.saveMessage(userMsg);
    setNotebookInput("");
    setIsNotebookLoading(true);
    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      notebookPersistence.setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        return [...prev, { role: "assistant", content: assistant }];
      });
    };
    try {
      await streamChat({ messages: [...notebookPersistence.messages, userMsg], mode: "notebook", sourceText: notebookSource, onDelta: upsert, onDone: () => {
        setIsNotebookLoading(false);
        notebookPersistence.saveMessage({ role: "assistant", content: assistant });
      }});
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
      setIsNotebookLoading(false);
    }
  }, [notebookInput, notebookPersistence.messages, notebookSource, isNotebookLoading, toast, spend]);

  // ─── Mind Map ───
  const generateMindMap = async () => {
    if (!mindMapSource.trim()) return;
    if (!await spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
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
    if (!await spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
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

  const submitQuiz = async () => {
    if (!quiz) return;
    setQuizSubmitted(true);
    const correct = quiz.questions.filter((q, i) => quizAnswers[i] === q.correct).length;
    await earn(correct * 2);
    refreshLeaderboard();
    toast({ title: `🎉 Score: ${correct}/${quiz.questions.length}`, description: `+${correct * 2} RA Points!` });
  };

  // ─── Notes ───
  const solveNote = async () => {
    if (!noteContent.trim()) return;
    if (!await spend(1)) { toast({ title: "Not enough RA Points!", variant: "destructive" }); return; }
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

  const tabs = [
    { id: "chat", icon: Bot, label: "Chat" },
    { id: "notebook", icon: BookOpen, label: "Sources" },
    { id: "quiz", icon: Brain, label: "Quiz" },
    { id: "mindmap", icon: Network, label: "Mind Map" },
    { id: "notes", icon: StickyNote, label: "Notes" },
    ...(studentClass ? [{ id: "tests", icon: FileText, label: "Tests" }] : []),
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
                className="flex items-center gap-1 bg-accent/15 px-2.5 py-1.5 rounded-lg"
              >
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
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
                onClick={() => { setActiveTab(tab.id); if (tab.id === "leaderboard") refreshLeaderboard(); }}
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
              <div className="flex justify-end mb-2">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => chatPersistence.clearMessages()}>
                  <Trash2 className="w-3 h-3 mr-1" /> Clear Chat
                </Button>
              </div>
              <div className="h-[320px] overflow-y-auto rounded-xl p-3 space-y-3 bg-muted/20 border border-border/30 mb-3">
                {chatPersistence.messages.length === 0 && (
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
                  {chatPersistence.messages.map((msg, i) => (
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
                {isChatLoading && chatPersistence.messages[chatPersistence.messages.length - 1]?.role !== "assistant" && (
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
                <Input
                  placeholder="Start typing..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                  className="rounded-xl text-sm bg-muted/30 border-border/40 focus-visible:border-primary/50"
                />
                <Button type="submit" size="icon" className="rounded-xl shrink-0 h-10 w-10" disabled={isChatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </motion.div>
          )}

          {/* ─── Notebook (Sources) with Audio Summary ─── */}
          {activeTab === "notebook" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              {!sourceUploaded ? (
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-7 h-7 text-primary/40" />
                    </div>
                    <h3 className="font-bold text-sm">Add your sources</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">PDF, images, text files — we'll extract the content</p>
                  </div>
                  <Textarea placeholder="Paste your study material here..." value={notebookSource} onChange={(e) => setNotebookSource(e.target.value)} className="min-h-[100px] text-sm bg-muted/30 border-border/40 rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <FileUploadButton onUpload={handleNotebookFileUpload} loading={isExtractingFile} accept=".txt,.md,.pdf,.csv,.doc,.docx" label={isExtractingFile ? "Extracting..." : "Upload PDF/Text"} />
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNotebookFileUpload(f); e.target.value = ""; }} disabled={isExtractingFile} />
                      <Button variant="outline" className="w-full rounded-xl pointer-events-none" disabled={isExtractingFile} asChild>
                        <span><ImageIcon className="w-4 h-4 mr-1.5" /> Upload Image</span>
                      </Button>
                    </label>
                  </div>
                  {notebookSource.trim() && <Badge variant="secondary" className="text-[10px]"><FileText className="w-3 h-3 mr-1" /> {notebookSource.length} chars loaded</Badge>}
                  <Button className="w-full rounded-xl" onClick={() => { if (notebookSource.trim()) { setSourceUploaded(true); toast({ title: "✅ Source added!" }); } }} disabled={!notebookSource.trim()}>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Add Source & Start
                  </Button>
                  <Button variant="outline" className="w-full rounded-xl text-muted-foreground" onClick={() => window.open("https://notebooklm.google.com", "_blank")}>
                    <ExternalLink className="w-4 h-4 mr-1.5" /> Open Google NotebookLM
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1 rounded-lg"><FileText className="w-3 h-3" /> Source loaded ({notebookSource.length} chars)</Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setSourceUploaded(false); setNotebookSource(""); notebookPersistence.clearMessages(); }} className="h-7 text-xs">
                      <X className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                  </div>

                  {/* Audio Summary */}
                  <AudioSummary sourceText={notebookSource} studentId={studentId} spend={spend} />

                  <div className="h-[220px] overflow-y-auto rounded-xl p-3 space-y-3 bg-muted/20 border border-border/30">
                    {notebookPersistence.messages.length === 0 && (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p className="text-xs text-center">Ask questions about your uploaded material</p>
                      </div>
                    )}
                    {notebookPersistence.messages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border/50 shadow-sm rounded-bl-md"
                        }`}>
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : msg.content}
                        </div>
                      </motion.div>
                    ))}
                    {isNotebookLoading && notebookPersistence.messages[notebookPersistence.messages.length - 1]?.role !== "assistant" && (
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
                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <Trophy className="w-7 h-7 text-accent-foreground/60" />
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
                                  isCorrect ? "border-primary bg-primary/10" :
                                  isWrong ? "border-destructive bg-destructive/10" :
                                  isSelected ? "border-primary bg-primary/5" :
                                  "border-border/40 hover:border-primary/40"
                                } ${quizSubmitted ? "cursor-default" : "cursor-pointer"}`}
                              >
                                <span className="flex items-center gap-2">
                                  {isCorrect && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                                  {isWrong && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
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

          {/* ─── Interactive Mind Map ─── */}
          {activeTab === "mindmap" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              <Textarea placeholder="Enter a topic or paste your notes to generate a mind map..." value={mindMapSource} onChange={(e) => setMindMapSource(e.target.value)} className="min-h-[60px] text-sm rounded-xl bg-muted/30 border-border/40" />
              <div className="grid grid-cols-3 gap-2">
                <FileUploadButton onUpload={handleMindMapFileUpload} loading={isMindMapExtractingFile} accept=".txt,.md,.pdf,.csv" label="PDF" />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMindMapFileUpload(f); e.target.value = ""; }} disabled={isMindMapExtractingFile} />
                  <Button variant="outline" className="w-full rounded-xl pointer-events-none text-xs" disabled={isMindMapExtractingFile} asChild>
                    <span><ImageIcon className="w-3.5 h-3.5 mr-1" /> Image</span>
                  </Button>
                </label>
                <Button onClick={generateMindMap} disabled={isMindMapLoading || isMindMapExtractingFile || !mindMapSource.trim()} className="rounded-xl text-xs">
                  {isMindMapLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Network className="w-3.5 h-3.5 mr-1" /> Generate</>}
                </Button>
              </div>
              {mindMapData && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <InteractiveMindMap data={mindMapData} />
                </motion.div>
              )}
              {!mindMapData && !isMindMapLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                    <Network className="w-7 h-7 opacity-30" />
                  </div>
                  <p className="text-xs">Upload a file or enter a topic to generate</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Pan, zoom and click nodes to collapse</p>
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
                  <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write your notes, questions, or problems here..." className="min-h-[140px] text-sm rounded-xl bg-muted/30 border-border/40" />
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

          {/* ─── Online Tests ─── */}
          {activeTab === "tests" && studentClass && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3">
              <StudentOnlineTest studentId={studentId} studentClass={studentClass} />
            </motion.div>
          )}

          {/* ─── Leaderboard (DB-backed) ─── */}
          {activeTab === "leaderboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              <div className="text-center py-3">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
                  <Award className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-sm">RA Points Leaderboard</h3>
                <p className="text-[10px] text-muted-foreground">Top students by points earned</p>
              </div>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => {
                  const isMe = entry.student_id === studentId;
                  const rankIcon = i === 0 ? <Crown className="w-4 h-4 text-primary" /> :
                                   i === 1 ? <Medal className="w-4 h-4 text-muted-foreground" /> :
                                   i === 2 ? <Medal className="w-4 h-4 text-accent-foreground" /> : null;
                  return (
                    <motion.div
                      key={entry.student_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isMe ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/30 bg-card"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-primary/20 text-primary" :
                        i === 1 ? "bg-muted text-muted-foreground" :
                        i === 2 ? "bg-accent/20 text-accent-foreground" :
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
                        <Star className="w-3.5 h-3.5 text-primary fill-primary" />
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
