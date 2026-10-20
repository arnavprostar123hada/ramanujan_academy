import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, CalendarClock, IndianRupee, TrendingUp, Wallet, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FinanceOwnerBooks } from "@/components/admin/FinanceOwnerBooks";

type Student = { id: string; name: string; class: string; board: string | null; batch: string | null; branch_id: string | null; academic_year: string | null };
type Ledger = { student_id: string; student_name: string; class: string; board: string | null; batch: string | null; branch_id: string | null; academic_year: string | null; fee_account_id: string | null; total_fee: number; scholarship: number; discount: number; net_fee: number; paid: number; pending: number; next_instalment_due_date: string | null; next_instalment_amount: number };
type FeeStructure = { id: string; class: string; board: string; course_name: string; fee_amount: number; academic_year: string };
type Payment = { amount: number; payment_date: string; fee_account_id: string };
type Expense = { amount: number; expense_date: string; category: string; batch: string | null; total_amount: number | null; vendor_payee?: string | null; description?: string | null; payment_mode?: string | null; reference_number?: string | null };
type OtherIncome = { amount: number; income_date: string; category: string; batch: string | null; source?: string | null; description?: string | null; payment_mode?: string | null; reference_number?: string | null };
type Instalment = { id: string; fee_account_id: string; due_date: string; amount: number; paid_amount: number; status: string };
type Opening = { id: string; cash_balance: number; bank_balance: number; other_current_assets: number; fixed_assets: number; current_liabilities: number; long_term_liabilities: number; capital: number; as_of_date: string };

