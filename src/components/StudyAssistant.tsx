import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Target, Network, StickyNote, Plus, Trash2, Save,
  BookOpen, Loader2, ChevronRight, X, FileText, Trophy,
  Brain, Wand2, CheckCircle2, XCircle, Upload,
  ExternalLink, Image as ImageIcon,
  Volume2, VolumeX, ZoomIn, ZoomOut, Move, CalendarDays, Layers3, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;
const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`;

type Msg = { role: "user" | "assistant"; content: string };
interface MindMapNode { title: string; children: MindMapNode[]; }
interface Note { id: string; title: string; content: string; createdAt: string; updatedAt: string; }
interface QuizQuestion { question: string; options: string[]; correct: number; explanation: string; }
interface Quiz { title: string; questions: QuizQuestion[]; }
interface Flashcard { front: string; back: string; }
interface FlashcardDeck { title: string; cards: Flashcard[]; }
interface StudyPlanDay {
  day: number;
  title: string;
  focus: string;
  tasks: string[];
  revision: string;
  practice: string;
  minutes?: number;
}
interface StudyPlan {
  title: string;
  summary: string;
  days: StudyPlanDay[];
}
interface AcademySyllabus {
  id: string;
  board: string;
  class_level: string;
  subject: string;
  title: string;
  academic_year: string;
  syllabus_content: string;
}

// ─── RA Credits (DB-backed + monthly reset safe) ───
function useRAPoints(studentId: string, isOnline = false) {
  const fallbackAllowance = isOnline ? 20 : 100;
  const [points, setPoints] = useState(fallbackAllowance);
  const [monthlyAllowance, setMonthlyAllowance] = useState(fallbackAllowance);
  const [nextReset, setNextReset] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return null;

    const { data, error } = await supabase.rpc("get_student_ra_points", {
      p_student_id: studentId,
    });

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      console.error("Failed to load RA Credits:", error);
      setLoaded(true);
      return null;
    }

    setPoints(Number(row.points));
    setMonthlyAllowance(Number(row.monthly_allowance));
    setNextReset(row.next_reset || null);
    setLoaded(true);
    return row;
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    const row = await load();
    return row?.points ?? null;
  };

  const spend = async (n: number, reason = "ai_fixed_cost") => {
    if (!loaded) return false;
    const { data, error } = await supabase.rpc("consume_student_ra_points", {
      p_student_id: studentId,
      p_points: n,
      p_reason: reason,
      p_metadata: { client: "student_portal" },
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.ok) return false;
    setPoints(Number(row.balance));
    return true;
  };

  const earn = async (n: number, reason = "reward") => {
    if (!loaded) return false;
    const { data, error } = await supabase.rpc("award_student_ra_points", {
      p_student_id: studentId,
      p_points: n,
      p_reason: reason,
      p_metadata: { client: "student_portal" },
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.ok) return false;
    setPoints(Number(row.balance));
    return true;
  };

  return { points, spend, earn, refresh, loaded, monthlyAllowance, nextReset };
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
  studentPointsRemaining?: number;
};

function creditsFromTokens(inputTokens: number, outputTokens: number) {
  // 1 RA Credit = 1,000 total AI tokens.
  // Keep fractional credits so short answers cost less than long answers.
  return Math.max(0.01, Math.ceil(((inputTokens + outputTokens) / 1000) * 100) / 100);
}

async function streamChat({ messages, mode, sourceText, studentId, parentAccessCode, onDelta, onDone, onUsage }: {
  messages: Msg[]; mode: string; sourceText?: string; studentId?: string; parentAccessCode?: string;
  onDelta: (t: string) => void; onDone: () => void;
  onUsage?: (usage: AIUsage) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: await getFunctionHeaders(),
    body: JSON.stringify({ messages, mode, sourceText, actorRole: "student", studentId, parentAccessCode }),
  });
  if (!resp.ok || !resp.body) {
    if (resp.status === 429) throw new Error("Rate limit exceeded. Please wait a moment.");
    if (resp.status === 402) throw new Error("AI credits exhausted.");
    let detail = "Failed to get AI response";
    try {
      const errorBody = await resp.json();
      if (typeof errorBody?.error === "string") detail = errorBody.error;
      if (errorBody?.required != null && errorBody?.balance != null) {
        detail = `${detail} Required: ${Number(errorBody.required).toFixed(2)} · Balance: ${Number(errorBody.balance).toFixed(2)}`;
      }
    } catch {}
    throw new Error(detail);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
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

  // Flush any incomplete UTF-8 sequence and process a final SSE line.
  buf += decoder.decode();
  if (buf.trim().startsWith("data: ")) {
    const finalPayload = buf.trim().slice(6).trim();
    if (finalPayload !== "[DONE]") {
      try {
        const p = JSON.parse(finalPayload);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
        if (p.usage) onUsage?.(p.usage);
      } catch {}
    }
  }

  onDone();
}

// ─── Non-streaming fetch ───
async function fetchAI(messages: Msg[], mode: string, sourceText?: string, studentId?: string, parentAccessCode?: string): Promise<{ content: string; usage?: AIUsage }> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: await getFunctionHeaders(),
    body: JSON.stringify({ messages, mode, sourceText, actorRole: "student", studentId, parentAccessCode }),
  });
  if (!resp.ok) {
    let detail = "AI request failed";
    try {
      const errorBody = await resp.json();
      if (typeof errorBody?.error === "string") detail = errorBody.error;
    } catch {}
    throw new Error(detail);
  }
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
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>("0");
  const [outline, setOutline] = useState(false);

  type NodeData = {
    node: MindMapNode; x:number; y:number; w:number; h:number; depth:number;
    color:string; parentX?:number; parentY?:number; id:string;
  };
  const allNodes: NodeData[] = [];

  const getNodeDim = (text:string, depth:number) => {
    const max = depth === 0 ? 28 : 24;
    const width = Math.min(max, text.length) * (depth === 0 ? 8.4 : 6.7) + (depth === 0 ? 48 : 28);
    return {
      w: Math.max(depth === 0 ? 155 : 92, width),
      h: depth === 0 ? 50 : depth === 1 ? 38 : 32
    };
  };

  const layout = (
    node:MindMapNode, x:number, y:number, angle:number, depth:number,
    color:string, parentX?:number, parentY?:number, idPrefix="0"
  ) => {
    const {w,h}=getNodeDim(node.title,depth);
    const id=idPrefix;
    allNodes.push({node,x,y,w,h,depth,color,parentX,parentY,id});
    if(!node.children?.length || collapsed.has(id)) return;
    const count=node.children.length;
    const spread=depth===0 ? Math.PI*1.72 : Math.min(Math.PI*.82,count*.48);
    const start=depth===0 ? -Math.PI*.86 : angle-spread/2;
    const radius=depth===0 ? 215 : depth===1 ? 155 : 112;
    node.children.forEach((child,i)=>{
      const a=start+(count>1?(i/(count-1))*spread:spread/2);
      layout(child,x+Math.cos(a)*radius,y+Math.sin(a)*radius,a,depth+1,
        depth===0?BRANCH_COLORS[i%BRANCH_COLORS.length]:color,x,y,`${id}-${i}`);
    });
  };

  layout(data,450,350,0,0,BRANCH_COLORS[0]);

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  allNodes.forEach(n=>{
    minX=Math.min(minX,n.x-n.w/2-50); maxX=Math.max(maxX,n.x+n.w/2+50);
    minY=Math.min(minY,n.y-n.h/2-50); maxY=Math.max(maxY,n.y+n.h/2+50);
  });
  const vbW=maxX-minX+100, vbH=maxY-minY+100;
  const viewBox=`${minX-50-pan.x/scale} ${minY-50-pan.y/scale} ${vbW/scale} ${vbH/scale}`;
  const selectedNode=allNodes.find(n=>n.id===selected);

  const toggleCollapse=(id:string)=>{
    setCollapsed(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
  };
  const handleWheel=(e:React.WheelEvent)=>{
    e.preventDefault();
    setScale(prev=>Math.min(2.8,Math.max(.45,prev*(e.deltaY>0?.9:1.1))));
  };
  const handleMouseDown=(e:React.MouseEvent)=>{
    setIsPanning(true);setPanStart({x:e.clientX-pan.x,y:e.clientY-pan.y});
  };
  const handleMouseMove=(e:React.MouseEvent)=>{
    if(isPanning)setPan({x:e.clientX-panStart.x,y:e.clientY-panStart.y});
  };
  const reset=()=>{setScale(1);setPan({x:0,y:0});setCollapsed(new Set());setSelected("0");};

  const renderOutline=(node:MindMapNode,id="0",depth=0):React.ReactNode=>(
    <div key={id} className="space-y-1">
      <button
        onClick={()=>setSelected(id)}
        className={`w-full text-left rounded-lg px-3 py-2 transition-all ${selected===id?"bg-primary/10 ring-1 ring-primary/30":"hover:bg-muted/60"}`}
      >
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{background:BRANCH_COLORS[Math.max(0,depth-1)%BRANCH_COLORS.length]}} />
          <span className={depth===0?"font-bold":"font-medium"}>{node.title}</span>
          {node.children?.length ? <Badge variant="secondary" className="ml-auto text-[10px]">{node.children.length}</Badge> : null}
        </span>
      </button>
      {node.children?.length ? <div className="ml-4 pl-2 border-l border-border/60">{node.children.map((child,i)=>renderOutline(child,`${id}-${i}`,depth+1))}</div> : null}
    </div>
  );

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-background via-background to-primary/[0.04] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-background/80">
        <div>
          <div className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary"/><span className="font-semibold">{data.title}</span></div>
          <p className="text-xs text-muted-foreground mt-0.5">Tap a node to explore • drag to move • scroll to zoom</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={outline?"default":"outline"} onClick={()=>setOutline(v=>!v)}>{outline?"Map":"Outline"}</Button>
          {!outline && <>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={()=>setScale(v=>Math.min(2.8,v*1.2))}><ZoomIn className="w-3.5 h-3.5"/></Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={()=>setScale(v=>Math.max(.45,v*.82))}><ZoomOut className="w-3.5 h-3.5"/></Button>
          </>}
          <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
        </div>
      </div>

      {selectedNode && (
        <div className="px-4 py-3 bg-muted/20 border-b flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold shadow-sm" style={{background:selectedNode.color}}>
            {selectedNode.depth===0?"★":selectedNode.depth}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{selectedNode.node.title}</p>
            <p className="text-xs text-muted-foreground">
              {selectedNode.depth===0?"Main topic":selectedNode.depth===1?"Core concept":"Key detail"} · {selectedNode.node.children?.length||0} sub-topic{selectedNode.node.children?.length===1?"":"s"}
            </p>
          </div>
          {selectedNode.node.children?.length ? <Button size="sm" variant="outline" className="ml-auto" onClick={()=>toggleCollapse(selectedNode.id)}>{collapsed.has(selectedNode.id)?"Expand":"Collapse"}</Button>:null}
        </div>
      )}

      {outline ? (
        <div className="p-4 max-h-[430px] overflow-auto">{renderOutline(data)}</div>
      ) : (
        <div
          className="h-[430px] overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.07),transparent_55%)]"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={()=>setIsPanning(false)}
          onMouseLeave={()=>setIsPanning(false)}
        >
          <svg viewBox={viewBox} className="w-full h-full" style={{touchAction:"none"}}>
            <defs>
              <filter id="mindmap-shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".16"/></filter>
            </defs>
            {allNodes.filter(n=>n.parentX!==undefined).map((n,i)=>{
              const mx=(n.parentX!+n.x)/2;
              return <path key={`line-${i}`} d={`M ${n.parentX} ${n.parentY} Q ${mx} ${n.parentY}, ${n.x} ${n.y}`} fill="none" stroke={n.color} strokeWidth={n.depth===1?3:1.8} strokeOpacity=".42" />;
            })}
            {allNodes.map((n,i)=>{
              const hasChildren=!!n.node.children?.length;
              const active=n.id===selected;
              const fontSize=n.depth===0?14:n.depth===1?11.5:9.8;
              return <g key={`node-${i}`} onClick={(e)=>{e.stopPropagation();setSelected(n.id);if(hasChildren)toggleCollapse(n.id);}} style={{cursor:"pointer"}}>
                <motion.rect
                  initial={{scale:.7,opacity:0}} animate={{scale:1,opacity:1}}
                  transition={{delay:Math.min(i*.025,.35),type:"spring",stiffness:220}}
                  x={n.x-n.w/2} y={n.y-n.h/2} width={n.w} height={n.h}
                  rx={n.depth===0?18:n.depth===1?13:10}
                  fill={n.depth===0?n.color:"hsl(var(--background))"}
                  stroke={n.color} strokeWidth={active?3:1.7}
                  filter={active?"url(#mindmap-shadow)":undefined}
                />
                <text x={n.x} y={n.y+fontSize*.35} textAnchor="middle"
                  fill={n.depth===0?"white":"hsl(var(--foreground))"} fontSize={fontSize}
                  fontWeight={n.depth<=1?"650":"500"} fontFamily="system-ui,sans-serif">
                  {n.node.title.length>28?n.node.title.slice(0,26)+"…":n.node.title}
                </text>
                {hasChildren && <circle cx={n.x+n.w/2-9} cy={n.y-n.h/2+9} r="7" fill={n.color}/>}
                {hasChildren && <text x={n.x+n.w/2-9} y={n.y-n.h/2+12.5} textAnchor="middle" fontSize="9" fill="white">{collapsed.has(n.id)?"+":"−"}</text>}
              </g>;
            })}
          </svg>
        </div>
      )}
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
        parentAccessCode,
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
const StudyAssistant = ({ studentName, studentId, studentClass, isOnlineStudent, parentAccessCode }: { studentName: string; studentId: string; studentClass?: string; isOnlineStudent?: boolean; parentAccessCode?: string }) => {
  const { toast } = useToast();
  const { points, spend, refresh: refreshPoints } = useRAPoints(studentId, isOnlineStudent);
  const settleAIUsage = useCallback(async (usage?: AIUsage) => {
    if (!usage || usage.cached) return true;
    if (typeof usage.studentPointsRemaining === "number") {
      await refreshPoints();
      return true;
    }
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

  // Study Planner
  const [planGoal, setPlanGoal] = useState("");
  const [planHours, setPlanHours] = useState("2");
  const [planDays, setPlanDays] = useState("7");
  const [studyPlan, setStudyPlan] = useState("");
  const [studyPlanData, setStudyPlanData] = useState<StudyPlan | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [useAcademySyllabus, setUseAcademySyllabus] = useState(true);
  const [syllabusItems, setSyllabusItems] = useState<AcademySyllabus[]>([]);
  const [syllabusSubject, setSyllabusSubject] = useState("all");
  const [isSyllabusLoading, setIsSyllabusLoading] = useState(false);
  const [completedPlanTasks, setCompletedPlanTasks] = useState<Record<string, boolean>>({});

  // Flashcards
  const [flashcardTopic, setFlashcardTopic] = useState("");
  const [flashcardDeck, setFlashcardDeck] = useState<FlashcardDeck | null>(null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [isFlashcardLoading, setIsFlashcardLoading] = useState(false);

  const generateStudyPlan = async () => {
    if (!planGoal.trim() || isPlanLoading) return;
    setIsPlanLoading(true);
    try {
      const selectedSyllabus = useAcademySyllabus
        ? syllabusItems.filter(item => syllabusSubject === "all" || item.subject === syllabusSubject)
        : [];
      const syllabusText = selectedSyllabus
        .map(item => `SUBJECT: ${item.subject}\n${item.title}\n${item.syllabus_content}`)
        .join("\n\n---\n\n")
        .slice(0, 7000);

      const result = await fetchAI(
        [{ role: "user", content:
          `Create a practical study plan for a Class ${studentClass || "student"} student.
