import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Plus, RefreshCw, Receipt, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FinanceLedgerWorkspace } from "@/components/admin/FinanceLedgerWorkspace";

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

type StudentOption = { id: string; name: string; class: string; board: string | null; branch_id: string | null; parent_name?: string | null; academic_year?: string | null };
type FinanceReceiptRow = {
  payment_id: string; receipt_number: string; payment_date: string; amount: number;
  payment_mode: string | null; reference_number: string | null; fee_type: string | null;
  cash_bank: string | null; student_id: string; student_name: string; class: string;
  board: string | null; academic_year: string | null; next_installment_due_date?: string | null;
};
type FeeStructureOption = {
  id: string; class: string; board: string; course_name: string;
  fee_amount: number; academic_year: string;
};

function escapeReceiptHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] || c);
}

function receiptAmountInWords(value: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const group = (n: number): string => {
    const parts: string[] = [];
    if (n >= 100) { parts.push(ones[Math.floor(n / 100)] + " Hundred"); n %= 100; }
    if (n >= 20) { parts.push(tens[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) parts.push(ones[n]);
    return parts.join(" ");
  };
  let n = Math.round(Math.abs(value));
  if (!n) return "Zero Rupees";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(group(crore) + " Crore");
  if (lakh) parts.push(group(lakh) + " Lakh");
  if (thousand) parts.push(group(thousand) + " Thousand");
  if (n) parts.push(group(n));
  return parts.join(" ");
}

function renderFeeReceipt(
  printWindow: Window | null,
  data: { receiptNumber: string; date: string; studentId: string; studentName: string; studentClass: string; board?: string | null; parentName?: string | null; academicYear?: string | null; amount: number; feeType: string; paymentMode: string; referenceNumber?: string; cashBank?: string; nextInstallmentDueDate?: string | null }
) {
  if (!printWindow || printWindow.closed) {
    window.alert("Payment was saved, but the receipt window was blocked. Allow pop-ups and try printing the receipt again.");
    return;
  }
  const amount = Number(data.amount || 0);
  const money = (n: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const date = data.date ? new Date(data.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const feeLine = (index: number, label: string, value: number) =>
    "<tr><td>" + index + ".</td><td>" + escapeReceiptHtml(label) + "</td><td class=\"amt\">" + (value ? "₹ " + money(value) : "—") + "</td></tr>";
  const mode = data.paymentMode.toLowerCase();
  const modes = [
    ["Cash", /cash/.test(mode)], ["Cheque", /cheque|check/.test(mode)],
    ["UPI / Net Banking", /upi|bank|online|neft|imps|transfer/.test(mode)], ["Card", /card/.test(mode)],
  ].map(([label, checked]) => '<span>' + (checked ? "☑" : "☐") + " " + label + "</span>").join("");
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Fee Receipt ' + escapeReceiptHtml(data.receiptNumber) + '</title><style>' +
    '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;margin:0;background:white}.receipt{max-width:780px;margin:auto;padding:10px}' +
    '.brand{text-align:center;border-bottom:3px double #111;padding-bottom:12px;margin-bottom:14px}.brand img{width:72px;height:72px;object-fit:contain;display:block;margin:0 auto 7px}.brand h1{font-size:24px;margin:0 0 5px}.brand p{font-size:11px;margin:3px 0}.brand .sub{font-size:10px;font-weight:bold;letter-spacing:1px;margin-top:7px}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 24px;margin:12px 0}.field{display:flex;gap:8px;align-items:baseline;border-bottom:1px dotted #777;min-height:25px;padding:5px 0}.field b{font-size:10px;white-space:nowrap;text-transform:uppercase}.field span{font-weight:600;overflow-wrap:anywhere}.full{grid-column:1/-1}' +
    'table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #333;padding:8px}th{text-align:left;background:#f2f2f2;font-size:11px}td:first-child{width:45px;text-align:center}th:last-child,td:last-child{text-align:right;width:150px}.amt{white-space:nowrap}' +
    '.totals{width:290px;margin:10px 0 12px auto}.total{display:flex;justify-content:space-between;padding:4px 0}.grand{font-size:16px;font-weight:bold;border-top:1px solid #111;border-bottom:3px double #111;padding:8px 0}.words{border:1px solid #555;padding:9px;margin:12px 0}.words b{display:block;font-size:10px;margin-bottom:5px}.payment{margin-top:14px}.modes{display:flex;flex-wrap:wrap;gap:16px;margin:8px 0}.bank{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:54px}.sign{border-top:1px solid #222;text-align:center;padding-top:7px;font-size:11px}.foot{text-align:center;font-size:9px;color:#555;margin-top:18px}.actions{text-align:center;margin:18px}.actions button{padding:10px 18px;cursor:pointer}@media print{.actions{display:none}.receipt{max-width:none;padding:0}}@media(max-width:560px){.meta,.bank{grid-template-columns:1fr}.full{grid-column:auto}.totals{width:100%}}' +
    '</style></head><body><main class="receipt"><header class="brand"><img src="' + escapeReceiptHtml(logo) + '" alt="Ramanujan Academy logo"><h1>RAMANUJAN ACADEMY</h1><p>Not Just Education, But Complete Development</p><p>Jehan Circle Branch, Patil Sankul, Opp. Reliance Digital, Gangapur Road, Nashik</p><p>Website: ramanujanacademy.in</p><p class="sub">OFFICIAL FEE PAYMENT RECEIPT</p></header>' +
    '<section class="meta"><div class="field"><b>Receipt No:</b><span>' + escapeReceiptHtml(data.receiptNumber) + '</span></div><div class="field"><b>Date:</b><span>' + escapeReceiptHtml(date) + '</span></div>' +
    '<div class="field"><b>Admission / Reg. No:</b><span>' + escapeReceiptHtml(data.studentId) + '</span></div><div class="field"><b>Academic Year:</b><span>' + escapeReceiptHtml((data.academicYear || "2026-2027").replace("-", " - ")) + '</span></div><div class="field full"><b>Next Instalment Due Date:</b><span>' + escapeReceiptHtml(data.nextInstallmentDueDate || "Not scheduled") + '</span></div></section>' +
    '<section class="meta"><div class="field full"><b>Student Name:</b><span>' + escapeReceiptHtml(data.studentName) + '</span></div><div class="field"><b>Class / Course:</b><span>' + escapeReceiptHtml(data.studentClass + (data.board ? " / " + data.board : "")) + '</span></div><div class="field"><b>Roll No / Section:</b><span>—</span></div><div class="field full"><b>Parent / Guardian Name:</b><span>' + escapeReceiptHtml(data.parentName || "—") + '</span></div></section>' +
    '<table><thead><tr><th>S.No.</th><th>Fee Particulars / Description</th><th>Amount (₹)</th></tr></thead><tbody>' +
    feeLine(1, data.feeType || "Fee Payment", amount) + feeLine(2, "Tuition Fee (Monthly / Quarterly)", 0) + feeLine(3, "Examination Fee", 0) + feeLine(4, "Library / Laboratory Fee", 0) + feeLine(5, "Transport / School Bus Fee", 0) + feeLine(6, "Miscellaneous Charges", 0) +
    '</tbody></table><section class="totals"><div class="total"><span>SUBTOTAL:</span><b>₹ ' + money(amount) + '</b></div><div class="total"><span>TAXES:</span><b>₹ 0.00</b></div><div class="total grand"><span>TOTAL PAID:</span><span>₹ ' + money(amount) + '</span></div></section>' +
    '<section class="words"><b>AMOUNT IN WORDS</b>Rupees ' + escapeReceiptHtml(receiptAmountInWords(amount)) + ' only.</section><section class="payment"><b>PAYMENT MODE:</b><div class="modes">' + modes + '</div>' +
    '<div class="bank"><div class="field"><b>Transaction / Cheque Ref No:</b><span>' + escapeReceiptHtml(data.referenceNumber || "—") + '</span></div><div class="field"><b>Payment Date:</b><span>' + escapeReceiptHtml(date) + '</span></div><div class="field"><b>Bank Name (if applicable):</b><span>—</span></div><div class="field"><b>Cash / Bank Account:</b><span>' + escapeReceiptHtml(data.cashBank || "—") + '</span></div></div></section>' +
    '<section class="signatures"><div class="sign">Depositor&#39;s Signature</div><div class="sign">Authorised Signatory / Seal</div></section><p class="foot">Computer-generated receipt. Please retain this receipt for your records.</p></main><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>' +
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300)});</script></body></html>';
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function FinanceCommandCentre({ mode = "admin" }: { mode?: "owner" | "admin" }) {
  const isOwner = mode === "owner";
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<FinanceDashboardRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<FinanceReceiptRow[]>([]);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [feeStructures, setFeeStructures] = useState<FeeStructureOption[]>([]);
  const [feeAccountCount, setFeeAccountCount] = useState(0);
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
    fee_structure_id: "",
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
    cash_paid: "true",
    expense_type: "Operating",
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
    const [s, p, fs, fa] = await Promise.all([
      supabase.from("students").select("id,name,class,board,branch_id,parent_name,academic_year").eq("status", "active").order("name"),
      supabase.from("finance_receipt_register").select("payment_id,receipt_number,payment_date,amount,payment_mode,reference_number,fee_type,cash_bank,student_id,student_name,class,board,academic_year,next_installment_due_date").order("payment_date", { ascending: false }).range(0, 499),
      supabase.from("fee_structures").select("id,class,board,course_name,fee_amount,academic_year").eq("is_active", true).eq("academic_year", "2026-27").order("class"),
      supabase.from("fee_accounts").select("id"),
    ]);
    const [d, m, r] = isOwner ? await Promise.all([
      supabase.from("finance_dashboard").select("*").maybeSingle(),
      supabase.from("finance_monthly_mis").select("*").order("report_month", { ascending: true }),
      supabase.from("finance_receivables").select("*").order("outstanding", { ascending: false }).limit(100),
    ]) : [{ data: null, error: null }, { data: [], error: null }, { data: [], error: null }] as any;
    let allReceipts = (p.data as FinanceReceiptRow[] | null) ?? [];
    // Fetch the full receipt history in pages so older receipts remain searchable too.
    if (!p.error && allReceipts.length === 500) {
      let offset = 500;
      while (true) {
        const page = await supabase.from("finance_receipt_register")
          .select("payment_id,receipt_number,payment_date,amount,payment_mode,reference_number,fee_type,cash_bank,student_id,student_name,class,board,academic_year,next_installment_due_date")
          .order("payment_date", { ascending: false }).range(offset, offset + 499);
        if (page.error) {
          console.error("Receipt history page load error", page.error);
          break;
        }
        allReceipts = allReceipts.concat((page.data as FinanceReceiptRow[]) ?? []);
        if (!page.data || page.data.length < 500) break;
        offset += 500;
      }
    }
    if ((isOwner && (d.error || m.error || r.error)) || s.error || p.error || fs.error || fa.error) {
      console.error("Finance load error", { d: d.error, m: m.error, r: r.error, s: s.error, p: p.error, fs: fs.error, fa: fa.error });
      toast({ title: "Finance load failed", description: "Please refresh and try again.", variant: "destructive" });
    }
    setDashboard((d.data as FinanceDashboardRow | null) ?? null);
    setMonthly((m.data as MonthlyRow[]) ?? []);
    setReceivables((r.data as ReceivableRow[]) ?? []);
    setStudents((s.data as StudentOption[]) ?? []);
    setRecentReceipts(allReceipts);
    setFeeStructures((fs.data as FeeStructureOption[]) ?? []);
    setFeeAccountCount(fa.data?.length ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    void loadFinance();
  }, [isOwner]);

  const recordFee = async () => {
    if (!feeForm.student_id || !feeForm.amount || Number(feeForm.amount) <= 0) {
      toast({ title: "Complete fee details", description: "Select a student and enter a valid amount.", variant: "destructive" });
      return;
    }
    setSavingFee(true);
    const student = students.find((s) => s.id === feeForm.student_id);
    // Open synchronously inside the click handler so the browser allows the receipt window.
    const receiptWindow = window.open("", "_blank", "width=900,height=720");
    if (receiptWindow) {
      receiptWindow.document.write("<!doctype html><title>Preparing receipt…</title><p style='font:16px Arial;padding:24px'>Payment is being saved. Your receipt will open here…</p>");
    }
    const account = await supabase.from("fee_accounts").select("id").eq("student_id", feeForm.student_id).maybeSingle();
    let accountId = account.data?.id;

    // Never invent the student's total fee from the amount of a single payment.
    // Apply an explicitly selected fee structure first so billed/outstanding totals stay accurate.
    if (!accountId) {
      if (!feeForm.fee_structure_id) {
        receiptWindow?.close();
        toast({ title: "Fee structure required", description: "This student has no fee account. Select the correct course fee structure before recording payment.", variant: "destructive" });
        setSavingFee(false);
        return;
      }
      const applied = await supabase.rpc("apply_student_fee_structure", {
        p_student_id: feeForm.student_id,
        p_fee_structure_id: feeForm.fee_structure_id,
        p_reason: "Applied from Finance Command Centre before recording payment",
      });
      if (applied.error) {
        receiptWindow?.close();
        toast({ title: "Could not apply fee structure", description: applied.error.message, variant: "destructive" });
        setSavingFee(false);
        return;
      }
      const refreshedAccount = await supabase.from("fee_accounts").select("id").eq("student_id", feeForm.student_id).maybeSingle();
      if (refreshedAccount.error || !refreshedAccount.data?.id) {
        receiptWindow?.close();
        toast({ title: "Fee account not created", description: refreshedAccount.error?.message || "Please check the fee structure and try again.", variant: "destructive" });
        setSavingFee(false);
        return;
      }
      accountId = refreshedAccount.data.id;
    }

    const { data: paymentRecord, error } = await supabase.rpc("record_fee_payment", {
      p_fee_account_id: accountId,
      p_payment_date: feeForm.payment_date,
      p_amount: Number(feeForm.amount),
      p_payment_mode: feeForm.payment_mode,
      p_reference_number: feeForm.reference_number || null,
      p_notes: feeForm.notes || (student ? "Payment for " + student.name : null),
      p_fee_type: feeForm.fee_type,
      p_cash_bank: feeForm.cash_bank,
    });

    const receiptNumber = (paymentRecord as any)?.receipt_number || "RA—";
    if (error) {
      receiptWindow?.close();
      toast({ title: "Payment not recorded", description: error.message, variant: "destructive" });
    } else {
      const nextDue = await supabase.from("finance_student_ledger").select("next_instalment_due_date").eq("student_id", feeForm.student_id).maybeSingle();
      renderFeeReceipt(receiptWindow, {
        nextInstallmentDueDate: nextDue.data?.next_instalment_due_date ?? null,
        receiptNumber,
        date: feeForm.payment_date,
        studentId: student?.id || feeForm.student_id,
        studentName: student?.name || "Student",
        studentClass: student?.class || "",
        board: student?.board,
        parentName: student?.parent_name,
        academicYear: student?.academic_year,
        amount: Number(feeForm.amount),
        feeType: feeForm.fee_type,
        paymentMode: feeForm.payment_mode,
        referenceNumber: feeForm.reference_number,
        cashBank: feeForm.cash_bank,
      });
      toast({ title: "Payment recorded", description: `Receipt ${receiptNumber} created.` });
      setFeeForm((f) => ({ ...f, amount: "", reference_number: "", notes: "", fee_structure_id: "" }));
      await loadFinance();
    }
    setSavingFee(false);
  };

  const printSavedReceipt = async (receipt: FinanceReceiptRow) => {
    // Open synchronously from the button click to avoid popup blockers.
    const printWindow = window.open("", "_blank", "width=900,height=720");
    if (printWindow) {
      printWindow.document.write("<!doctype html><title>Preparing saved receipt…</title><p style='font:16px Arial;padding:24px'>Loading saved receipt…</p>");
    }
    const student = students.find((item) => item.id === receipt.student_id);
    const nextDue = receipt.next_installment_due_date
      ? { data: { next_instalment_due_date: receipt.next_installment_due_date } }
      : await supabase.from("finance_student_ledger").select("next_instalment_due_date").eq("student_id", receipt.student_id).maybeSingle();
    renderFeeReceipt(printWindow, {
      nextInstallmentDueDate: nextDue.data?.next_instalment_due_date ?? null,
      receiptNumber: receipt.receipt_number || "RA—",
      date: receipt.payment_date,
      studentId: receipt.student_id,
      studentName: receipt.student_name || student?.name || "Student",
      studentClass: receipt.class || student?.class || "",
      board: receipt.board ?? student?.board,
      parentName: student?.parent_name,
      academicYear: receipt.academic_year ?? student?.academic_year,
      amount: Number(receipt.amount || 0),
      feeType: receipt.fee_type || "Fee Payment",
      paymentMode: receipt.payment_mode || "Cash",
      referenceNumber: receipt.reference_number || "",
      cashBank: receipt.cash_bank || "",
    });
  };

  const filteredReceipts = recentReceipts.filter((receipt) => {
    const query = receiptSearch.trim().toLowerCase();
    if (!query) return true;
    return [receipt.receipt_number, receipt.student_name, receipt.student_id, receipt.class,
      receipt.board, receipt.fee_type, receipt.payment_mode, receipt.reference_number]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });

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
      total_amount: Number(expenseForm.amount) + Number(expenseForm.tax_amount || 0),
      payment_mode: expenseForm.payment_mode,
      cash_bank: expenseForm.cash_bank,
      cash_paid: expenseForm.cash_paid === "true",
      expense_type: expenseForm.expense_type,
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
          <h2 className="text-2xl font-bold tracking-tight">{isOwner ? "Finance Command Centre" : "Fee Collection & Receipts"}</h2>
          <p className="text-sm text-muted-foreground">{isOwner ? "Owner-only financial control for Ramanujan Academy" : "Record student fee payments and reprint saved receipts"}</p>
        </div>
        <Button variant="outline" onClick={() => void loadFinance()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

{isOwner && (
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
)}

      <Card className="card-elevated">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>Receipt History & Reprinting</CardTitle><p className="mt-1 text-sm text-muted-foreground">Search saved receipts and print or save any receipt as PDF again.</p></div>
            <Badge variant="outline">{filteredReceipts.length} of {recentReceipts.length} receipts</Badge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={receiptSearch} onChange={(event) => setReceiptSearch(event.target.value)} placeholder="Search receipt no., student, class, fee type or reference…" aria-label="Search saved receipts" />
            <Button variant="outline" onClick={() => void loadFinance()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredReceipts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{recentReceipts.length === 0 ? "No saved receipts found yet." : "No receipts match your search."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="py-2 pr-3">Receipt No.</th><th className="pr-3">Date</th><th className="pr-3">Student</th><th className="pr-3">Fee Type</th><th className="pr-3">Mode</th><th className="pr-3 text-right">Amount</th><th className="pl-3 text-right">Action</th></tr></thead>
                <tbody>{filteredReceipts.map((receipt) => (
                  <tr key={receipt.payment_id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-semibold whitespace-nowrap">{receipt.receipt_number || "—"}</td>
                    <td className="pr-3 whitespace-nowrap">{new Date(receipt.payment_date + "T00:00:00").toLocaleDateString("en-IN")}</td>
                    <td className="pr-3"><div className="font-medium">{receipt.student_name}</div><div className="text-xs text-muted-foreground">Class {receipt.class}{receipt.board ? " · " + receipt.board : ""}</div></td>
                    <td className="pr-3">{receipt.fee_type || "Fee Payment"}</td>
                    <td className="pr-3">{receipt.payment_mode || "—"}</td>
                    <td className="pr-3 text-right font-semibold whitespace-nowrap">{money(receipt.amount)}</td>
                    <td className="pl-3 text-right"><Button size="sm" variant="outline" onClick={() => printSavedReceipt(receipt)}><Receipt className="mr-2 h-4 w-4" />Print</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Select Print to open the saved payment details, then use Print or Save as PDF. Receipt history is loaded from the finance receipt register.</p>
        </CardContent>
      </Card>

      {isOwner && <Card className="card-elevated">
        <CardHeader><CardTitle>Monthly Collections vs Expenses</CardTitle><p className="text-sm text-muted-foreground">Compare money received with recorded operating expenses.</p></CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Monthly figures will appear here as finance transactions are recorded.</p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly.map((row) => ({
                  month: new Date(row.report_month).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
                  collections: Number(row.collections || 0),
                  expenses: Number(row.expenses || 0),
                }))} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => Number(value) >= 1000 ? "₹" + (Number(value) / 1000).toFixed(0) + "k" : "₹" + value} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                  <Bar dataKey="collections" name="Collections" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>}

      {isOwner && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-elevated"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Active Students</p><p className="mt-2 text-2xl font-bold">{Number(dashboard?.active_students || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-muted-foreground">Current active enrolments</p></CardContent></Card>
        <Card className="card-elevated"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Fee Accounts Set Up</p><p className="mt-2 text-2xl font-bold">{feeAccountCount.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-muted-foreground">Students with a fee ledger</p></CardContent></Card>
        <Card className="card-elevated"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Fee Account Coverage</p><p className="mt-2 text-2xl font-bold">{dashboard?.active_students ? (feeAccountCount / Number(dashboard.active_students) * 100).toFixed(1) : "0.0"}%</p><p className="mt-1 text-xs text-muted-foreground">Accounts ÷ active students</p></CardContent></Card>
        <Card className="card-elevated"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Operating Margin</p><p className="mt-2 text-2xl font-bold">{Number(dashboard?.operating_margin_pct || 0).toFixed(1)}%</p><p className="mt-1 text-xs text-muted-foreground">Cash surplus relative to collections</p></CardContent></Card>
      </div>}

      {isOwner && dashboard?.active_students && feeAccountCount < Number(dashboard.active_students) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div><p className="font-semibold">Fee setup is incomplete</p><p className="text-sm text-muted-foreground">{feeAccountCount} of {dashboard.active_students} active students currently have fee accounts. Apply the correct class, board and course fee structure before recording payments so outstanding balances remain accurate.</p></div>
        </div>
      )}

      {isOwner && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-elevated">
          <CardHeader><CardTitle>Collection Efficiency</CardTitle></CardHeader>
          <CardContent><div className="text-4xl font-bold">{Number(dashboard?.collection_efficiency_pct || 0).toFixed(1)}%</div><p className="text-sm text-muted-foreground mt-2">Collected ÷ billed</p></CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle>Operating Cash Surplus</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2 text-4xl font-bold"><TrendingUp className="h-8 w-8" />{money(dashboard?.operating_cash_surplus)}</div><p className="text-sm text-muted-foreground mt-2">Collections less recorded expenses</p></CardContent>
        </Card>
      </div>}

      <FinanceLedgerWorkspace mode={mode} />

      <Tabs defaultValue="collection">
        <TabsList className={isOwner ? "grid w-full grid-cols-3" : "grid w-full grid-cols-1"}>
          <TabsTrigger value="collection">Fee Collection</TabsTrigger>
          {isOwner && <TabsTrigger value="expenses">Expense Entry</TabsTrigger>}
          {isOwner && <TabsTrigger value="reports">Reports</TabsTrigger>}
        </TabsList>

        <TabsContent value="collection">
          <Card>
            <CardHeader><CardTitle>Record Fee Collection</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Student</Label><NativeSelect options={students.map(s => ({ value: s.id, label: `${s.name} — Class ${s.class}` }))} value={feeForm.student_id} onValueChange={(value) => setFeeForm(f => ({ ...f, student_id: value, fee_structure_id: "" }))} placeholder="Select student" /></div>
              <div><Label>Fee Structure (needed if no fee account exists)</Label><NativeSelect options={feeStructures.filter(fs => { const student = students.find(s => s.id === feeForm.student_id); return !!student && fs.class === student.class && (fs.board === "Any" || fs.board === student.board); }).map(fs => ({ value: fs.id, label: `${fs.course_name} — ₹${Number(fs.fee_amount).toLocaleString("en-IN")}` }))} value={feeForm.fee_structure_id} onValueChange={(value) => setFeeForm(f => ({ ...f, fee_structure_id: value }))} placeholder="Select course fee structure" /></div>
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

        {isOwner && <TabsContent value="expenses">
          <Card>
            <CardHeader><CardTitle>Record Expense</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Date</Label><Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm(f => ({ ...f, expense_date:e.target.value }))} /></div>
              <div><Label>Vendor / Payee</Label><Input value={expenseForm.vendor_payee} onChange={(e) => setExpenseForm(f => ({ ...f, vendor_payee:e.target.value }))} /></div>
              <div><Label>Category</Label><NativeSelect options={["Teaching","Admin Salary","Teacher Salary","Rent","Electricity","Marketing","Software","Office","Travel","Other"].map(v => ({ value:v,label:v }))} value={expenseForm.category} onValueChange={(value) => setExpenseForm(f => ({ ...f, category:value }))} /></div>
              <div><Label>Fixed / Variable</Label><NativeSelect options={["Fixed","Variable"].map(v => ({ value:v,label:v }))} value={expenseForm.fixed_variable} onValueChange={(value) => setExpenseForm(f => ({ ...f, fixed_variable:value }))} /></div>
              <div><Label>Expense Type</Label><NativeSelect options={["Operating","Depreciation","Accrual","Other"].map(v => ({ value:v,label:v }))} value={expenseForm.expense_type} onValueChange={(value) => setExpenseForm(f => ({ ...f, expense_type:value }))} /></div>
              <div><Label>Cash Impact</Label><NativeSelect options={[{value:"true",label:"Paid from cash / bank"},{value:"false",label:"Non-cash / accrued"}]} value={expenseForm.cash_paid} onValueChange={(value) => setExpenseForm(f => ({ ...f, cash_paid:value }))} /></div>
              <div><Label>Cash / Bank Account</Label><NativeSelect options={["Cash","Bank"].map(v => ({ value:v,label:v }))} value={expenseForm.cash_bank} onValueChange={(value) => setExpenseForm(f => ({ ...f, cash_bank:value }))} /></div>
              <div><Label>Amount (₹)</Label><Input type="number" min="1" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount:e.target.value }))} /></div>
              <div><Label>Tax (₹)</Label><Input type="number" min="0" value={expenseForm.tax_amount} onChange={(e) => setExpenseForm(f => ({ ...f, tax_amount:e.target.value }))} /></div>
              <div><Label>Payment Mode</Label><NativeSelect options={["Cash","UPI","Bank Transfer","Card","Cheque"].map(v => ({ value:v,label:v }))} value={expenseForm.payment_mode} onValueChange={(value) => setExpenseForm(f => ({ ...f, payment_mode:value }))} /></div>
              <div><Label>Description</Label><Input value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description:e.target.value }))} /></div>
              <div className="md:col-span-2"><Button onClick={() => void recordExpense()} disabled={savingExpense} className="w-full"><Plus className="mr-2 h-4 w-4" />{savingExpense ? "Recording…" : "Record Expense"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>}

        {isOwner && <TabsContent value="reports" className="space-y-4">
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
        </TabsContent>}
      </Tabs>
    </div>
  );
}