const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (date: string) => (date || "").slice(0, 7);
const fmt = (value: unknown) => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const monthLabel = (key: string) => key ? new Date(key + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—";

export function FinanceLedgerWorkspace({ mode = "admin" }: { mode?: "owner" | "admin" }) {
  const isOwner = mode === "owner";
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<OtherIncome[]>([]);
  const [instalments, setInstalments] = useState<Instalment[]>([]);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState(monthKey(today()));
  const [plan, setPlan] = useState({ student_id: "", fee_structure_id: "", count: "4", first_due_date: today(), interval: "1" });
  const [expenseForm, setExpenseForm] = useState({ expense_date: today(), category: "Teacher Salary", amount: "", vendor_payee: "", description: "", payment_mode: "Bank", cash_bank: "Bank", batch: "", branch_id: "", reference_number: "" });
  const [incomeForm, setIncomeForm] = useState({ income_date: today(), source: "", category: "Other Income", amount: "", description: "", payment_mode: "Bank", cash_bank: "Bank", batch: "", reference_number: "" });
  const [openingForm, setOpeningForm] = useState({ as_of_date: today(), cash_balance: "0", bank_balance: "0", other_current_assets: "0", fixed_assets: "0", current_liabilities: "0", long_term_liabilities: "0", capital: "0", notes: "Opening balances entered from verified records" });

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l, fs, p, e, i, ins, ob] = await Promise.all([
      supabase.from("students").select("id,name,class,board,batch,branch_id,academic_year").eq("status", "active").order("name"),
      (supabase as any).from("finance_student_ledger").select("*").order("student_name"),
      supabase.from("fee_structures").select("id,class,board,course_name,fee_amount,academic_year").eq("is_active", true).order("class"),
      supabase.from("fee_payments").select("id,amount,payment_date,fee_account_id").order("payment_date").order("id"),
      (supabase as any).from("finance_expenses").select("id,amount,total_amount,expense_date,category,batch,vendor_payee,description,payment_mode,reference_number").order("expense_date").order("id"),
      (supabase as any).from("finance_other_income").select("id,amount,income_date,category,batch,source,description,payment_mode,reference_number").order("income_date").order("id"),
      supabase.from("fee_installments").select("id,fee_account_id,due_date,amount,paid_amount,status").order("due_date").order("id"),
      isOwner ? supabase.from("finance_opening_balances").select("id,as_of_date,cash_balance,bank_balance,other_current_assets,fixed_assets,current_liabilities,long_term_liabilities,capital").order("as_of_date", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({data:null,error:null}),
    ]);
    const loadAllPages = async (table: string, columns: string, dateColumn: string, initial: any) => {
      const rows: any[] = [...((initial.data as any[]) || [])];
      if (!initial.error && rows.length === 1000) {
        let offset = 1000;
        while (true) {
          const page = await (supabase as any).from(table).select(columns).order(dateColumn, { ascending: true }).order("id", { ascending: true }).range(offset, offset + 999);
          if (page.error) { console.error("Finance pagination error", table, page.error); break; }
          rows.push(...(page.data || []));
          if (!page.data || page.data.length < 1000) break;
          offset += 1000;
        }
      }
      return rows;
    };
    const [allPayments, allExpenses, allIncome, allInstalments] = await Promise.all([
      loadAllPages("fee_payments", "id,amount,payment_date,fee_account_id", "payment_date", p),
      loadAllPages("finance_expenses", "id,amount,total_amount,expense_date,category,batch,vendor_payee,description,payment_mode,reference_number", "expense_date", e),
      loadAllPages("finance_other_income", "id,amount,income_date,category,batch,source,description,payment_mode,reference_number", "income_date", i),
      loadAllPages("fee_installments", "id,fee_account_id,due_date,amount,paid_amount,status", "due_date", ins),
    ]);
    const errs = [s.error,l.error,fs.error,p.error,ins.error,...(isOwner ? [e.error,i.error,ob.error] : [])].filter(Boolean);
    if (errs.length) {
      console.error("Finance workspace load errors", errs);
      toast({ title: "Some finance data could not load", description: "Check the finance permissions and refresh.", variant: "destructive" });
    }
    setStudents((s.data as Student[]) || []);
    setLedger((l.data as Ledger[]) || []);
    setStructures((fs.data as FeeStructure[]) || []);
    setPayments((allPayments as Payment[]) || []);
    setExpenses((allExpenses as Expense[]) || []);
    setIncome((allIncome as OtherIncome[]) || []);
    setInstalments((allInstalments as Instalment[]) || []);
    if (ob.data) {
      const row = ob.data as Opening;
      setOpening(row);
      setOpeningForm(f => ({ ...f, as_of_date: row.as_of_date, cash_balance: String(row.cash_balance), bank_balance: String(row.bank_balance), other_current_assets: String(row.other_current_assets), fixed_assets: String(row.fixed_assets), current_liabilities: String(row.current_liabilities), long_term_liabilities: String(row.long_term_liabilities), capital: String(row.capital) }));
    }
    setLoading(false);
  }, [toast, isOwner]);

  useEffect(() => { void load(); }, [load]);

  const batches = useMemo(() => ["All", ...Array.from(new Set([...students.map(s => s.batch), ...expenses.map(e => e.batch), ...income.map(i => i.batch)].filter((v): v is string => !!v))).sort()], [students, expenses, income]);
  const ledgerFiltered = ledger.filter(r => {
    const text = [r.student_name,r.student_id,r.class,r.board,r.batch].join(" ").toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (batchFilter === "All" || r.batch === batchFilter);
  });
  const accountStudent = useMemo(() => new Map(ledger.filter(r => r.fee_account_id).map(r => [r.fee_account_id as string, r])), [ledger]);
  const selectedStudent = students.find(s => s.id === plan.student_id);
  const matchingStructures = structures.filter(fs => selectedStudent && fs.class === selectedStudent.class && (fs.board === "Any" || fs.board === selectedStudent.board) && fs.academic_year === (selectedStudent.academic_year || "2026-27"));

  const months = useMemo(() => {
    const keys = new Set<string>();
    payments.forEach(p => keys.add(monthKey(p.payment_date)));
    expenses.forEach(e => keys.add(monthKey(e.expense_date)));
    income.forEach(i => keys.add(monthKey(i.income_date)));
    instalments.filter(i => i.paid_amount < i.amount).forEach(i => keys.add(monthKey(i.due_date)));
    return [...keys].filter(Boolean).sort();
  }, [payments, expenses, income, instalments]);

  const filteredPayments = payments.filter(p => monthKey(p.payment_date) === monthFilter && (batchFilter === "All" || accountStudent.get(p.fee_account_id)?.batch === batchFilter));
  const filteredExpenses = expenses.filter(e => monthKey(e.expense_date) === monthFilter && (batchFilter === "All" || e.batch === batchFilter));
  const filteredIncome = income.filter(i => monthKey(i.income_date) === monthFilter && (batchFilter === "All" || i.batch === batchFilter));
  const collections = filteredPayments.reduce((a,p) => a + Number(p.amount), 0);
  const otherIncome = filteredIncome.reduce((a,i) => a + Number(i.amount), 0);
  const expenseTotal = filteredExpenses.reduce((a,e) => a + Number(e.total_amount ?? e.amount), 0);
  const netOperating = collections + otherIncome - expenseTotal;

  const monthlyRows = months.map(m => {
    const c = payments.filter(p => monthKey(p.payment_date) === m && (batchFilter === "All" || accountStudent.get(p.fee_account_id)?.batch === batchFilter)).reduce((a,p) => a + Number(p.amount), 0);
    const ei = income.filter(i => monthKey(i.income_date) === m && (batchFilter === "All" || i.batch === batchFilter)).reduce((a,p) => a + Number(p.amount), 0);
    const ex = expenses.filter(e => monthKey(e.expense_date) === m && (batchFilter === "All" || e.batch === batchFilter)).reduce((a,e) => a + Number(e.total_amount ?? e.amount), 0);
    const expected = instalments.filter(i => monthKey(i.due_date) === m && (batchFilter === "All" || accountStudent.get(i.fee_account_id)?.batch === batchFilter)).reduce((a,i) => a + Math.max(0, Number(i.amount) - Number(i.paid_amount)), 0);
    return { month: m, collections: c, otherIncome: ei, expenses: ex, net: c + ei - ex, expected };
  });
  const batchRows = batches.filter(b => b !== "All").map(batch => {
    const c = payments.filter(p => accountStudent.get(p.fee_account_id)?.batch === batch).reduce((a,p) => a + Number(p.amount), 0);
    const ex = expenses.filter(e => e.batch === batch).reduce((a,e) => a + Number(e.total_amount ?? e.amount), 0);
    const oi = income.filter(i => i.batch === batch).reduce((a,i) => a + Number(i.amount), 0);
    const expected = instalments.filter(i => i.paid_amount < i.amount && accountStudent.get(i.fee_account_id)?.batch === batch).reduce((a,i) => a + Number(i.amount) - Number(i.paid_amount), 0);
    return { batch, collections: c, expenses: ex, income: oi, net: c + oi - ex, expected };
  });
  const totalPending = ledger.reduce((a,r) => a + Number(r.pending || 0), 0);
  const totalPaid = ledger.reduce((a,r) => a + Number(r.paid || 0), 0);
  const totalBilled = ledger.reduce((a,r) => a + Number(r.net_fee || 0), 0);
  const openingDate = opening?.as_of_date || "";
  const feeCollectionsSinceOpening = payments.filter(p => !openingDate || p.payment_date > openingDate).reduce((a,p) => a + Number(p.amount), 0);
  const otherIncomeSinceOpening = income.filter(i => !openingDate || i.income_date > openingDate).reduce((a,i) => a + Number(i.amount), 0);
  const expensesSinceOpening = expenses.filter(e => !openingDate || e.expense_date > openingDate).reduce((a,e) => a + Number(e.total_amount ?? e.amount), 0);
  const allIncome = feeCollectionsSinceOpening + otherIncomeSinceOpening;
  const allExpenses = expensesSinceOpening;
  const openingCash = Number(opening?.cash_balance || 0) + Number(opening?.bank_balance || 0);
  const cashAtDate = openingCash + allIncome - allExpenses;
  const assets = cashAtDate + totalPending + Number(opening?.other_current_assets || 0) + Number(opening?.fixed_assets || 0);
  const liabilities = Number(opening?.current_liabilities || 0) + Number(opening?.long_term_liabilities || 0);
  const equity = Number(opening?.capital || 0) + allIncome - allExpenses;
  const moneyInput = (value: string) => Number(value || 0);

  const createSchedule = async () => {
    if (!plan.student_id || !plan.count || !plan.first_due_date) {
      toast({ title: "Complete the instalment plan", description: "Choose a student, number of instalments and first due date.", variant: "destructive" }); return;
    }
    setSaving(true);
    const selectedLedgerRow = ledger.find(r => r.student_id === plan.student_id);
    let accountId = selectedLedgerRow?.fee_account_id || null;
    if (!accountId || Number(selectedLedgerRow?.net_fee || 0) <= 0) {
      if (!plan.fee_structure_id) {
        toast({ title: "Fee structure required", description: "Select the correct course fee structure to create this student's fee account.", variant: "destructive" }); setSaving(false); return;
      }
      const applied = await supabase.rpc("apply_student_fee_structure", { p_student_id: plan.student_id, p_fee_structure_id: plan.fee_structure_id, p_reason: "Fee instalment plan created from Finance workspace" });
      if (applied.error) { toast({ title: "Fee setup failed", description: applied.error.message, variant: "destructive" }); setSaving(false); return; }
      const refreshed = await supabase.from("fee_accounts").select("id").eq("student_id", plan.student_id).maybeSingle();
      accountId = refreshed.data?.id || null;
    }
    if (!accountId) { toast({ title: "Fee account missing", description: "Refresh and try again.", variant: "destructive" }); setSaving(false); return; }
    const result = await (supabase as any).rpc("create_fee_installment_schedule", { p_fee_account_id: accountId, p_installment_count: Number(plan.count), p_first_due_date: plan.first_due_date, p_interval_months: Number(plan.interval) });
    if (result.error) toast({ title: "Schedule not created", description: result.error.message, variant: "destructive" });
    else { toast({ title: "Instalment plan created", description: `${plan.count} instalments scheduled.` }); setPlan(f => ({ ...f, fee_structure_id: "" })); await load(); }
    setSaving(false);
  };

  const saveExpense = async () => {
    if (!expenseForm.category || Number(expenseForm.amount) <= 0) { toast({ title: "Enter a valid expense amount", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("finance_expenses").insert({ ...expenseForm, amount: Number(expenseForm.amount), total_amount: Number(expenseForm.amount), tax_amount: 0, vendor_payee: expenseForm.vendor_payee || null, description: expenseForm.description || null, batch: expenseForm.batch || null, branch_id: expenseForm.branch_id || null, reference_number: expenseForm.reference_number || null } as any);
    if (error) toast({ title: "Expense not saved", description: error.message, variant: "destructive" });
    else { toast({ title: "Expense recorded" }); setExpenseForm(f => ({ ...f, amount: "", vendor_payee: "", description: "", reference_number: "" })); await load(); }
    setSaving(false);
  };

  const saveIncome = async () => {
    if (!incomeForm.source.trim() || Number(incomeForm.amount) <= 0) { toast({ title: "Enter income source and amount", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("finance_other_income").insert({ ...incomeForm, amount: Number(incomeForm.amount), description: incomeForm.description || null, batch: incomeForm.batch || null, reference_number: incomeForm.reference_number || null });
    if (error) toast({ title: "Income not saved", description: error.message, variant: "destructive" });
    else { toast({ title: "Other income recorded" }); setIncomeForm(f => ({ ...f, source: "", amount: "", description: "", reference_number: "" })); await load(); }
    setSaving(false);
  };

  const saveOpening = async () => {
    setSaving(true);
    const values = { as_of_date: openingForm.as_of_date, cash_balance: moneyInput(openingForm.cash_balance), bank_balance: moneyInput(openingForm.bank_balance), other_current_assets: moneyInput(openingForm.other_current_assets), fixed_assets: moneyInput(openingForm.fixed_assets), current_liabilities: moneyInput(openingForm.current_liabilities), long_term_liabilities: moneyInput(openingForm.long_term_liabilities), capital: moneyInput(openingForm.capital), notes: openingForm.notes };
    const result = opening ? await supabase.from("finance_opening_balances").update(values).eq("id", opening.id) : await supabase.from("finance_opening_balances").insert(values);
    if (result.error) toast({ title: "Opening balances not saved", description: result.error.message, variant: "destructive" });
    else { toast({ title: "Opening balances saved" }); await load(); }
    setSaving(false);
  };

  const field = (label: string, value: string, onChange: (v: string) => void, type = "text") => <div className="space-y-1"><Label>{label}</Label><Input type={type} value={value} onChange={e => onChange(e.target.value)} /></div>;
  const selectField = (label: string, value: string, onChange: (v: string) => void, options: {value:string;label:string}[], placeholder?: string) => <div className="space-y-1"><Label>{label}</Label><NativeSelect value={value} onValueChange={onChange} options={options} placeholder={placeholder} /></div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">Finance Ledger & Statements</h3><p className="text-sm text-muted-foreground">Student instalments, income, expenses, collections forecasts and management statements.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh all finance data</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[[ "Student fees billed", fmt(totalBilled), IndianRupee ],["Fees collected",fmt(totalPaid),TrendingUp],["Fees pending",fmt(totalPending),CalendarClock],["Cash net movement",fmt(allIncome-allExpenses),Wallet]].map(([label,value,Icon]: any) => <Card key={label}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-5 w-5 text-primary" /></div><p className="mt-2 text-2xl font-bold">{value}</p></CardContent></Card>)}
    </div>
    {ledger.some(r => !r.fee_account_id || Number(r.net_fee || 0) <= 0) && <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><b>Fee setup required:</b> {ledger.filter(r => r.fee_account_id && Number(r.net_fee || 0) > 0).length} of {ledger.length} active students have a positive fee account. Select the correct class, board and course fee structure in Instalment Plans for students marked “Fee not set” before relying on pending-fee or forecast totals.</div>}
    <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1"><Label>Batch filter</Label><NativeSelect value={batchFilter} onValueChange={setBatchFilter} options={batches.map(b => ({value:b,label:b === "All" ? "All batches" : b}))} /></div><div className="space-y-1"><Label>Month for monthly statements</Label><NativeSelect value={monthFilter} onValueChange={setMonthFilter} options={[...new Set([monthKey(today()),...months])].sort().map(m => ({value:m,label:monthLabel(m)}))} /></div></div>
    <Tabs defaultValue="students">
      <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="students">Student Ledger</TabsTrigger><TabsTrigger value="instalments">Instalment Plans</TabsTrigger><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="income">Other Income</TabsTrigger><TabsTrigger value="reports">Reports</TabsTrigger><TabsTrigger value="balance">Balance Sheet</TabsTrigger></TabsList>
      <TabsContent value="students" className="space-y-3"><Card><CardHeader><CardTitle>Every student's fee position</CardTitle><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search student, class, board or batch" value={search} onChange={e=>setSearch(e.target.value)} /></div></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Student</th><th className="p-2">Batch</th><th className="p-2">Net fee</th><th className="p-2">Paid</th><th className="p-2">Pending</th><th className="p-2">Next due</th><th className="p-2">Due amount</th></tr></thead><tbody>{ledgerFiltered.map(r=><tr key={r.student_id} className="border-b"><td className="p-2 font-medium">{r.student_name}<div className="text-xs text-muted-foreground">Class {r.class} {r.board || ""}</div></td><td className="p-2">{r.batch || "Unassigned"}</td><td className="p-2">{r.fee_account_id ? fmt(r.net_fee) : "Fee not set"}</td><td className="p-2">{r.fee_account_id ? fmt(r.paid) : "—"}</td><td className="p-2 font-semibold">{r.fee_account_id ? fmt(r.pending) : "—"}</td><td className="p-2 whitespace-nowrap">{r.next_instalment_due_date || "Not scheduled"}</td><td className="p-2">{r.next_instalment_due_date ? fmt(r.next_instalment_amount) : "—"}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">Students without a fee account show ₹0 until the correct fee structure is applied. Do not treat an unset fee as a zero-fee admission.</p></CardContent></Card></TabsContent>
      <TabsContent value="instalments" className="space-y-3"><Card><CardHeader><CardTitle>Create a student's instalment plan</CardTitle><p className="text-sm text-muted-foreground">Equal monthly/quarterly instalments are created from the student's net fee. The final instalment adjusts for rounding.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {selectField("Student",plan.student_id,v=>setPlan(f=>({...f,student_id:v,fee_structure_id:""})),students.map(s=>({value:s.id,label:`${s.name} — Class ${s.class} — ${s.batch || "No batch"}`} )),"Select student")}
        {(!ledger.find(r=>r.student_id===plan.student_id)?.fee_account_id || Number(ledger.find(r=>r.student_id===plan.student_id)?.net_fee || 0) <= 0) && selectField("Course fee structure",plan.fee_structure_id,v=>setPlan(f=>({...f,fee_structure_id:v})),matchingStructures.map(f=>({value:f.id,label:`${f.course_name} — ${fmt(f.fee_amount)}`})),"Select fee structure")}
        {selectField("Number of instalments",plan.count,v=>setPlan(f=>({...f,count:v})),[2,3,4,5,6,8,10,12].map(n=>({value:String(n),label:String(n)})))}
        {field("First instalment due date",plan.first_due_date,v=>setPlan(f=>({...f,first_due_date:v})),"date")}
        {selectField("Interval",plan.interval,v=>setPlan(f=>({...f,interval:v})),[{value:"1",label:"Every month"},{value:"2",label:"Every 2 months"},{value:"3",label:"Every 3 months"}])}
        <div className="flex items-end"><Button className="w-full" onClick={()=>void createSchedule()} disabled={saving}><CalendarClock className="mr-2 h-4 w-4"/>{saving?"Saving…":"Create instalment schedule"}</Button></div>
      </CardContent></Card><Card><CardHeader><CardTitle>Upcoming and overdue instalments</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Due date</th><th className="p-2">Student</th><th className="p-2">Batch</th><th className="p-2">Instalment</th><th className="p-2">Paid</th><th className="p-2">Pending</th><th className="p-2">Status</th></tr></thead><tbody>{instalments.filter(i=>i.paid_amount<i.amount).sort((a,b)=>a.due_date.localeCompare(b.due_date)).map(i=>{const s=accountStudent.get(i.fee_account_id);return <tr key={i.id} className="border-b"><td className="p-2 whitespace-nowrap">{i.due_date}</td><td className="p-2">{s?.student_name || "Student"}</td><td className="p-2">{s?.batch || "—"}</td><td className="p-2">{fmt(i.amount)}</td><td className="p-2">{fmt(i.paid_amount)}</td><td className="p-2 font-semibold">{fmt(Number(i.amount)-Number(i.paid_amount))}</td><td className="p-2">{i.due_date<today()?"Overdue":i.status==="partial"?"Part paid":"Due"}</td></tr>})}</tbody></table></div></CardContent></Card></TabsContent>
      <TabsContent value="expenses"><Card><CardHeader><CardTitle>Record every expense</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {field("Expense date",expenseForm.expense_date,v=>setExpenseForm(f=>({...f,expense_date:v})),"date")}
        {selectField("Category",expenseForm.category,v=>setExpenseForm(f=>({...f,category:v})),["Teacher Salary","Admin Salary","Rent","Electricity","Internet & Phone","Stationery","Tea / Coffee","Event Expenses","Marketing","Software","Teaching Material","Travel","Repairs & Maintenance","Bank Charges","Taxes","Other Operating Expense"].map(v=>({value:v,label:v})))}
        {field("Amount (₹)",expenseForm.amount,v=>setExpenseForm(f=>({...f,amount:v})),"number")}
        {field("Vendor / Payee",expenseForm.vendor_payee,v=>setExpenseForm(f=>({...f,vendor_payee:v})))}
        {field("Description",expenseForm.description,v=>setExpenseForm(f=>({...f,description:v})))}
        {field("Batch (optional)",expenseForm.batch,v=>setExpenseForm(f=>({...f,batch:v})))}
        {selectField("Payment mode",expenseForm.payment_mode,v=>setExpenseForm(f=>({...f,payment_mode:v})),["Cash","UPI","Bank Transfer","Card","Cheque"].map(v=>({value:v,label:v})))}
        {selectField("Cash / Bank",expenseForm.cash_bank,v=>setExpenseForm(f=>({...f,cash_bank:v})),["Cash","Bank"].map(v=>({value:v,label:v})))}
        {field("Reference number",expenseForm.reference_number,v=>setExpenseForm(f=>({...f,reference_number:v})))}
        <div className="flex items-end"><Button className="w-full" onClick={()=>void saveExpense()} disabled={saving}><Plus className="mr-2 h-4 w-4"/>Record expense</Button></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Expense history</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Payee / description</th><th className="p-2">Batch</th><th className="p-2">Mode</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{[...expenses].sort((a,b)=>b.expense_date.localeCompare(a.expense_date)).map((e,idx)=><tr key={e.expense_date+"-"+idx} className="border-b"><td className="p-2 whitespace-nowrap">{e.expense_date}</td><td className="p-2">{e.category}</td><td className="p-2">{e.vendor_payee || e.description || "—"}{e.vendor_payee && e.description ? <div className="text-xs text-muted-foreground">{e.description}</div> : null}</td><td className="p-2">{e.batch || "Academy-wide"}</td><td className="p-2">{e.payment_mode || "—"}</td><td className="p-2 text-right">{fmt(e.total_amount ?? e.amount)}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>
      <TabsContent value="income"><Card><CardHeader><CardTitle>Record other income</CardTitle><p className="text-sm text-muted-foreground">For admission fees outside the fee ledger, interest, event income, material sales, sponsorships and other receipts.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {field("Income date",incomeForm.income_date,v=>setIncomeForm(f=>({...f,income_date:v})),"date")}
        {field("Received from / source",incomeForm.source,v=>setIncomeForm(f=>({...f,source:v})))}
        {selectField("Category",incomeForm.category,v=>setIncomeForm(f=>({...f,category:v})),["Other Income","Event Income","Study Material Sales","Interest Income","Sponsorship","Admission / Registration","Miscellaneous"].map(v=>({value:v,label:v})))}
        {field("Amount (₹)",incomeForm.amount,v=>setIncomeForm(f=>({...f,amount:v})),"number")}
        {field("Description",incomeForm.description,v=>setIncomeForm(f=>({...f,description:v})))}
        {field("Batch (optional)",incomeForm.batch,v=>setIncomeForm(f=>({...f,batch:v})))}
        {selectField("Payment mode",incomeForm.payment_mode,v=>setIncomeForm(f=>({...f,payment_mode:v})),["Cash","UPI","Bank Transfer","Card","Cheque"].map(v=>({value:v,label:v})))}
        {selectField("Cash / Bank",incomeForm.cash_bank,v=>setIncomeForm(f=>({...f,cash_bank:v})),["Cash","Bank"].map(v=>({value:v,label:v})))}
        {field("Reference number",incomeForm.reference_number,v=>setIncomeForm(f=>({...f,reference_number:v})))}
        <div className="flex items-end"><Button className="w-full" onClick={()=>void saveIncome()} disabled={saving}><Plus className="mr-2 h-4 w-4"/>Record other income</Button></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Other income history</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Source</th><th className="p-2">Category</th><th className="p-2">Batch</th><th className="p-2">Mode</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{[...income].sort((a,b)=>b.income_date.localeCompare(a.income_date)).map((i,idx)=><tr key={i.income_date+"-"+idx} className="border-b"><td className="p-2 whitespace-nowrap">{i.income_date}</td><td className="p-2">{i.source || i.description || "—"}</td><td className="p-2">{i.category}</td><td className="p-2">{i.batch || "Academy-wide"}</td><td className="p-2">{i.payment_mode || "—"}</td><td className="p-2 text-right">{fmt(i.amount)}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>
      <TabsContent value="reports" className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collections in {monthLabel(monthFilter)}</p><p className="text-xl font-bold">{fmt(collections)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Other income</p><p className="text-xl font-bold">{fmt(otherIncome)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Expenses in {monthLabel(monthFilter)}</p><p className="text-xl font-bold">{fmt(expenseTotal)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net cash result</p><p className="text-xl font-bold">{fmt(netOperating)}</p></CardContent></Card></div>
        <Card><CardHeader><CardTitle>Month-wise collections, expected fees and expenses</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Month</th><th className="p-2">Collected</th><th className="p-2">Other income</th><th className="p-2">Expenses</th><th className="p-2">Net cash</th><th className="p-2">Fees expected</th></tr></thead><tbody>{monthlyRows.map(r=><tr key={r.month} className="border-b"><td className="p-2">{monthLabel(r.month)}</td><td className="p-2">{fmt(r.collections)}</td><td className="p-2">{fmt(r.otherIncome)}</td><td className="p-2">{fmt(r.expenses)}</td><td className="p-2 font-semibold">{fmt(r.net)}</td><td className="p-2">{fmt(r.expected)}</td></tr>)}</tbody></table></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Batch-wise financial performance</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Batch</th><th className="p-2">Collections</th><th className="p-2">Other income</th><th className="p-2">Expenses tagged to batch</th><th className="p-2">Net recorded cash</th><th className="p-2">Fees pending</th></tr></thead><tbody>{batchRows.map(r=><tr key={r.batch} className="border-b"><td className="p-2">{r.batch}</td><td className="p-2">{fmt(r.collections)}</td><td className="p-2">{fmt(r.income)}</td><td className="p-2">{fmt(r.expenses)}</td><td className="p-2 font-semibold">{fmt(r.net)}</td><td className="p-2">{fmt(r.expected)}</td></tr>)}</tbody></table></div><p className="mt-2 text-xs text-muted-foreground">Only expenses assigned to a batch appear in that batch's cost. Unassigned overheads remain academy-wide.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Profit & loss (cash-basis management view)</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Fee collections received</span><b>{fmt(feeCollectionsSinceOpening)}</b></div><div className="flex justify-between"><span>Other income received</span><b>{fmt(otherIncomeSinceOpening)}</b></div><div className="flex justify-between"><span>Recorded expenses</span><b>{fmt(allExpenses)}</b></div><div className="flex justify-between border-t pt-2 text-base"><span>Net recorded operating result</span><b>{fmt(allIncome-allExpenses)}</b></div><p className="text-xs text-muted-foreground">This is cash-basis management reporting, not audited accrual accounting. For statutory profit and loss, record accruals, unpaid bills, depreciation and taxes as applicable.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Cash flow statement (recorded cash basis)</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Opening cash + bank balance</span><b>{fmt(openingCash)}</b></div><div className="flex justify-between"><span>Cash inflows (fees + other income)</span><b>{fmt(allIncome)}</b></div><div className="flex justify-between"><span>Cash outflows (expenses)</span><b>{fmt(allExpenses)}</b></div><div className="flex justify-between border-t pt-2 text-base"><span>Estimated closing cash + bank</span><b>{fmt(cashAtDate)}</b></div><p className="text-xs text-muted-foreground">Assumes every recorded payment and expense affected cash/bank. Use the Cash/Bank field and reconcile against bank statements before relying on closing balances.</p></CardContent></Card>
      </TabsContent>
      <TabsContent value="balance" className="space-y-3"><Card><CardHeader><CardTitle>Opening balances</CardTitle><p className="text-sm text-muted-foreground">Enter verified balances as of a date. Existing values update the current opening record; do not enter estimated figures as verified amounts.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {field("As-of date",openingForm.as_of_date,v=>setOpeningForm(f=>({...f,as_of_date:v})),"date")}
        {field("Opening cash (₹)",openingForm.cash_balance,v=>setOpeningForm(f=>({...f,cash_balance:v})),"number")}
        {field("Opening bank (₹)",openingForm.bank_balance,v=>setOpeningForm(f=>({...f,bank_balance:v})),"number")}
        {field("Other current assets (₹)",openingForm.other_current_assets,v=>setOpeningForm(f=>({...f,other_current_assets:v})),"number")}
        {field("Fixed assets (₹)",openingForm.fixed_assets,v=>setOpeningForm(f=>({...f,fixed_assets:v})),"number")}
        {field("Current liabilities (₹)",openingForm.current_liabilities,v=>setOpeningForm(f=>({...f,current_liabilities:v})),"number")}
        {field("Long-term liabilities / loans (₹)",openingForm.long_term_liabilities,v=>setOpeningForm(f=>({...f,long_term_liabilities:v})),"number")}
        {field("Owner capital (₹)",openingForm.capital,v=>setOpeningForm(f=>({...f,capital:v})),"number")}
        <div className="flex items-end"><Button className="w-full" onClick={()=>void saveOpening()} disabled={saving}><Plus className="mr-2 h-4 w-4"/>Save opening balances</Button></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Balance sheet (provisional management view)</CardTitle></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><div className="space-y-2"><h4 className="font-semibold">Assets</h4><div className="flex justify-between text-sm"><span>Cash + bank (estimated)</span><b>{fmt(cashAtDate)}</b></div><div className="flex justify-between text-sm"><span>Student fees receivable</span><b>{fmt(totalPending)}</b></div><div className="flex justify-between text-sm"><span>Other current assets (opening)</span><b>{fmt(opening?.other_current_assets)}</b></div><div className="flex justify-between text-sm"><span>Fixed assets (opening)</span><b>{fmt(opening?.fixed_assets)}</b></div><div className="flex justify-between border-t pt-2"><span>Total assets</span><b>{fmt(assets)}</b></div></div><div className="space-y-2"><h4 className="font-semibold">Liabilities & equity</h4><div className="flex justify-between text-sm"><span>Current liabilities (opening)</span><b>{fmt(opening?.current_liabilities)}</b></div><div className="flex justify-between text-sm"><span>Long-term liabilities (opening)</span><b>{fmt(opening?.long_term_liabilities)}</b></div><div className="flex justify-between text-sm"><span>Capital + recorded net result</span><b>{fmt(equity)}</b></div><div className="flex justify-between border-t pt-2"><span>Total liabilities & equity</span><b>{fmt(liabilities+equity)}</b></div><div className="rounded-md border p-3 text-sm"><b>Difference to reconcile: {fmt(assets-liabilities-equity)}</b><p className="mt-1 text-xs text-muted-foreground">A non-zero difference means opening balances, unpaid expenses, loans, assets, owner withdrawals or other transactions are missing. This is not an audited balance sheet.</p></div></div></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}