Goal: ${planGoal}
Available study time: ${planHours} hours per day
Plan duration: ${Math.min(30, Math.max(1, Number(planDays) || 7))} days

ACADEMY SYLLABUS:
${syllabusText || "No academy syllabus selected. Use the student's goal to plan the topics."}

Use the academy syllabus topics whenever supplied. Prioritize topics relevant to the goal.
Return ONLY valid JSON:
{"title":"...","summary":"...","days":[{"day":1,"title":"...","focus":"...","tasks":["...","..."],"revision":"...","practice":"...","minutes":120}]}
Create one day object for every requested day. Keep the plan realistic and motivating.`
        }],
        "study_plan",
        undefined,
        studentId,
        parentAccessCode
      );
      const parsed = extractJson<StudyPlan>(result.content);
      if (!parsed?.days?.length) throw new Error("The AI did not return a valid study plan.");
      setStudyPlanData(parsed);
      setStudyPlan(result.content || "");
      setCompletedPlanTasks({});
      localStorage.setItem(`student_study_plan_${studentId}`, JSON.stringify(parsed));
      toast({ title: "📚 Your smart study plan is ready!" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to create study plan", variant: "destructive" });
    } finally {
      setIsPlanLoading(false);
    }
  };

  const generateFlashcards = async () => {
    if (!flashcardTopic.trim() || isFlashcardLoading) return;
    setIsFlashcardLoading(true);
    setFlashcardDeck(null);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    try {
      const result = await fetchAI(
        [{ role: "user", content:
          `Create 10 high-quality study flashcards for Class ${studentClass || "student"} on: ${flashcardTopic}.
