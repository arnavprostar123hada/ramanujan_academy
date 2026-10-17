import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Plus, RefreshCw, Receipt, Wallet, TrendingUp, AlertTriangle, Sparkles, ClipboardCheck } from "lucide-react";
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
  academic_year?: string | null;
  parent_name?: string | null;
  cash_bank?: string | null;
};

type StudentOption = { id: string; name: string; class: string; board: string | null; branch_id: string | null; academic_year?: string | null };
type AppliedFeeResult = { success: boolean; net_fee: number; discount: number; scholarship: number; outstanding: number; collected: number };
type RecordedPaymentResult = { success: boolean; payment_id: string; receipt_number: string; amount: number; outstanding_after: number; student_name: string };


function escapeReceiptHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

function amountInWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "Zero Rupees";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const underThousand = (num: number): string => {
    const parts: string[] = [];
    if (num >= 100) { parts.push(ones[Math.floor(num / 100)] + " Hundred"); num %= 100; }
    if (num >= 20) { parts.push(tens[Math.floor(num / 10)]); num %= 10; }
    if (num > 0) parts.push(ones[num]);
    return parts.join(" ");
  };
  let rest = n;
  const parts: string[] = [];
  const crore = Math.floor(rest / 10000000); rest %= 10000000;
  const lakh = Math.floor(rest / 100000); rest %= 100000;
  const thousand = Math.floor(rest / 1000); rest %= 1000;
  if (crore) parts.push(underThousand(crore) + " Crore");
  if (lakh) parts.push(underThousand(lakh) + " Lakh");
  if (thousand) parts.push(underThousand(thousand) + " Thousand");
  if (rest) parts.push(underThousand(rest));
  return parts.join(" ");
}

