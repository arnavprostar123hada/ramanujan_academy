import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Plus, RefreshCw, Receipt, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type FinanceDashboardRow = {
  active_students: number;
  billed: number;
  collected: number;
  outstanding: number;
  expenses: number;
  operating_cash_surplus: number;
  collection_efficiency_pct: number;
  operating_margin_pct: number;
};

type ReceivableRow = {
  student_id: string;
  student_name: string;
  class: string;
  board: string | null;
  branch_id: string | null;
  net_fee: number;
  collected: number;
  outstanding: number;
};

type MonthlyRow = {
  report_month: string;
  collections: number;
  expenses: number;
  cash_surplus: number;
};

type StudentOption = { id: string; name: string; class: string; board: string | null; branch_id: string | null };

export function FinanceCommandCentre() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<FinanceDashboardRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFee, setSavingFee] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [feeForm, setFeeForm] = useState({
    student_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: "Cash",
    fee_type: "Tuition Fee",
    cash_bank: "Cash",
    reference_number: "",
    notes: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    vendor_payee: "",
    category: "Teaching",
    description: "",
    amount: "",
    tax_amount: "0",
    payment_mode: "Cash",
    cash_bank: "Cash",
    fixed_variable: "Fixed",
    reference_number: "",
    notes: "",
  });

  const money = useMemo(
    () => (value: number | null | undefined) =>
      `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
    []
  );

  const loadFinance = async () => {
    setLoading(true);
    const [d, m, r, s] = await Promise.all([
      supabase.from("finance_dashboard").select("*").maybeSingle(),
      supabase.from("finance_monthly_mis").select("*").order("report_month", { ascending: true }),
      supabase.from("finance_receivables").select("*").order("outstanding", { ascending: false }).limit(100),
      supabase.from("students").select("id,name,class,board,branch_id").eq("status", "active").order("name"),
    ]);
    if (d.error || m.error || r.error || s.error) {
      console.error("Finance load error", { d: d.error, m: m.error, r: r.error, s: s.error });
      toast({ title: "Finance load failed", description: "Please refresh and try again.", variant: "destructive" });
    }
    setDashboard((d.data as FinanceDashboardRow | null) ?? null);
    setMonthly((m.data as MonthlyRow[]) ?? []);
    setReceivables((r.data as ReceivableRow[]) ?? []);
    setStudents((s.data as StudentOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadFinance();
  }, []);

  const recordFee = async () => {
    if (!feeForm.student_id || !feeForm.amount || Number(feeForm.amount) <= 0) {
      toast({ title: "Complete fee details", description: "Select a student and enter a valid amount.", variant: "destructive" });
      return;
    }
    setSavingFee(true);
    const student = students.find((s) => s.id === feeForm.student_id);
    const account = await supabase.from("fee_accounts").select("id").eq("student_id", feeForm.student_id).maybeSingle();
    let accountId = account.data?.id;

    if (!accountId) {
      const created = await supabase
        .from("fee_accounts")
        .insert({
          student_id: feeForm.student_id,
          total_fee: Number(feeForm.amount),
          net_fee: Number(feeForm.amount),
          scholarship: 0,
          discount: 0,
        })
        .select("id")
        .single();
      if (created.error) {
        toast({ title: "Fee account could not be created", description: created.error.message, variant: "destructive" });
        setSavingFee(false);
        return;
      }
      accountId = created.data.id;
    }

    const receiptNumber = `RC-${Date.now().toString().slice(-8)}`;
    const { error } = await supabase.from("fee_payments").insert({
      fee_account_id: accountId,
      payment_date: feeForm.payment_date,
      amount: Number(feeForm.amount),
      payment_mode: feeForm.payment_mode,
      receipt_number: receiptNumber,
      reference_number: feeForm.reference_number || null,
      notes: feeForm.notes || (student ? `Payment for ${student.name}` : null),
      branch_id: student?.branch_id ?? null,
      fee_type: feeForm.fee_type,
      cash_bank: feeForm.cash_bank,
    });

    if (error) {
      toast({ title: "Payment not recorded", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment recorded", description: `Receipt ${receiptNumber} created.` });
      setFeeForm((f) => ({ ...f, amount: "", reference_number: "", notes: "" }));
      await loadFinance();
    }
    setSavingFee(false);
  };

  const recordExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast({ title: "Complete expense details", description: "Enter a category and valid amount.", variant: "destructive" });
      return;
    }
    setSavingExpense(true);
    const { error } = await supabase.from("finance_expenses").insert({
      expense_date: expenseForm.expense_date,
      vendor_payee: expenseForm.vendor_payee || null,
      category: expenseForm.category,
      description: expenseForm.description || null,
      amount: Number(expenseForm.amount),
      tax_amount: Number(expenseForm.tax_amount || 0),
      payment_mode: expenseForm.payment_mode,
      cash_bank: expenseForm.cash_bank,
      fixed_variable: expenseForm.fixed_variable,
      reference_number: expenseForm.reference_number || null,
      notes: expenseForm.notes || null,
    });
    if (error) {
      toast({ title: "Expense not recorded", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Expense recorded" });
      setExpenseForm((f) => ({ ...f, vendor_payee: "", description: "", amount: "", tax_amount: "0", reference_number: "", notes: "" }));
      await loadFinance();
    }
    setSavingExpense(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Finance Command Centre</h2>
          <p className="text-sm text-muted-foreground">Live financial control for Ramanujan Academy</p>
        </div>
        <Button variant="outline" onClick={() => void loadFinance()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Billed", value: money(dashboard?.billed), icon: IndianRupee },
          { label: "Collected", value: money(dashboard?.collected), icon: Receipt },
          { label: "Outstanding", value: money(dashboard?.outstanding), icon: AlertTriangle },
          { label: "Expenses", value: money(dashboard?.expenses), icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="card-elevated">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
                <Icon className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader><CardTitle>Collection Efficiency</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold">{Number(dashboard?.collection_efficiency_pct || 0).toFixed(1)}%</div><p className="text-sm text-muted-foreground mt-2">Collected ÷ billed</p></CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Operating Cash Surplus</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2 text-4xl font-bold"><TrendingUp className="h-8 w-8" />{money(dashboard?.operating_cash_surplus)}</div><p className="text-sm text-muted-foreground mt-2">Collections less recorded expenses</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="collection">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="collection">Fee Collection</TabsTrigger>
          <TabsTrigger value="expenses">Expense Entry</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="collection">
          <Card>
            <CardHeader><CardTitle>Record Fee Collection</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Student</Label><NativeSelect options={students.map(s => ({ value: s.id, label: `${s.name} — Class ${s.class}` }))} value={feeForm.student_id} onValueChange={(value) => setFeeForm(f => ({ ...f, student_id: value }))} placeholder="Select student" /></div>
              <div><Label>Amount (₹)</Label><Input type="number" min="1" value={feeForm.amount} onChange={(e) => setFeeForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Payment Date</Label><Input type="date" value={feeForm.payment_date} onChange={(e) => setFeeForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
              <div><Label>Fee Type</Label><NativeSelect options={["Tuition Fee","Admission Fee","Exam Fee","Other Fee"].map(v => ({ value:v,label:v }))} value={feeForm.fee_type} onValueChange={(value) => setFeeForm(f => ({ ...f, fee_type:value }))} /></div>
              <div><Label>Payment Mode</Label><NativeSelect options={["Cash","UPI","Bank Transfer","Card","Cheque"].map(v => ({ value:v,label:v }))} value={feeForm.payment_mode} onValueChange={(value) => setFeeForm(f => ({ ...f, payment_mode:value }))} /></div>
              <div><Label>Cash / Bank</Label><NativeSelect options={["Cash","Bank"].map(v => ({ value:v,label:v }))} value={feeForm.cash_bank} onValueChange={(value) => setFeeForm(f => ({ ...f, cash_bank:value }))} /></div>
              <div><Label>Reference No.</Label><Input value={feeForm.reference_number} onChange={(e) => setFeeForm(f => ({ ...f, reference_number:e.target.value }))} /></div>
              <div><Label>Notes</Label><Textarea value={feeForm.notes} onChange={(e) => setFeeForm(f => ({ ...f, notes:e.target.value }))} /></div>
              <div className="md:col-span-2"><Button onClick={() => void recordFee()} disabled={savingFee} className="w-full"><Plus className="mr-2 h-4 w-4" />{savingFee ? "Recording…" : "Record Payment & Create Receipt"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader><CardTitle>Record Expense</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Date</Label><Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm(f => ({ ...f, expense_date:e.target.value }))} /></div>
              <div><Label>Vendor / Payee</Label><Input value={expenseForm.vendor_payee} onChange={(e) => setExpenseForm(f => ({ ...f, vendor_payee:e.target.value }))} /></div>
              <div><Label>Category</Label><NativeSelect options={["Teaching","Admin Salary","Teacher Salary","Rent","Electricity","Marketing","Software","Office","Travel","Other"].map(v => ({ value:v,label:v }))} value={expenseForm.category} onValueChange={(value) => setExpenseForm(f => ({ ...f, category:value }))} /></div>
              <div><Label>Fixed / Variable</Label><NativeSelect options={["Fixed","Variable"].map(v => ({ value:v,label:v }))} value={expenseForm.fixed_variable} onValueChange={(value) => setExpenseForm(f => ({ ...f, fixed_variable:value }))} /></div>
              <div><Label>Amount (₹)</Label><Input type="number" min="1" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount:e.target.value }))} /></div>
              <div><Label>Tax (₹)</Label><Input type="number" min="0" value={expenseForm.tax_amount} onChange={(e) => setExpenseForm(f => ({ ...f, tax_amount:e.target.value }))} /></div>
              <div><Label>Payment Mode</Label><NativeSelect options={["Cash","UPI","Bank Transfer","Card","Cheque"].map(v => ({ value:v,label:v }))} value={expenseForm.payment_mode} onValueChange={(value) => setExpenseForm(f => ({ ...f, payment_mode:value }))} /></div>
              <div><Label>Description</Label><Input value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description:e.target.value }))} /></div>
              <div className="md:col-span-2"><Button onClick={() => void recordExpense()} disabled={savingExpense} className="w-full"><Plus className="mr-2 h-4 w-4" />{savingExpense ? "Recording…" : "Record Expense"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Outstanding Fees</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="py-2">Student</th><th>Class</th><th>Net Fee</th><th>Collected</th><th>Outstanding</th></tr></thead>
                  <tbody>
                    {receivables.map((r) => <tr key={r.student_id} className="border-b last:border-0"><td className="py-2 font-medium">{r.student_name}</td><td>{r.class}</td><td>{money(r.net_fee)}</td><td>{money(r.collected)}</td><td className="font-semibold">{money(r.outstanding)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Monthly MIS</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="py-2">Month</th><th>Collections</th><th>Expenses</th><th>Cash Surplus</th></tr></thead>
                  <tbody>{monthly.map((r) => <tr key={r.report_month} className="border-b last:border-0"><td className="py-2">{new Date(r.report_month).toLocaleDateString("en-IN", { month:"short", year:"numeric" })}</td><td>{money(r.collections)}</td><td>{money(r.expenses)}</td><td className="font-semibold">{money(r.cash_surplus)}</td></tr>)}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
