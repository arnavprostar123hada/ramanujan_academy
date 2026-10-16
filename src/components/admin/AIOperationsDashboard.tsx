import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Activity, AlertTriangle, CheckCircle2, CircleDollarSign, Coins, RefreshCw, Server, Zap } from "lucide-react";

type Summary = {
  period_days: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  cache_hits: number;
  provider_errors: number;
  limit_blocks: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  by_feature: { feature: string; requests: number; cost_usd: number }[];
  by_provider: { provider: string; requests: number; errors: number; cost_usd: number }[];
};

const emptySummary: Summary = {
  period_days: 30, total_requests: 0, successful_requests: 0, failed_requests: 0,
  cache_hits: 0, provider_errors: 0, limit_blocks: 0, input_tokens: 0, output_tokens: 0,
  estimated_cost_usd: 0, by_feature: [], by_provider: [],
};

const number = (value: number | null | undefined) => new Intl.NumberFormat("en-IN").format(Number(value || 0));
const usd = (value: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(value || 0));

export function AIOperationsDashboard() {
  const { toast } = useToast();
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_ai_operations_summary", { p_days: Number(days) });
    if (error) {
      toast({ title: "Could not load AI metrics", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setSummary({ ...emptySummary, ...(data as Partial<Summary>) });
    setLoading(false);
  }, [days, toast]);

  useEffect(() => { void load(); }, [load]);

  const cards = [
    { title: "AI requests", value: number(summary.total_requests), detail: `${number(summary.successful_requests)} successful`, icon: Activity },
    { title: "Estimated API cost", value: usd(summary.estimated_cost_usd), detail: "USD · configured provider pricing required for accuracy", icon: CircleDollarSign },
    { title: "Cache hits", value: number(summary.cache_hits), detail: "Answers served without another provider call", icon: Zap },
    { title: "Provider errors", value: number(summary.provider_errors), detail: `${number(summary.failed_requests)} failed requests`, icon: AlertTriangle },
    { title: "Input tokens", value: number(summary.input_tokens), detail: `${number(summary.output_tokens)} output tokens`, icon: Coins },
    { title: "Blocked by limits", value: number(summary.limit_blocks), detail: "Requests stopped by a usage limit", icon: Server },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Operations</h2>
          <p className="text-sm text-muted-foreground">Provider health, usage, caching and estimated cost from recorded AI events.</p>
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect value={days} onValueChange={setDays} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} aria-label="Metrics period" />
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ title, value, detail, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By AI feature</CardTitle></CardHeader>
          <CardContent>
            {summary.by_feature.length ? (
              <div className="space-y-3">
                {summary.by_feature.map((item) => (
                  <div key={item.feature} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0">
                    <div><p className="font-medium">{item.feature}</p><p className="text-xs text-muted-foreground">{number(item.requests)} requests</p></div>
                    <p className="text-sm font-semibold">{usd(item.cost_usd)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No AI operation events have been recorded for this period yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By provider</CardTitle></CardHeader>
          <CardContent>
            {summary.by_provider.length ? (
              <div className="space-y-3">
                {summary.by_provider.map((item) => (
                  <div key={item.provider} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0">
                    <div className="flex items-start gap-2">
                      {item.errors ? <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />}
                      <div><p className="font-medium">{item.provider}</p><p className="text-xs text-muted-foreground">{number(item.requests)} requests · {number(item.errors)} errors</p></div>
                    </div>
                    <p className="text-sm font-semibold">{usd(item.cost_usd)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Provider analytics will appear after the AI function starts recording events.</p>}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Estimated cost is only as accurate as the provider/model rates recorded with each event. No events are fabricated to fill the dashboard.</p>
    </div>
  );
}
