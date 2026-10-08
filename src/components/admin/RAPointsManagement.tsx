import { useEffect, useState } from "react";
import { CalendarClock, Coins, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function RAPointsManagement() {
  const { toast } = useToast();
  const [regularAllowance, setRegularAllowance] = useState("100");
  const [onlineAllowance, setOnlineAllowance] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_ra_points_allowances");
    const row = Array.isArray(data) ? data[0] : data;

    if (error || !row) {
      toast({
        title: "Could not load RA Credit settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } else {
      setRegularAllowance(String(Number(row.regular_monthly_allowance)));
      setOnlineAllowance(String(Number(row.online_monthly_allowance)));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    const regular = Number(regularAllowance);
    const online = Number(onlineAllowance);

    if (!Number.isFinite(regular) || !Number.isFinite(online) || regular <= 0 || online <= 0 || regular > 1000 || online > 1000) {
      toast({
        title: "Invalid allowance",
        description: "Enter values between 1 and 1000.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("update_ra_points_allowances", {
      p_regular_monthly_allowance: regular,
      p_online_monthly_allowance: online,
    });
    const row = Array.isArray(data) ? data[0] : data;
    setSaving(false);

    if (error || !row?.ok) {
      toast({
        title: "Could not save RA Credit settings",
        description: error?.message || "You may not have Owner/Admin permission.",
        variant: "destructive",
      });
      return;
    }

    setRegularAllowance(String(Number(row.regular_monthly_allowance)));
    setOnlineAllowance(String(Number(row.online_monthly_allowance)));
    toast({
      title: "RA Credit policy updated",
      description: "The new allowance will apply from the next monthly reset.",
    });
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>RA Credits Control Centre</CardTitle>
                <CardDescription>Monthly AI allowance for students</CardDescription>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Owner / Admin
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <Label htmlFor="regular-ra" className="text-sm font-semibold">Regular Student Monthly Credits</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="regular-ra"
                type="number"
                min="1"
                max="1000"
                step="1"
                value={regularAllowance}
                disabled={loading || saving}
                onChange={(e) => setRegularAllowance(e.target.value)}
              />
              <Badge variant="outline">RA / month</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Default: 100 RA Credits.</p>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <Label htmlFor="online-ra" className="text-sm font-semibold">Online Student Monthly Credits</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="online-ra"
                type="number"
                min="1"
                max="1000"
                step="1"
                value={onlineAllowance}
                disabled={loading || saving}
                onChange={(e) => setOnlineAllowance(e.target.value)}
              />
              <Badge variant="outline">RA / month</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Default: 20 RA Credits.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 font-medium text-sm"><RotateCcw className="h-4 w-4 text-primary" /> Auto Reset</div>
            <p className="text-xs text-muted-foreground mt-1">1st of every month at 12:05 AM IST.</p>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 font-medium text-sm"><CalendarClock className="h-4 w-4 text-primary" /> No Rollover</div>
            <p className="text-xs text-muted-foreground mt-1">Unused credits expire at month-end.</p>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 font-medium text-sm"><Coins className="h-4 w-4 text-primary" /> Audit Trail</div>
            <p className="text-xs text-muted-foreground mt-1">Each reset is recorded for admin reporting.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={loading || saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Credit Policy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default RAPointsManagement;