Return ONLY valid JSON in this exact shape:
{"title":"...","cards":[{"front":"question or term","back":"clear answer or explanation"}]}
Keep each card concise and useful for exam revision.`
        }],
        "flashcards",
        undefined,
        studentId,
        parentAccessCode
      );
      const parsed = extractJson<FlashcardDeck>(result.content);
      if (!parsed?.cards?.length) throw new Error("The AI did not return valid flashcards.");
      setFlashcardDeck(parsed);
      toast({ title: "🧠 Flashcards generated!" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to generate flashcards", variant: "destructive" });
    } finally {
      setIsFlashcardLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(`student_study_plan_${studentId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.days) setStudyPlanData(parsed as StudyPlan);
        else setStudyPlan(saved);
      } catch {
        setStudyPlan(saved);
      }
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const loadSyllabus = async () => {
      setIsSyllabusLoading(true);
      const { data, error } = await supabase.rpc("get_student_academic_syllabus", {
        p_student_id: studentId,
        p_parent_access_code: parentAccessCode || null,
      });
      if (!cancelled) {
        if (error) {
          console.warn("Academy syllabus unavailable:", error.message);
          setSyllabusItems([]);
        } else {
          setSyllabusItems((data || []) as AcademySyllabus[]);
        }
        setIsSyllabusLoading(false);
      }
    };
    void loadSyllabus();
    return () => { cancelled = true; };
  }, [studentId, parentAccessCode]);

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
      await streamChat({ parentAccessCode, messages: [...chatPersistence.messages, userMsg], mode: "chat", studentId, onDelta: upsert, onUsage: settleAIUsage, onDone: () => {
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
      await streamChat({ parentAccessCode, messages: [...notebookPersistence.messages, userMsg], mode: "notebook", sourceText: notebookSource, studentId, onDelta: upsert, onUsage: settleAIUsage, onDone: () => {
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
    if (!mindMapSource.trim() || isMindMapLoading) return;

    setIsMindMapLoading(true);
    setMindMapData(null);

    try {
      // Mind-map is a non-streaming JSON endpoint. The backend is the single
      // source of truth for token-based RA Point charging, so do not pre-charge
      // or refund here.
      const data = await fetchAI(
        [{ role: "user", content: mindMapSource.trim() }],
        "mindmap",
        undefined,
        studentId,
        parentAccessCode,
      );

      const parsed = extractJson<MindMapNode>(data.content);
      if (!parsed?.title || !Array.isArray(parsed.children)) {
        throw new Error("The AI returned an invalid mind map.");
      }

      setMindMapData(parsed);
      await settleAIUsage(data.usage);
    } catch (error) {
      toast({
        title: "Failed to generate mind map",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMindMapLoading(false);
      await refreshPoints();
    }
  };

  // ─── Quiz ───
  const generateQuiz = async () => {
    if (!quizTopic.trim()) return;
    setIsQuizLoading(true);
    setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false);
    try {
      const data = await fetchAI([{ role: "user", content: `Generate a quiz about: ${quizTopic.trim()}` }], "quiz", undefined, studentId, parentAccessCode);
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
    toast({ title: `🎉 Score: ${correct}/${quiz.questions.length}`, description: "Quiz completed successfully." });
  };

  // ─── Notes ───
  const solveNote = async () => {
    if (!noteContent.trim()) return;
    setIsNoteSolving(true); setNoteSolution("");
    let sol = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: noteContent.trim() }], mode: "solve", studentId, parentAccessCode,
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
    { id: "plan", icon: CalendarDays, label: "Study Plan" },
    { id: "flashcards", icon: Layers3, label: "Flashcards" },
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
<motion.div
                key={points}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 bg-accent/15 px-2.5 py-1.5 rounded-lg"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary fill-primary" />
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
                  <AudioSummary sourceText={notebookSource} studentId={studentId} />

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
                    <p className="text-[10px] text-muted-foreground mt-1">Practice, learn and improve with every quiz</p>
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

          {/* ─── Study Planner ─── */}
          {activeTab === "plan" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              <div className="rounded-3xl border overflow-hidden bg-gradient-to-br from-primary/10 via-background to-amber-500/10">
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                      <CalendarDays className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">Smart Study Planner</h3>
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">AI + Syllabus</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Your academy syllabus becomes a personalised day-by-day roadmap.</p>
                    </div>
                  </div>
                </div>
                <div className="border-t bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Use Academy Syllabus</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isSyllabusLoading ? "Loading your class syllabus..." : syllabusItems.length ? `${syllabusItems.length} syllabus ${syllabusItems.length === 1 ? "item" : "items"} available` : "Your academy has not added a syllabus for this class yet."}
                      </p>
                    </div>
                    <button type="button" onClick={() => setUseAcademySyllabus(v => !v)} className={`relative h-7 w-12 rounded-full transition-colors ${useAcademySyllabus ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${useAcademySyllabus ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  {useAcademySyllabus && syllabusItems.length > 0 && (
                    <div className="mt-3">
                      <select value={syllabusSubject} onChange={e => setSyllabusSubject(e.target.value)} className="h-9 w-full rounded-xl border bg-background px-3 text-xs">
                        <option value="all">All Academy Subjects</option>
                        {[...new Set(syllabusItems.map(item => item.subject))].map(subject => <option key={subject} value={subject}>{subject}</option>)}
                      </select>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {syllabusItems.filter(item => syllabusSubject === "all" || item.subject === syllabusSubject).slice(0, 6).map(item => (
                          <Badge key={item.id} variant="secondary" className="text-[10px]">{item.subject} · {item.title}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Input placeholder="What do you want to achieve? e.g. Prepare for Geography exam" value={planGoal} onChange={(e) => setPlanGoal(e.target.value)} className="rounded-xl bg-muted/30" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Hours / day</p>
                  <Input type="number" min="0.5" max="12" step="0.5" value={planHours} onChange={(e) => setPlanHours(e.target.value)} />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Days</p>
                  <Input type="number" min="1" max="30" value={planDays} onChange={(e) => setPlanDays(e.target.value)} />
                </div>
              </div>
              <Button onClick={generateStudyPlan} disabled={isPlanLoading || !planGoal.trim()} className="w-full rounded-xl h-11">
                {isPlanLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building your roadmap...</> : <><Target className="mr-2 h-4 w-4" /> Build My Study Roadmap</>}
              </Button>

              {studyPlanData ? (
                <div className="space-y-3">
                  <div className="rounded-3xl border bg-gradient-to-r from-primary/10 via-background to-accent/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="secondary" className="mb-2">PERSONALISED ROADMAP</Badge>
                        <h3 className="text-lg font-bold">{studyPlanData.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{studyPlanData.summary}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => { setStudyPlan(""); setStudyPlanData(null); setCompletedPlanTasks({}); localStorage.removeItem(`student_study_plan_${studentId}`); }} className="h-7 text-xs shrink-0">
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> New
                      </Button>
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      <Badge variant="outline">{studyPlanData.days.length} days</Badge>
                      <Badge variant="outline">{studyPlanData.days.reduce((sum, day) => sum + (day.minutes || Number(planHours) * 60), 0)} min total</Badge>
                      <Badge variant="outline">{Object.values(completedPlanTasks).filter(Boolean).length} tasks done</Badge>
                    </div>
                  </div>

                  {studyPlanData.days.map((day) => (
                    <div key={day.day} className="rounded-3xl border bg-card overflow-hidden shadow-sm">
                      <div className="flex items-center gap-3 border-b bg-muted/20 p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 font-bold text-primary">{day.day}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm">Day {day.day} · {day.title}</p>
                          <p className="text-[10px] text-muted-foreground">{day.focus}</p>
                        </div>
                        <Badge variant="secondary">{day.minutes || Number(planHours) * 60} min</Badge>
                      </div>
                      <div className="grid gap-2 p-3 sm:grid-cols-2">
                        <div className="rounded-2xl border bg-primary/[0.03] p-3">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-primary">Today's Tasks</p>
                          <div className="space-y-2">
                            {(day.tasks || []).map((task, index) => {
                              const key = `${day.day}-${index}`;
                              return (
                                <label key={key} className="flex cursor-pointer items-start gap-2 rounded-xl p-2 hover:bg-muted/40">
                                  <input type="checkbox" checked={!!completedPlanTasks[key]} onChange={() => setCompletedPlanTasks(prev => ({ ...prev, [key]: !prev[key] }))} className="mt-0.5 h-4 w-4" />
                                  <span className={`text-xs leading-relaxed ${completedPlanTasks[key] ? "text-muted-foreground line-through" : ""}`}>{task}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="rounded-2xl border p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Revision</p>
                            <p className="mt-1 text-xs leading-relaxed">{day.revision}</p>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Practice</p>
                            <p className="mt-1 text-xs leading-relaxed">{day.practice}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : studyPlan ? (
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{studyPlan}</ReactMarkdown></div>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* ─── Flashcards ─── */}
          {activeTab === "flashcards" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 space-y-3">
              {!flashcardDeck ? (
                <>
                  <div className="rounded-2xl border bg-gradient-to-br from-violet-500/5 to-cyan-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10">
                        <Layers3 className="h-6 w-6 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="font-bold">AI Flashcards</h3>
                        <p className="text-[11px] text-muted-foreground">Fast active-recall revision for any topic.</p>
                      </div>
                    </div>
                  </div>
                  <Input placeholder="Topic: Trigonometry, Cell Biology, Mughal Empire..." value={flashcardTopic} onChange={(e) => setFlashcardTopic(e.target.value)} className="rounded-xl bg-muted/30" />
                  <Button onClick={generateFlashcards} disabled={isFlashcardLoading || !flashcardTopic.trim()} className="w-full rounded-xl">
                    {isFlashcardLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating cards...</> : <><Layers3 className="mr-2 h-4 w-4" /> Generate 10 Flashcards</>}
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{flashcardDeck.title}</p>
                      <p className="text-[10px] text-muted-foreground">Card {flashcardIndex + 1} of {flashcardDeck.cards.length}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setFlashcardDeck(null)} className="h-7 text-xs">New Deck</Button>
                  </div>
                  <button type="button" onClick={() => setFlashcardFlipped(v => !v)} className="w-full min-h-[230px] rounded-3xl border-2 border-primary/15 bg-gradient-to-br from-background to-primary/5 p-6 text-left shadow-lg transition-transform hover:scale-[1.01]">
                    <div className="flex min-h-[195px] flex-col items-center justify-center text-center">
                      <Badge variant="secondary" className="mb-5">{flashcardFlipped ? "ANSWER" : "QUESTION"}</Badge>
                      <p className="text-lg font-bold leading-relaxed">{flashcardFlipped ? flashcardDeck.cards[flashcardIndex].back : flashcardDeck.cards[flashcardIndex].front}</p>
                      <p className="mt-5 text-[10px] text-muted-foreground">Tap to flip</p>
                    </div>
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" disabled={flashcardIndex === 0} onClick={() => { setFlashcardIndex(i => Math.max(0, i - 1)); setFlashcardFlipped(false); }}>Previous</Button>
                    <Button variant="secondary" onClick={() => setFlashcardFlipped(false)}>Again</Button>
                    <Button disabled={flashcardIndex >= flashcardDeck.cards.length - 1} onClick={() => { setFlashcardIndex(i => Math.min(flashcardDeck.cards.length - 1, i + 1)); setFlashcardFlipped(false); }}>Next</Button>
                  </div>
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

        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StudyAssistant;