function printFinanceReceipt(receipt: ReceiptRow) {
  // Open and print a standalone fee receipt document, not the admin page.
  const printWindow = window.open("", "_blank", "width=900,height=720");
  if (!printWindow) {
    window.alert("Your browser blocked the receipt window. Allow pop-ups for this site and click Print Receipt again.");
    return;
  }

  const amount = Number(receipt.amount || 0);
  const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount);
  const paidDate = receipt.payment_date
    ? new Date(receipt.payment_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : new Date().toLocaleDateString("en-IN");
  const academicYear = receipt.academic_year || "2026-2027";
  const field = (label: string, value: unknown) =>
    '<div class="field"><b>' + escapeReceiptHtml(label) + '</b><span>' + escapeReceiptHtml(value || "—") + "</span></div>";
  const feeLine = (label: string, value: number, index: number) =>
    "<tr><td>" + index + ".</td><td>" + escapeReceiptHtml(label) + "</td><td class=\"money\">" +
    (value > 0 ? "₹ " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value) : "—") + "</td></tr>";
  const modes = ["Cash", "Cheque", "UPI / Net Banking", "Card"];
  const selectedMode = (receipt.payment_mode || "").toLowerCase();
  const modeBoxes = modes.map((mode) => {
    const chosen = mode === "UPI / Net Banking"
      ? /upi|net|bank|online|neft|imps/i.test(selectedMode)
      : selectedMode.includes(mode.toLowerCase());
    return '<span class="mode">' + (chosen ? "☑" : "☐") + " " + escapeReceiptHtml(mode) + "</span>";
  }).join("");

  const documentHtml = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Fee Receipt - ' + escapeReceiptHtml(receipt.receipt_number) + '</title><style>' +
    '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#fff;font-size:12px}' +
    '.receipt{width:100%;max-width:780px;margin:0 auto;padding:10px}.brand{text-align:center;border-bottom:3px double #111;padding:0 0 12px;margin-bottom:14px}' +
    '.brand h1{font-size:24px;letter-spacing:.4px;margin:0 0 5px}.brand p{margin:3px 0;font-size:11px}.brand .tag{font-size:10px;font-weight:bold;letter-spacing:1px;margin-top:6px}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:12px 0 16px}.field{display:flex;gap:8px;align-items:baseline;min-height:24px;border-bottom:1px dotted #777;padding:4px 0}.field b{white-space:nowrap;font-size:10px;text-transform:uppercase}.field span{font-weight:600;overflow-wrap:anywhere}' +
    '.full{grid-column:1/-1}.student{margin:12px 0 16px}.student .field{min-height:28px}.table{width:100%;border-collapse:collapse;margin-top:8px}.table th,.table td{border:1px solid #333;padding:8px;text-align:left}.table th{font-size:11px;background:#f1f1f1}.table td:first-child{width:42px;text-align:center}.table td:last-child,.table th:last-child{text-align:right;width:145px}.table .money{white-space:nowrap}' +
    '.totals{margin:10px 0 12px auto;width:290px}.totalrow{display:flex;justify-content:space-between;padding:4px 0}.grand{border-top:1px solid #111;border-bottom:3px double #111;font-size:16px;font-weight:bold;padding:8px 0}.words{border:1px solid #555;padding:9px;margin:12px 0}.words b{display:block;margin-bottom:5px;font-size:10px}.payment{margin:14px 0}.modes{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0}.mode{white-space:nowrap}.bank{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-top:8px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:54px}.sign{border-top:1px solid #222;padding-top:7px;text-align:center;font-size:11px}.foot{text-align:center;font-size:9px;margin-top:18px;color:#555}.actions{text-align:center;margin:18px auto}.actions button{padding:10px 18px;font-size:14px;cursor:pointer}' +
    '@media print{.actions{display:none}.receipt{max-width:none;padding:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media(max-width:560px){.meta,.bank{grid-template-columns:1fr}.full{grid-column:auto}.totals{width:100%}}' +
    '</style></head><body><main class="receipt">' +
    '<header class="brand"><h1>RAMANUJAN ACADEMY</h1><p>Not Just Education, But Complete Development</p>' +
    '<p>Jehan Circle Branch, Patil Sankul, Opp. Reliance Digital, Gangapur Road, Nashik</p>' +
    '<p>Website: ramanujanacademy.in</p><p class="tag">OFFICIAL FEE PAYMENT RECEIPT</p></header>' +
    '<section class="meta"><div class="field"><b>Receipt No:</b><span>' + escapeReceiptHtml(receipt.receipt_number) + '</span></div>' +
    '<div class="field"><b>Date:</b><span>' + escapeReceiptHtml(paidDate) + '</span></div>' +
    '<div class="field"><b>Admission / Reg. No:</b><span>' + escapeReceiptHtml(receipt.student_id) + '</span></div>' +
    '<div class="field"><b>Academic Year:</b><span>' + escapeReceiptHtml(academicYear.replace("-", " - ")) + '</span></div></section>' +
    '<section class="student"><div class="field full"><b>Student Name:</b><span>' + escapeReceiptHtml(receipt.student_name) + '</span></div>' +
    '<div class="meta"><div class="field"><b>Class / Course:</b><span>' + escapeReceiptHtml(receipt.class + (receipt.board ? " / " + receipt.board : "")) + '</span></div>' +
    '<div class="field"><b>Roll No / Section:</b><span>—</span></div>' +
    '<div class="field full"><b>Parent / Guardian Name:</b><span>' + escapeReceiptHtml(receipt.parent_name || "—") + '</span></div></div></section>' +
    '<table class="table"><thead><tr><th>S.No.</th><th>Fee Particulars / Description</th><th>Amount (₹)</th></tr></thead><tbody>' +
    feeLine(receipt.fee_type || "Fee Payment", amount, 1) +
    feeLine("Tuition Fee (Monthly / Quarterly)", 0, 2) +
    feeLine("Examination Fee", 0, 3) +
    feeLine("Library / Laboratory Fee", 0, 4) +
    feeLine("Transport / School Bus Fee", 0, 5) +
    feeLine("Miscellaneous Charges", 0, 6) +
    '</tbody></table><section class="totals"><div class="totalrow"><span>SUBTOTAL:</span><b>₹ ' + rupees + '</b></div>' +
    '<div class="totalrow"><span>TAXES:</span><b>₹ 0.00</b></div><div class="totalrow grand"><span>TOTAL PAID:</span><span>₹ ' + rupees + '</span></div></section>' +
    '<section class="words"><b>AMOUNT IN WORDS</b>Rupees ' + escapeReceiptHtml(amountInWords(amount)) + ' only.</section>' +
    '<section class="payment"><b>PAYMENT MODE:</b><div class="modes">' + modeBoxes + '</div>' +
    '<div class="bank"><div class="field"><b>Transaction / Cheque Ref No:</b><span>' + escapeReceiptHtml(receipt.reference_number || "—") + '</span></div>' +
    '<div class="field"><b>Payment Date:</b><span>' + escapeReceiptHtml(paidDate) + '</span></div>' +
    '<div class="field"><b>Bank Name (if applicable):</b><span>—</span></div>' +
    '<div class="field"><b>Cash / Bank Account:</b><span>' + escapeReceiptHtml(receipt.cash_bank || "—") + '</span></div></div></section>' +
    '<section class="signatures"><div class="sign">Depositor&#39;s Signature</div><div class="sign">Authorised Signatory / Seal</div></section>' +
    '<p class="foot">Computer-generated receipt. Please retain this receipt for your records.</p></main>' +
    '<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>' +
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300)});</script></body></html>';
  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();
}

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
  const [applyFeeSaving, setApplyFeeSaving] = useState(false);
  const [applyFeeForm, setApplyFeeForm] = useState({ student_id: "", fee_structure_id: "", reason: "Apply standard fee structure" });
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
      supabase.from("students").select("id,name,class,board,branch_id,academic_year,parent_name,admission_date").eq("status", "active").order("name"),
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
    const { data: receiptRows, error: receiptsError } = await supabase.from("finance_receipt_register").select("payment_id,receipt_number,payment_date,amount,payment_mode,reference_number,fee_type,cash_bank,student_id,student_name,class,board,academic_year").order("payment_date", { ascending: false }).limit(100);
    if (feeRulesError) console.warn("Fee rules unavailable to this role", feeRulesError.message);
    if (receiptsError) console.warn("Receipt register unavailable to this role", receiptsError.message);
    setFeeStructures((feeRules as FeeStructureRow[]) ?? []);
    const studentDetails = new Map(((s.data as (StudentOption & { parent_name?: string | null })[]) ?? []).map((student) => [student.id, student]));
    setReceipts(((receiptRows as ReceiptRow[]) ?? []).map((receipt) => ({ ...receipt, parent_name: studentDetails.get(receipt.student_id)?.parent_name ?? null })));
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
    const account = await supabase
      .from("fee_accounts")
      .select("id")
      .eq("student_id", feeForm.student_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (account.error) {
      toast({ title: "Fee account could not be loaded", description: account.error.message, variant: "destructive" });
      setSavingFee(false);
      return;
    }
    if (!account.data?.id) {
      toast({
        title: "Set the student's fee first",
        description: "Open Fee Setup → Apply Fee to Student Account before recording an instalment. No payment was recorded.",
        variant: "destructive",
      });
      setSavingFee(false);
      return;
    }

    const { data, error } = await supabase.rpc("record_fee_payment", {
      p_fee_account_id: account.data.id,
      p_payment_date: feeForm.payment_date,
      p_amount: Number(feeForm.amount),
      p_payment_mode: feeForm.payment_mode,
      p_reference_number: feeForm.reference_number || null,
      p_notes: feeForm.notes || (student ? `Payment for ${student.name}` : null),
      p_fee_type: feeForm.fee_type,
      p_cash_bank: feeForm.cash_bank,
    });

    if (error || !data) {
      toast({
        title: "Payment not recorded",
        description: error?.message || "The payment service did not return a receipt.",
        variant: "destructive",
      });
    } else {
      const result = data as unknown as RecordedPaymentResult;
      toast({
        title: "Payment recorded",
        description: `Receipt ${result.receipt_number} created. Remaining fee: ${money(result.outstanding_after)}.`,
      });
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

  const applyFeeToStudent = async () => {
    if (!applyFeeForm.student_id || !applyFeeForm.fee_structure_id) {
      toast({ title: "Select a student and fee structure", variant: "destructive" });
      return;
    }
    setApplyFeeSaving(true);
    const { data, error } = await supabase.rpc("apply_student_fee_structure", {
      p_student_id: applyFeeForm.student_id,
      p_fee_structure_id: applyFeeForm.fee_structure_id,
      p_reason: applyFeeForm.reason.trim() || "Apply standard fee structure",
    });
    setApplyFeeSaving(false);
    if (error) {
      toast({ title: "Fee was not applied", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as unknown as AppliedFeeResult;
    toast({
      title: "Fee applied to student account",
      description: `Net fee ${money(result.net_fee)} · collected ${money(result.collected)} · outstanding ${money(result.outstanding)}`,
    });
    setApplyFeeForm((f) => ({ ...f, fee_structure_id: "" }));
    await loadFinance();
  };

  const selectedFeeStudent = students.find((s) => s.id === applyFeeForm.student_id);
  const applicableFeeStructures = feeStructures.filter((r) => {
    if (!r.is_active) return false;
    if (!selectedFeeStudent) return true;
    const studentYear = selectedFeeStudent.academic_year || "2026-27";
    return r.class === selectedFeeStudent.class
      && (r.board === "Any" || r.board === (selectedFeeStudent.board || ""))
      && r.academic_year === studentYear;
  });

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

  const financeSignals = useMemo(() => {
    const signals: { priority: "High" | "Review" | "Info"; title: string; detail: string }[] = [];
    if (dashboard) {
      if (dashboard.outstanding > 0) {
        const topNames = receivables.filter((r) => r.outstanding > 0).slice(0, 3).map((r) => r.student_name);
        signals.push({
          priority: dashboard.collection_efficiency_pct < 70 ? "High" : "Review",
          title: "Follow up on outstanding fees",
          detail: `${money(dashboard.outstanding)} remains outstanding. Start with ${topNames.length ? topNames.join(", ") : "the highest outstanding accounts"}.`,
        });
      }
      if (dashboard.operating_cash_surplus < 0) {
        signals.push({
          priority: "High",
          title: "Review cash outflow",
          detail: `Recorded expenses exceed collections by ${money(Math.abs(dashboard.operating_cash_surplus))}. Check large or duplicate entries before discretionary spending.`,
        });
      }
      if (dashboard.collection_efficiency_pct < 80) {
        signals.push({
          priority: "Review",
          title: "Collection efficiency is below target",
          detail: `${Number(dashboard.collection_efficiency_pct || 0).toFixed(1)}% of billed fees are collected in the current finance view. Prioritise due-fee follow-ups.`,
        });
      }
    }
    if (monthly.length >= 2) {
      const previous = monthly[monthly.length - 2];
      const latest = monthly[monthly.length - 1];
      if (Number(previous.collections) > 0 && Number(latest.collections) < Number(previous.collections) * 0.8) {
        signals.push({
          priority: "Review",
          title: "Collections have slowed",
          detail: `Latest reported month is down more than 20% versus ${new Date(previous.report_month).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}. Check admissions and follow-up activity.`,
        });
      }
    }
    if (!signals.length) {
      signals.push({
        priority: "Info",
        title: "No immediate finance exception detected",
        detail: "Continue reviewing the daily collection, expense and outstanding-fee reports.",
      });
    }
    return signals.slice(0, 4);
  }, [dashboard, monthly, receivables, money]);

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

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Finance Decision Assistant</CardTitle>
          <p className="text-sm text-muted-foreground">Automatic signals from your live finance reports. This rules-based layer makes no external AI API calls, so it adds no model usage charges.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {financeSignals.map((signal, index) => (
            <div key={`${signal.title}-${index}`} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{signal.priority} priority</span>
                {signal.priority === "High" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <ClipboardCheck className="h-4 w-4 text-primary" />}
              </div>
              <p className="font-semibold">{signal.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{signal.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="collection">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-6">
          <TabsTrigger value="collection">Fee Collection</TabsTrigger>
          <TabsTrigger value="fees">Fee Setup</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
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
            <CardHeader><CardTitle>Apply Fee to Student Account</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Student</Label><NativeSelect options={students.map(s => ({ value: s.id, label: `${s.name} — Class ${s.class} (${s.board || "Board not set"})` }))} value={applyFeeForm.student_id} onValueChange={(value) => setApplyFeeForm(f => ({ ...f, student_id:value, fee_structure_id:"" }))} placeholder="Select student" /></div>
              <div><Label>Matching Standard Fee</Label><NativeSelect options={applicableFeeStructures.map(r => ({ value:r.id, label:`${r.academic_year} · ${r.board} · ${r.course_name} · ${money(r.fee_amount)}` }))} value={applyFeeForm.fee_structure_id} onValueChange={(value) => setApplyFeeForm(f => ({ ...f, fee_structure_id:value }))} placeholder="Choose matching fee" /></div>
              <div className="md:col-span-2"><Label>Application / Approval Note</Label><Textarea value={applyFeeForm.reason} onChange={(e) => setApplyFeeForm(f => ({ ...f, reason:e.target.value }))} /></div>
              <div className="md:col-span-2">
                <Button onClick={() => void applyFeeToStudent()} disabled={applyFeeSaving || !applyFeeForm.student_id || !applyFeeForm.fee_structure_id} className="w-full">{applyFeeSaving ? "Applying fee…" : "Apply Fee & Recalculate Outstanding"}</Button>
                <p className="mt-2 text-xs text-muted-foreground">The server checks owner/admin access and matching class, board and academic year. It applies active concessions and blocks changes if already-collected money would exceed the new net fee; actions are audit-logged.</p>
              </div>
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
                  <tbody>{receipts.map((r) => <tr key={r.payment_id} className="border-b last:border-0"><td className="py-2 font-medium">{r.receipt_number}</td><td>{r.payment_date}</td><td>{r.student_name}</td><td>{r.class}</td><td>{r.payment_mode || "—"}</td><td className="font-semibold">{money(r.amount)}</td><td><Button size="sm" variant="outline" onClick={() => printFinanceReceipt(r)}>Print Receipt</Button></td></tr>)}</tbody>
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
