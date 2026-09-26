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

// ─── RA Points (DB-backed + refresh-safe) ───
function useRAPoints(studentId: string, isOnline = false) {
  const monthlyAllowance = isOnline ? 20 : 100;
  const [points, setPoints] = useState(monthlyAllowance);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("ra_points")
        .select("points, last_reset")
        .eq("student_id", studentId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load RA Points:", error);
        setLoaded(true);
        return;
      }

      const now = new Date();

      if (!data) {
        const { data: created, error: createError } = await supabase
          .from("ra_points")
          .upsert(
            {
              student_id: studentId,
              points: monthlyAllowance,
              last_reset: now.toISOString(),
              updated_at: now.toISOString(),
            },
            { onConflict: "student_id", ignoreDuplicates: false }
          )
          .select("points")
          .single();

        if (cancelled) return;

        if (createError) {
          console.error("Failed to create RA Points:", createError);
        } else if (created) {
          setPoints(created.points);
        }
      } else {
        const lastReset = new Date(data.last_reset);
        const monthChanged =
          now.getMonth() !== lastReset.getMonth() ||
          now.getFullYear() !== lastReset.getFullYear();

        if (monthChanged) {
          const { data: resetRow, error: resetError } = await supabase
            .from("ra_points")
            .update({
              points: monthlyAllowance,
              last_reset: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("student_id", studentId)
            .select("points")
            .single();

          if (cancelled) return;

          if (resetError) {
            console.error("Failed to reset monthly RA Points:", resetError);
          } else if (resetRow) {
            setPoints(resetRow.points);
          }
        } else {
          setPoints(data.points);
        }
      }

      setLoaded(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [studentId, monthlyAllowance]);

  const updateDB = async (newPoints: number) => {
    const previousPoints = points;
    setPoints(newPoints);

    const { data, error } = await supabase
      .from("ra_points")
      .update({
        points: newPoints,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId)
      .select("points")
      .single();

    if (error || !data) {
      console.error("Failed to save RA Points:", error);
      setPoints(previousPoints);
      return false;
    }

    setPoints(data.points);
    return true;
  };

  const spend = async (n: number) => {
    if (!loaded || points < n) return false;
    return await updateDB(points - n);
  };

  const earn = async (n: number) => {
    if (!loaded) return false;
    return await updateDB(points + n);
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

async function getFunctionHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

async function getMultipartHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

// ─── Extract text from file via edge function ───
async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(EXTRACT_URL, {
    method: "POST",
    headers: await getMultipartHeaders(),
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

// ─── Usage-aware AI helpers ───
type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number;
  cached?: boolean;
};

function creditsFromTokens(inputTokens: number, outputTokens: number) {
  // 1 RA Credit = 1,000 total AI tokens.
  // Keep fractional credits so short answers cost less than long answers.
  return Math.max(0.01, Math.ceil(((inputTokens + outputTokens) / 1000) * 100) / 100);
}

async function streamChat({ messages, mode, sourceText, onDelta, onDone, onUsage }: {
  messages: Msg[]; mode: string; sourceText?: string;
  onDelta: (t: string) => void; onDone: () => void;
  onUsage?: (usage: AIUsage) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: await getFunctionHeaders(),
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

      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
        if (p.usage) onUsage?.(p.usage);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }

  onDone();
}

// ─── Non-streaming fetch ───
async function fetchAI(messages: Msg[], mode: string, sourceText?: string): Promise<{ content: string; usage?: AIUsage }> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: await getFunctionHeaders(),
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
const AudioSummary = ({ sourceText, settleAIUsage }: { sourceText: string; settleAIUsage: (usage?: AIUsage) => Promise<boolean> }) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const generateSummary = async () => {
    if (!sourceText.trim()) { toast({ title: "Add source material first!", variant: "destructive" }); return; }
    setIsGenerating(true);
    setSummary("");
    let text = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: `Create a concise audio-friendly summary (no markdown, no special formatting, plain text only) of this material for a student to listen to. Make it engaging and educational:\n\n${sourceText.slice(0, 3000)}` }],
        mode: "chat",
        onDelta: (c) => { text += c; setSummary(text); },
        onUsage: settleAIUsage,
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
  const settleAIUsage = useCallback(async (usage?: AIUsage) => {
    if (!usage || usage.cached) return true;
    const inputTokens = Number(usage.inputTokens || 0);
    const outputTokens = Number(usage.outputTokens || 0);
    const totalTokens = Number(usage.totalTokens || inputTokens + outputTokens);
    const credits = Number(usage.credits || creditsFromTokens(inputTokens, outputTokens));
    if (credits <= 0) return true;
    const ok = await spend(credits);
    if (!ok) {
      toast({ title: "Not enough RA Credits!", description: `${credits.toFixed(2)} credits were needed for this response.`, variant: "destructive" });
      return false;
    }
    return true;
  }, [spend, toast]);


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
      await streamChat({ messages: [...chatPersistence.messages, userMsg], mode: "chat", onDelta: upsert, onUsage: settleAIUsage, onDone: () => {
        setIsChatLoading(false);
        chatPersistence.saveMessage({ role: "assistant", content: assistant });
      }});
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to get AI response", variant: "destructive" });
      setIsChatLoading(false);
    }
  }, [chatInput, chatPersistence.messages, isChatLoading, toast, settleAIUsage]);

  // ─── Notebook ───
  const sendNotebook = useCallback(async () => {
    if (!notebookInput.trim() || isNotebookLoading) return;
    if (!notebookSource.trim()) { toast({ title: "Add source material first!", variant: "destructive" }); return; }
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
      await streamChat({ messages: [...notebookPersistence.messages, userMsg], mode: "notebook", sourceText: notebookSource, onDelta: upsert, onUsage: settleAIUsage, onDone: () => {
        setIsNotebookLoading(false);
        notebookPersistence.saveMessage({ role: "assistant", content: assistant });
      }});
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" });
      setIsNotebookLoading(false);
    }
  }, [notebookInput, notebookPersistence.messages, notebookSource, isNotebookLoading, toast, settleAIUsage]);

  // ─── Mind Map ───
  const generateMindMap = async () => {
    if (!mindMapSource.trim()) return;
    setIsMindMapLoading(true);
    setMindMapData(null);
    let raw = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: mindMapSource.trim() }], mode: "mindmap",
        onDelta: (c) => { raw += c; },
        onUsage: settleAIUsage,

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
    setIsQuizLoading(true);
    setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false);
    try {
      const data = await fetchAI([{ role: "user", content: `Generate a quiz about: ${quizTopic.trim()}` }], "quiz");
      if (!(await settleAIUsage(data.usage))) return;
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
    setIsNoteSolving(true); setNoteSolution("");
    let sol = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: noteContent.trim() }], mode: "solve",
        onDelta: (c) => { sol += c; setNoteSolution(sol); },
        onUsage: settleAIUsage,
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
                <span className="font-bold text-xs">{Number(points).toFixed(2)}</span>
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