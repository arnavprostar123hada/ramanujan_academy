import { useEffect, useState } from "react";
import { Bot, Coins, MessageSquare, Clock3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ChatRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: string;
  created_at: string;
};

type UsageRow = {
  id: string;
  mode: string;
  action: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  credits: number;
  provider: string | null;
  cached: boolean;
  created_at: string;
};

const StudentAIHistory = ({ studentId }: { studentId: string }) => {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: chatData }, { data: usageData }] = await Promise.all([
      supabase
        .from("student_chat_messages")
        .select("id, role, content, mode, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("student_ai_usage")
        .select("id, mode, action, input_tokens, output_tokens, total_tokens, credits, provider, cached, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setChats((chatData || []) as ChatRow[]);
    setUsage((usageData || []) as UsageRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [studentId]);

  const charged = usage.filter(u => Number(u.credits) > 0).reduce((sum, u) => sum + Number(u.credits), 0);
  const tokens = usage.reduce((sum, u) => sum + Number(u.total_tokens || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">AI Chats</div><div className="text-xl font-bold">{chats.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">RA Used</div><div className="text-xl font-bold">{charged.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">AI Tokens</div><div className="text-xl font-bold">{tokens.toLocaleString("en-IN")}</div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2"><Bot className="w-4 h-4" /> AI Activity</h4>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {usage.length > 0 && (
        <div className="space-y-2">
          {usage.slice(0, 20).map(row => (
            <div key={row.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5" />
                  {row.action.replaceAll("_", " ")}
                  <Badge variant="secondary">{row.mode}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {row.total_tokens.toLocaleString("en-IN")} tokens
                  {row.provider ? ` · ${row.provider}` : ""}
                  {" · "}{new Date(row.created_at).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="font-semibold whitespace-nowrap">
                {Number(row.credits) > 0 ? `-${Number(row.credits).toFixed(2)} RA` : "No charge"}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="font-semibold flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4" /> Saved Chat History</h4>
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No saved AI chats yet.</p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto space-y-2">
            {chats.map(row => (
              <div key={row.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant={row.role === "user" ? "default" : "outline"}>{row.role}</Badge>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />{new Date(row.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{row.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAIHistory;
