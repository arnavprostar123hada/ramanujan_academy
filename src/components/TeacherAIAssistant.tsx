import { useEffect, useMemo, useState } from "react";
import { Bot, Send, Sparkles, Loader2, ClipboardList, MessageSquareText, BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { label: "Lesson Plan", icon: BookOpenCheck, text: "Create a 40-minute lesson plan for Class 10 on [topic]. Include objective, explanation flow, activity, practice and a 5-question exit ticket." },
  { label: "Worksheet", icon: ClipboardList, text: "Create a 10-question practice worksheet for Class [class] [board] on [topic], with 3 easy, 4 standard, 2 HOTS and 1 challenge question. Add an answer key." },
  { label: "Parent Message", icon: MessageSquareText, text: "Write a respectful WhatsApp message to a parent about a student who needs more practice in [subject/topic]. Keep it concise and action-oriented." },
];

type TeacherUsage = { credits?: number; teacherCreditsRemaining?: number; cached?: boolean };

async function callTeacherAI(messages: Message[], teacherId: string, onUsage?: (usage: TeacherUsage) => void) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages: messages.slice(-8), mode: "teacher_chat", actorRole: "teacher", teacherId }),
  });

  if (!response.ok) {
    let message = "Teacher AI is temporarily unavailable.";
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {}
    throw new Error(message);
  }

  // The shared function returns compact SSE for chat responses.
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No AI response body.");
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let buffer = "";
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = -1;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          result += parsed.choices?.[0]?.delta?.content || "";
          if (parsed.usage) onUsage?.(parsed.usage);
        } catch {}
      }
    }
    return result || "I could not generate a response. Please try again.";
  }

  const data = await response.json();
  if (data?.usage) onUsage?.(data.usage);
  return data?.content || data?.error || "I could not generate a response.";
}

export default function TeacherAIAssistant({ teacherName, teacherId }: { teacherName?: string; teacherId?: string }) {
  const { toast } = useToast();
  const [sessionTeacherId, setSessionTeacherId] = useState<string>("");
  const effectiveTeacherId = teacherId || sessionTeacherId;
  useEffect(() => {
    setSessionTeacherId(teacherId || localStorage.getItem("ramanujan_teacher_id") || "");
  }, [teacherId]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [monthlyCredits, setMonthlyCredits] = useState(50);

  const welcome = useMemo(() => [{
    role: "assistant" as const,
    content: `Hello ${teacherName ? teacherName.split(" ")[0] : "Teacher"}! I am Ramanujan Academy Teacher AI. I can help you create lesson plans, worksheets, tests, student interventions and parent messages while keeping the output classroom-ready.`,
  }], [teacherName]);

  const visibleMessages = messages.length ? messages : welcome;

  useEffect(() => {
    if (!effectiveTeacherId) return;
    let cancelled = false;
    const loadCredits = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_SUPABASE_URL + "/functions/v1/study-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ mode: "teacher_balance", actorRole: "teacher", teacherId: effectiveTeacherId, messages: [{ role: "user", content: "balance" }] }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) { setCredits(Number(data.credits || 0)); setMonthlyCredits(Number(data.monthlyAllowance || 50)); }
      } catch {}
    };
    loadCredits();
    return () => { cancelled = true; };
  }, [effectiveTeacherId]);

  const send = async (text = input) => {
    const value = text.trim();
    if (!value || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: value }];
    setMessages(next);
    setLoading(true);
    try {
      const answer = await callTeacherAI(next, effectiveTeacherId, (usage) => {
        if (typeof usage.teacherCreditsRemaining === "number") setCredits(usage.teacherCreditsRemaining);
      });
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (error) {
      toast({ title: "Teacher AI", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-md border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Teacher AI
          <Badge variant="secondary" className="ml-auto text-[10px]">{credits === null ? "AI Credits" : `${credits.toFixed(2)} / ${monthlyCredits.toFixed(0)} credits`}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Plan lessons, generate practice, analyze teaching needs and draft parent communication.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.label} variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setInput(item.text)}>
                <Icon className="w-3.5 h-3.5 mr-1.5" />{item.label}
              </Button>
            );
          })}
        </div>

        <div className="h-[360px] overflow-y-auto rounded-xl border bg-muted/10 p-3 space-y-3">
          {visibleMessages.map((message, index) => (
            <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                {message.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : message.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-2xl px-3 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Preparing your teaching response…
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Teacher AI… e.g. Create a Class 9 ICSE worksheet on linear equations"
            className="min-h-[72px]"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button className="shrink-0 self-end" onClick={() => send()} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Tip: Ctrl/Cmd + Enter to send. Teacher AI gets a monthly credit allowance; repeated identical requests are cached.</p>
      </CardContent>
    </Card>
  );
}
