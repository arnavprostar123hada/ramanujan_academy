import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday } from "date-fns";
import { Calculator, CheckCircle2, IndianRupee, Save } from "lucide-react";

type Staff = {
  id: string; name: string; monthly_salary: number; is_active: boolean;
  expected_check_in: string | null; expected_check_out: string | null;
};
type Attendance = {
  admin_staff_id: string; attendance_date: string; status: string;
  is_late: boolean | null; worked_minutes: number | null;
};
type Payroll = {
  id: string; admin_staff_id: string; month: string; year: number;
  working_days: number; days_present: number; half_days: number; days_absent: number;
  late_count: number; base_salary: number; calculated_salary: number;
  late_deduction: number; other_deductions: number; bonus: number; final_salary: number;
  status: "draft" | "approved" | "paid";
};

export function AdminStaffPayroll() {
  const { toast } = useToast();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState<Record<string, number>>({});
  const [bonus, setBonus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const d = new Date(month + "-01T00:00:00");
    const start = format(startOfMonth(d), "yyyy-MM-dd");
    const end = format(endOfMonth(d), "yyyy-MM-dd");
    const weekdays = eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) }).filter(x => !isSunday(x)).length;
    setWorkingDays(weekdays);
    const [{ data: s }, { data: a }, { data: p }] = await Promise.all([
      supabase.from("admin_staff").select("id,name,monthly_salary,is_active,expected_check_in,expected_check_out").eq("is_active", true).order("name"),
      supabase.from("admin_attendance").select("admin_staff_id,attendance_date,status,is_late,worked_minutes").gte("attendance_date", start).lte("attendance_date", end),
      supabase.from("admin_salary_records").select("*").eq("month", format(d, "MMMM")).eq("year", d.getFullYear()),
    ]);
    setStaff((s || []) as Staff[]);
    setAttendance((a || []) as Attendance[]);
    setPayroll((p || []) as Payroll[]);
  };

  useEffect(() => { void load(); }, [month]);

  const calculate = (s: Staff) => {
    const rows = attendance.filter(a => a.admin_staff_id === s.id);
    const present = rows.filter(a => a.status === "present").length;
    const half = rows.filter(a => a.status === "half_day" || a.status === "half-day").length;
    const late = rows.filter(a => a.is_late).length;
    const payableDays = present + half * 0.5;
    const absent = Math.max(0, workingDays - present - half);
    const base = Number(s.monthly_salary || 0);
    const calculated = workingDays > 0 ? base * payableDays / workingDays : 0;
    // Existing academy rule: every 3 late marks = one half-day salary deduction.
    const lateHalfDays = Math.floor(late / 3);
    const lateDeduction = workingDays > 0 ? (base / workingDays) * 0.5 * lateHalfDays : 0;
    const other = Number(otherDeductions[s.id] || 0);
    const b = Number(bonus[s.id] || 0);
    const final = Math.max(0, calculated - lateDeduction - other + b);
    return { present, half, absent, late, payableDays, base, calculated, lateDeduction, other, bonus: b, final };
  };

  const savePayroll = async (s: Staff) => {
    const d = new Date(month + "-01T00:00:00");
    const c = calculate(s);
    setLoading(true);
    const { error } = await supabase.from("admin_salary_records").upsert({
      admin_staff_id: s.id, month: format(d, "MMMM"), year: d.getFullYear(),
      working_days: workingDays, days_present: c.present, half_days: c.half, days_absent: c.absent,
      late_count: c.late, base_salary: c.base, calculated_salary: c.calculated,
      late_deduction: c.lateDeduction, other_deductions: c.other, bonus: c.bonus,
      final_salary: c.final, status: "draft", updated_at: new Date().toISOString()
    }, { onConflict: "admin_staff_id,month,year" });
    setLoading(false);
    if (error) toast({ title: "Payroll save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Payroll saved" }); void load(); }
  };

  const markStatus = async (id: string, status: Payroll["status"]) => {
    const { error } = await supabase.from("admin_salary_records").update({
      status, paid_at: status === "paid" ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) toast({ title: "Could not update payroll", description: error.message, variant: "destructive" });
    else void load();
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Admin Staff Payroll</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Attendance-linked monthly payroll. Every 3 late marks = ½ day deduction.</p>
          </div>
          <Input type="month" className="w-44" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {staff.length === 0 ? <p className="text-sm text-muted-foreground">No active admin staff.</p> : (
          <div className="space-y-4">
            {staff.map(s => {
              const c = calculate(s);
              const saved = payroll.find(p => p.admin_staff_id === s.id);
              return (
                <div key={s.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{c.present} present · {c.half} half-day · {c.absent} absent · {c.late} late</div>
                    </div>
                    {saved && <Badge variant={saved.status === "paid" ? "default" : "secondary"}>{saved.status}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label>Monthly Salary</Label><Input type="number" min="0" value={s.monthly_salary ?? 0} onChange={async e => {
                      const value = Number(e.target.value) || 0;
                      setStaff(prev => prev.map(x => x.id === s.id ? { ...x, monthly_salary: value } : x));
                      await supabase.from("admin_staff").update({ monthly_salary: value }).eq("id", s.id);
                    }} /></div>
                    <div><Label>Other Deduction</Label><Input type="number" min="0" value={otherDeductions[s.id] ?? 0} onChange={e => setOtherDeductions(x => ({ ...x, [s.id]: Number(e.target.value) || 0 }))} /></div>
                    <div><Label>Bonus</Label><Input type="number" min="0" value={bonus[s.id] ?? 0} onChange={e => setBonus(x => ({ ...x, [s.id]: Number(e.target.value) || 0 }))} /></div>
                    <div><Label>Working Days</Label><Input type="number" min="0" value={workingDays} onChange={e => setWorkingDays(Math.max(0, Number(e.target.value) || 0))} /></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 p-2"><span className="text-muted-foreground block text-xs">Calculated</span>₹{c.calculated.toFixed(2)}</div>
                    <div className="rounded-lg bg-muted/50 p-2"><span className="text-muted-foreground block text-xs">Late deduction</span>₹{c.lateDeduction.toFixed(2)}</div>
                    <div className="rounded-lg bg-muted/50 p-2"><span className="text-muted-foreground block text-xs">Other</span>₹{c.other.toFixed(2)}</div>
                    <div className="rounded-lg bg-muted/50 p-2"><span className="text-muted-foreground block text-xs">Bonus</span>₹{c.bonus.toFixed(2)}</div>
                    <div className="rounded-lg bg-primary/10 p-2 font-bold"><span className="text-muted-foreground block text-xs">Net Pay</span>₹{c.final.toFixed(2)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void savePayroll(s)} disabled={loading}><Save className="w-4 h-4 mr-1" /> Save Payroll</Button>
                    {saved?.status === "draft" && <Button size="sm" variant="outline" onClick={() => void markStatus(saved.id, "approved")}><CheckCircle2 className="w-4 h-4 mr-1" /> Approve</Button>}
                    {saved?.status === "approved" && <Button size="sm" variant="outline" onClick={() => void markStatus(saved.id, "paid")}><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid</Button>}
                    <Button size="sm" variant="ghost" onClick={() => void savePayroll(s)}><Calculator className="w-4 h-4 mr-1" /> Recalculate</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
