import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Network, StickyNote, Plus, Trash2, Save,
  BookOpen, Loader2, ChevronRight, ChevronDown, X, FileText, ExternalLink
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

interface MindMapNode {
  title: string;
  children: MindMapNode[];
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Robust JSON extractor ───
function extractJsonFromResponse(response: string): MindMapNode | null {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/\{/);
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return null;

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === "\n" || ch === "\r" || ch === "\t") return ch;
    return "";
  });

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fix common LLM JSON issues
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/'/g, '"')
      .replace(/(\w+)\s*:/g, '"$1":')
      .replace(/""+/g, '"');

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

// ─── Streaming helper ───
async function streamChat({
  messages, mode, onDelta, onDone,
}: {
  messages: Msg[]; mode: string;
  onDelta: (t: string) => void; onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, mode }),
  });
  if (!resp.ok || !resp.body) throw new Error("Failed to start stream");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let streamDone = false;
  while (!streamDone) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let ni: number;
    while ((ni = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, ni); buf = buf.slice(ni + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || !line.trim() || !line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { streamDone = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

// ─── Mind Map Renderer ───
const MindMapNodeView = ({ node, depth = 0 }: { node: MindMapNode; depth?: number }) => {
  const [open, setOpen] = useState(true);
  const colors = [
    "border-l-4 border-blue-400 bg-blue-50/80",
    "border-l-4 border-emerald-400 bg-emerald-50/80",
    "border-l-4 border-purple-400 bg-purple-50/80",
    "border-l-4 border-amber-400 bg-amber-50/80",
    "border-l-4 border-rose-400 bg-rose-50/80",
  ];
  const color = colors[depth % colors.length];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: depth * 0.05 }}
      className="ml-2"
    >
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-r-lg ${color} mb-1.5 cursor-pointer transition-all hover:shadow-sm`}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-foreground" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-foreground" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-foreground/50 shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground">{node.title}</span>
      </div>
      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-4 border-l-2 border-muted pl-2"
          >
            {node.children.map((c, i) => (
              <MindMapNodeView key={i} node={c} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Component ───
const StudyAssistant = ({ studentName }: { studentName: string }) => {
  const { toast } = useToast();

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mind Map state
  const [mindMapSource, setMindMapSource] = useState("");
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [isMindMapLoading, setIsMindMapLoading] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("student_notes") || "[]");
    } catch { return []; }
  });
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem("student_notes", JSON.stringify(notes));
  }, [notes]);

  // ─── Chat ───
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: Msg = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);
    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        }
        return [...prev, { role: "assistant", content: assistant }];
      });
    };
    try {
      await streamChat({
        messages: [...chatMessages, userMsg], mode: "chat",
        onDelta: upsert, onDone: () => setIsChatLoading(false),
      });
    } catch {
      toast({ title: "Failed to get AI response", variant: "destructive" });
      setIsChatLoading(false);
    }
  }, [chatInput, chatMessages, isChatLoading, toast]);

  // ─── Mind Map ───
  const generateMindMap = async () => {
    if (!mindMapSource.trim()) return;
    setIsMindMapLoading(true);
    setMindMapData(null);
    let raw = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: mindMapSource.trim() }],
        mode: "mindmap",
        onDelta: (c) => { raw += c; },
        onDone: () => {
          const parsed = extractJsonFromResponse(raw);
          if (parsed) {
            setMindMapData(parsed);
          } else {
            toast({ title: "Failed to parse mind map. Try again.", variant: "destructive" });
          }
          setIsMindMapLoading(false);
        },
      });
    } catch {
      toast({ title: "Failed to generate mind map", variant: "destructive" });
      setIsMindMapLoading(false);
    }
  };

  // ─── Notes ───
  const createNote = () => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "Untitled Note",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [note, ...prev]);
    setActiveNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  const saveNote = () => {
    if (!activeNote) return;
    const updated = {
      ...activeNote,
      title: noteTitle || "Untitled Note",
      content: noteContent,
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setActiveNote(updated);
    toast({ title: "Note saved!" });
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote?.id === id) {
      setActiveNote(null);
      setNoteTitle("");
      setNoteContent("");
    }
  };

  const openNote = (note: Note) => {
    setActiveNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-primary/20 overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 pb-4">
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <Sparkles className="w-5 h-5 text-primary" />
            </motion.div>
            AI Study Assistant
            <Badge variant="secondary" className="text-xs ml-auto">Powered by AI</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hi {studentName}! Ask questions, generate mind maps, or take notes.
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="w-full rounded-none grid grid-cols-4 h-11 bg-muted/50">
              <TabsTrigger value="chat" className="flex items-center gap-1 text-xs sm:text-sm">
                <Bot className="w-4 h-4" /> Ask AI
              </TabsTrigger>
              <TabsTrigger value="notebook" className="flex items-center gap-1 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4" /> NotebookLM
              </TabsTrigger>
              <TabsTrigger value="mindmap" className="flex items-center gap-1 text-xs sm:text-sm">
                <Network className="w-4 h-4" /> Mind Map
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1 text-xs sm:text-sm">
                <StickyNote className="w-4 h-4" /> Notes
              </TabsTrigger>
            </TabsList>

            {/* ─── AI Chat Tab ─── */}
            <TabsContent value="chat" className="m-0 p-4">
              <div className="h-[350px] overflow-y-auto border rounded-xl p-3 space-y-3 bg-muted/20 mb-3">
                {chatMessages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <BookOpen className="w-12 h-12 opacity-30" />
                    </motion.div>
                    <p className="text-sm text-center">Ask me anything about your studies!<br />Math, Science, History — I'm here to help.</p>
                  </motion.div>
                )}
                <AnimatePresence mode="popLayout">
                  {chatMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-background border shadow-sm rounded-bl-sm"
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
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-background border shadow-sm px-4 py-2 rounded-2xl rounded-bl-sm">
                      <div className="flex items-center gap-1.5">
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-2 h-2 bg-primary rounded-full" />
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                  className="rounded-full"
                />
                <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={isChatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </TabsContent>

            {/* ─── NotebookLM Tab ─── */}
            <TabsContent value="notebook" className="m-0 p-4 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
              >
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Google NotebookLM</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use Google's powerful AI notebook to study smarter. Upload your sources, ask questions, and get AI-generated summaries.
                  </p>
                </div>

                <div className="grid gap-3 text-left">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Upload Your Sources</p>
                      <p className="text-xs text-muted-foreground">Add PDFs, Google Docs, websites, or text to NotebookLM</p>
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Ask Questions</p>
                      <p className="text-xs text-muted-foreground">AI answers based on your uploaded sources with citations</p>
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Generate Audio Overviews</p>
                      <p className="text-xs text-muted-foreground">Get podcast-style audio summaries of your study material</p>
                    </div>
                  </motion.div>
                </div>

                <Button
                  className="w-full gap-2 h-12 text-base font-semibold"
                  onClick={() => window.open("https://notebooklm.google.com/", "_blank")}
                >
                  <ExternalLink className="w-5 h-5" />
                  Open Google NotebookLM
                </Button>
                <p className="text-xs text-muted-foreground">
                  Sign in with your Google account to use all NotebookLM features for free.
                </p>
              </motion.div>
            </TabsContent>

            {/* ─── Mind Map Tab ─── */}
            <TabsContent value="mindmap" className="m-0 p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Paste your study material or enter a topic to generate a visual mind map.</p>
                <Textarea
                  placeholder="e.g. 'Photosynthesis process' or paste your notes here..."
                  value={mindMapSource}
                  onChange={(e) => setMindMapSource(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button onClick={generateMindMap} disabled={isMindMapLoading || !mindMapSource.trim()} className="w-full">
                  {isMindMapLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Network className="w-4 h-4 mr-2" /> Generate Mind Map</>
                  )}
                </Button>
              </div>
              {mindMapData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="border rounded-xl p-4 bg-muted/20 overflow-auto max-h-[400px]"
                >
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Network className="w-5 h-5 text-primary" />
                    {mindMapData.title}
                  </h3>
                  {mindMapData.children?.map((child, i) => (
                    <MindMapNodeView key={i} node={child} depth={0} />
                  ))}
                </motion.div>
              )}
              {!mindMapData && !isMindMapLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }}>
                    <Network className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  </motion.div>
                  <p className="text-sm">Your mind map will appear here</p>
                </div>
              )}
            </TabsContent>

            {/* ─── Notes Tab ─── */}
            <TabsContent value="notes" className="m-0 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={createNote} variant="outline">
                  <Plus className="w-4 h-4 mr-1" /> New Note
                </Button>
              </div>

              {activeNote ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setActiveNote(null); setNoteTitle(""); setNoteContent(""); }}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Input
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Note title"
                      className="font-semibold"
                    />
                    <Button size="sm" onClick={saveNote}>
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Start writing your notes here... ✍️"
                    className="min-h-[300px] text-sm leading-relaxed"
                  />
                </motion.div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                        <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      </motion.div>
                      <p className="text-sm">No notes yet. Create your first note!</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {notes.map((note) => (
                        <motion.div
                          key={note.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => openNote(note)}
                        >
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{note.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{note.content || "Empty note"}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
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
