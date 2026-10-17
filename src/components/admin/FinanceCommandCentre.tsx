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


type FeeStructureRow = {
  id: string;
  academic_year: string;
  class: string;
  board: string;
  course_name: string;
  fee_amount: number;
  is_active: boolean;
};
type ReceiptRow = {
  payment_id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  payment_mode: string | null;
  reference_number: string | null;
  fee_type: string | null;
  student_id: string;
  student_name: string;
  class: string;
  board: string | null;
};

type StudentOption = { id: string; name: string; class: string; board: string | null; branch_id: string | null };

export function FinanceCommandCentre() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<FinanceDashboardRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [feeRuleSaving, setFeeRuleSaving] = useState(false);
  const [concessionSaving, setConcessionSaving] = useState(false);
  const [feeRuleForm, setFeeRuleForm] = useState({ academic_year: "2026-27", class: "", board: "Any", course_name: "Tuition", fee_amount: "" });
  const [concessionForm, setConcessionForm] = useState({ student_id: "", academic_year: "2026-27", concession_type: "fixed_amount", concession_value: "", reason: "" });
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
      supabase.from("fee_structures").select("id,academic_year,class,board,course_name,fee_amount,is_active").order("academic_year", { ascending: false }).order("class"),
      supabase.from("finance_receipt_register").select("payment_id,receipt_number,payment_date,amount,payment_mode,reference_number,fee_type,student_id,student_name,class,board").order("payment_date", { ascending: false }).limit(100),
    ]);
    if (d.error || m.error || r.error || s.error) {
      console.error("Finance load error", { d: d.error, m: m.error, r: r.error, s: s.error });
      toast({ title: "Finance load failed", description: "Please refresh and try again.", variant: "destructive" });
    }
    setDashboard((d.data as FinanceDashboardRow | null) ?? null);
    setMonthly((m.data as MonthlyRow[]) ?? []);
    setReceivables((r.data as ReceivableRow[]) ?? []);
    setStudents((s.data as StudentOption[]) ?? []);
    const { data: feeRules, error: feeRulesError } = await supabase.from("fee_structures").select("id,academic_year,class,board,course_name,fee_amount,is_active").order("academic_year", { ascending: false }).order("class");
    const { data: receiptRows, error: receiptsError } = await supabase.from("finance_receipt_register").select("payment_id,receipt_number,payment_date,amount,payment_mode,reference_number,fee_type,student_id,student_name,class,board").order("payment_date", { ascending: false }).limit(100);
    if (feeRulesError) console.warn("Fee rules unavailable to this role", feeRulesError.message);
    if (receiptsError) console.warn("Receipt register unavailable to this role", receiptsError.message);
    setFeeStructures((feeRules as FeeStructureRow[]) ?? []);
    setReceipts((receiptRows as ReceiptRow[]) ?? []);
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

  const saveFeeRule = async () => {
    const feeAmount = Number(feeRuleForm.fee_amount);
    if (!feeRuleForm.class.trim() || !feeRuleForm.course_name.trim() || !feeRuleForm.academic_year.trim() || !Number.isFinite(feeAmount) || feeAmount < 0) {
      toast({ title: "Complete fee details", description: "Enter academic year, class, course and a non-negative fee.", variant: "destructive" });
      return;
    }
    setFeeRuleSaving(true);
    const { error } = await supabase.from("fee_structures").insert({
      academic_year: feeRuleForm.academic_year.trim(),
      class: feeRuleForm.class.trim(),
      board: feeRuleForm.board.trim() || "Any",
      course_name: feeRuleForm.course_name.trim(),
      fee_amount: feeAmount,
      is_active: true,
    });
    setFeeRuleSaving(false);
    if (error) {
      toast({ title: "Fee structure not saved", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Standard fee saved", description: "The fee rule is now in the fee structure list." });
    setFeeRuleForm((f) => ({ ...f, fee_amount: "" }));
    await loadFinance();
  };

  const saveConcession = async () => {
    const concessionValue = Number(concessionForm.concession_value);
    if (!concessionForm.student_id || !concessionForm.reason.trim() || !Number.isFinite(concessionValue) || concessionValue < 0 || (concessionForm.concession_type === "percentage" && concessionValue > 100)) {
      toast({ title: "Check concession details", description: "Select a student, provide a reason and enter a valid amount or percentage.", variant: "destructive" });
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast({ title: "Sign in required", description: "Please sign in before recording a concession.", variant: "destructive" });
      return;
    }
    setConcessionSaving(true);
    const { error } = await supabase.from("student_fee_concessions").insert({
      student_id: concessionForm.student_id,
      academic_year: concessionForm.academic_year.trim(),
      concession_type: concessionForm.concession_type,
      concession_value: concessionValue,
      reason: concessionForm.reason.trim(),
      approved_by: auth.user.id,
    });
    setConcessionSaving(false);
    if (error) {
      toast({ title: "Concession not saved", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Concession recorded", description: "The decision and reason are saved for the selected student." });
    setConcessionForm((f) => ({ ...f, concession_value: "", reason: "" }));
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
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="collection">Fee Collection</TabsTrigger>
          <TabsTrigger value="fees">Fee Setup</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="expenses">Expense Entry</TabsTrigger>
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


        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Standard Fee Setup</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Academic Year</Label><Input value={feeRuleForm.academic_year} onChange={(e) => setFeeRuleForm(f => ({ ...f, academic_year: e.target.value }))} placeholder="2026-27" /></div>
              <div><Label>Standard / Class</Label><Input value={feeRuleForm.class} onChange={(e) => setFeeRuleForm(f => ({ ...f, class: e.target.value }))} placeholder="10" /></div>
              <div><Label>Board</Label><NativeSelect options={["Any","CBSE","ICSE","SSC","HSC"].map(v => ({ value:v,label:v }))} value={feeRuleForm.board} onValueChange={(value) => setFeeRuleForm(f => ({ ...f, board:value }))} /></div>
              <div><Label>Course</Label><Input value={feeRuleForm.course_name} onChange={(e) => setFeeRuleForm(f => ({ ...f, course_name: e.target.value }))} placeholder="Maths + Science" /></div>
              <div><Label>Standard Fee (₹)</Label><Input type="number" min="0" value={feeRuleForm.fee_amount} onChange={(e) => setFeeRuleForm(f => ({ ...f, fee_amount:e.target.value }))} /></div>
              <div className="flex items-end"><Button onClick={() => void saveFeeRule()} disabled={feeRuleSaving} className="w-full">{feeRuleSaving ? "Saving…" : "Save Standard Fee"}</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Configured Fees</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="py-2">Year</th><th>Class</th><th>Board</th><th>Course</th><th>Fee</th><th>Status</th></tr></thead>
                  <tbody>{feeStructures.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="py-2">{r.academic_year}</td><td>{r.class}</td><td>{r.board}</td><td>{r.course_name}</td><td className="font-semibold">{money(r.fee_amount)}</td><td>{r.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody>
                </table>
                {feeStructures.length === 0 && <p className="py-4 text-sm text-muted-foreground">No fee rules visible to your account yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="concessions" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Student-Specific Concession</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Student</Label><NativeSelect options={students.map(s => ({ value: s.id, label: `${s.name} — Class ${s.class}` }))} value={concessionForm.student_id} onValueChange={(value) => setConcessionForm(f => ({ ...f, student_id:value }))} placeholder="Select student" /></div>
              <div><Label>Academic Year</Label><Input value={concessionForm.academic_year} onChange={(e) => setConcessionForm(f => ({ ...f, academic_year:e.target.value }))} /></div>
              <div><Label>Concession Type</Label><NativeSelect options={[{ value:"fixed_amount",label:"Fixed Discount (₹)" },{ value:"percentage",label:"Percentage (%)" },{ value:"scholarship",label:"Scholarship (₹)" },{ value:"custom_net_fee",label:"Custom Net Fee (₹)" }]} value={concessionForm.concession_type} onValueChange={(value) => setConcessionForm(f => ({ ...f, concession_type:value }))} /></div>
              <div><Label>{concessionForm.concession_type === "percentage" ? "Percentage (%)" : "Amount (₹)"}</Label><Input type="number" min="0" max={concessionForm.concession_type === "percentage" ? "100" : undefined} value={concessionForm.concession_value} onChange={(e) => setConcessionForm(f => ({ ...f, concession_value:e.target.value }))} /></div>
              <div className="md:col-span-2"><Label>Reason / Approval Note</Label><Textarea value={concessionForm.reason} onChange={(e) => setConcessionForm(f => ({ ...f, reason:e.target.value }))} placeholder="Sibling discount, scholarship, special approval…" /></div>
              <div className="md:col-span-2"><Button onClick={() => void saveConcession()} disabled={concessionSaving} className="w-full">{concessionSaving ? "Saving…" : "Record Concession"}</Button><p className="mt-2 text-xs text-muted-foreground">Role-based database policies restrict this action to authorised owner/admin accounts. The concession is recorded as an auditable decision; fee-account application still needs reconciliation with the student's course/admission ledger.</p></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Receipt Register</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="py-2">Receipt</th><th>Date</th><th>Student</th><th>Class</th><th>Mode</th><th>Amount</th><th>Action</th></tr></thead>
                  <tbody>{receipts.map((r) => <tr key={r.payment_id} className="border-b last:border-0"><td className="py-2 font-medium">{r.receipt_number}</td><td>{r.payment_date}</td><td>{r.student_name}</td><td>{r.class}</td><td>{r.payment_mode || "—"}</td><td className="font-semibold">{money(r.amount)}</td><td><Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button></td></tr>)}</tbody>
                </table>
                {receipts.length === 0 && <p className="py-4 text-sm text-muted-foreground">No receipts available to this account yet.</p>}
              </div>
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
