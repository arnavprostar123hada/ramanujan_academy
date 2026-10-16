import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, Zap, Database, AlertTriangle, Coins, Gauge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

type Settings = {
  enabled: boolean;
  daily_budget_usd: number;
  monthly_budget_usd: number;
  cache_hours: number;
  cached_student_charge: number;
  max_requests_per_user_per_minute: number;
};

const defaultSummary: Summary = {
  period_days: 30, total_requests: 0, successful_requests: 0, failed_requests: 0,
  cache_hits: 0, provider_errors: 0, limit_blocks: 0, input_tokens: 0,
  output_tokens: 0, estimated_cost_usd: 0, by_feature: [], by_provider: [],
};

const defaultSettings: Settings = {
  enabled: true, daily_budget_usd: 1, monthly_budget_usd: 10, cache_hours: 24,
  cached_student_charge: 0.5, max_requests_per_user_per_minute: 10,
};

const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 4,
}).format(value || 0);

const number = (value: number) => new Intl.NumberFormat("en-IN").format(value || 0);

export function AIOperationsDashboard() {
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: summaryData, error: summaryError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.rpc("get_ai_operations_summary", { p_days: Number(days) }),
      supabase.rpc("get_ai_operations_settings"),
    ]);
    if (summaryError) {
      toast({ title: "Could not load AI metrics", description: summaryError.message, variant: "destructive" });
    } else if (summaryData) {
      setSummary({ ...defaultSummary, ...(summaryData as unknown as Partial<Summary>) });
    }
    if (settingsError) {
      toast({ title: "Could not load AI settings", description: settingsError.message, variant: "destructive" });
    } else if (settingsData) {
      setSettings({ ...defaultSettings, ...(settingsData as unknown as Partial<Settings>) });
    }
    setLoading(false);
  }, [days, toast]);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async () => {
    setSettingsLoading(true);
    const { data, error } = await supabase.rpc("update_ai_operations_settings" as never, {
      p_settings: settings as never,
    } as never);
    setSettingsLoading(false);
    if (error || !data) {
      toast({
        title: "Settings were not saved",
        description: error?.message || "The settings RPC is not available yet.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "AI settings saved" });
    void load();
  };

  const metrics = [
    { label: "AI requests", value: number(summary.total_requests), icon: Activity },
    { label: "Cache hits", value: number(summary.cache_hits), icon: Database },
    { label: "Provider errors", value: number(summary.provider_errors), icon: AlertTriangle },
    { label: "Estimated API cost", value: money(summary.estimated_cost_usd), icon: Coins },
    { label: "Input tokens", value: number(summary.input_tokens), icon: Zap },
    { label: "Output tokens", value: number(summary.output_tokens), icon: Gauge },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">AI Operations Centre</h2>
          <p className="text-sm text-muted-foreground mt-1">Usage, costs, cache performance and guardrail settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Metrics period">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-primary/10 p-3"><Icon className="h-5 w-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold break-words">{loading ? "…" : value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Usage by AI feature</CardTitle></CardHeader>
        <CardContent>
          {summary.by_feature.length === 0 ? <p className="text-sm text-muted-foreground">No instrumented AI requests yet. Metrics appear after the AI service begins writing events.</p> : (
            <div className="space-y-3">
              {summary.by_feature.map((item) => (
                <div key={item.feature} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0">
                  <div><p className="font-medium">{item.feature}</p><p className="text-xs text-muted-foreground">{number(item.requests)} requests</p></div>
                  <Badge variant="secondary">{money(item.cost_usd)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Provider health</CardTitle></CardHeader>
        <CardContent>
          {summary.by_provider.length === 0 ? <p className="text-sm text-muted-foreground">Provider breakdown will show here after event instrumentation is enabled.</p> : (
            <div className="space-y-3">
              {summary.by_provider.map((item) => (
                <div key={item.provider} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0">
                  <div><p className="font-medium capitalize">{item.provider}</p><p className="text-xs text-muted-foreground">{number(item.requests)} requests · {number(item.errors)} errors</p></div>
                  <Badge variant={item.errors ? "destructive" : "secondary"}>{money(item.cost_usd)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cost and cache guardrails</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            These are proposed configuration values. They do not enforce provider budgets until the Edge Function reads and checks them before each AI call.
          </div>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span><span className="block font-medium">Allow AI requests</span><span className="text-xs text-muted-foreground">Global switch for new AI requests</span></span>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="h-4 w-4" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Daily API budget (USD)</span><input type="number" min="0" max="1000" step="0.1" value={settings.daily_budget_usd} onChange={(e) => setSettings({ ...settings, daily_budget_usd: Math.max(0, Number(e.target.value)) })} className="w-full rounded-md border bg-background px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Monthly API budget (USD)</span><input type="number" min="0" max="10000" step="1" value={settings.monthly_budget_usd} onChange={(e) => setSettings({ ...settings, monthly_budget_usd: Math.max(0, Number(e.target.value)) })} className="w-full rounded-md border bg-background px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Cache lifetime (hours)</span><input type="number" min="1" max="720" step="1" value={settings.cache_hours} onChange={(e) => setSettings({ ...settings, cache_hours: Math.min(720, Math.max(1, Number(e.target.value))) })} className="w-full rounded-md border bg-background px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Cached response RA Points</span><input type="number" min="0" max="10" step="0.25" value={settings.cached_student_charge} onChange={(e) => setSettings({ ...settings, cached_student_charge: Math.min(10, Math.max(0, Number(e.target.value))) })} className="w-full rounded-md border bg-background px-3 py-2" /></label>
            <label className="space-y-1 text-sm sm:col-span-2"><span>Maximum AI requests per user per minute</span><input type="number" min="1" max="120" step="1" value={settings.max_requests_per_user_per_minute} onChange={(e) => setSettings({ ...settings, max_requests_per_user_per_minute: Math.min(120, Math.max(1, Number(e.target.value))) })} className="w-full rounded-md border bg-background px-3 py-2" /></label>
          </div>
          <div className="flex justify-end"><Button onClick={() => void saveSettings()} disabled={settingsLoading}>{settingsLoading ? "Saving…" : "Save settings"}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
