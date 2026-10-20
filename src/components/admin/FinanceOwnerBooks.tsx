import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus, Landmark, Package, CheckCircle2, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type Asset = { id:string; asset_code:string|null; asset_name:string; asset_category:string; acquisition_date:string; purchase_cost:number; amount_paid:number; residual_value:number; accumulated_depreciation:number; useful_life_months:number|null; payment_status:string; payment_due_date:string|null; cash_bank:string|null; notes:string|null };
type Liability = { id:string; liability_code:string|null; liability_name:string; liability_type:string; party_name:string|null; initial_amount:number; outstanding_amount:number; interest_rate:number|null; fixed_variable:string; start_date:string; due_date:string|null; next_payment_date:string|null; status:string; notes:string|null };
type LiabilityTransaction = { id:string; liability_id:string; transaction_date:string; transaction_type:string; amount:number; payment_mode:string|null; reference_number:string|null; notes:string|null };
type ImportRow = { id:string; source_row:number; source_receipt_id:string|null; source_student_id:string|null; student_name:string|null; student_class:string|null; program:string|null; payment_date:string|null; due_date:string|null; amount_billed:number|null; amount_collected:number|null; anomalies:string[]; review_status:string; matched_student_id:string|null; review_notes:string|null };
type StudentOption = { id:string; name:string; class:string; board:string|null; batch:string|null };

const today = () => new Date().toISOString().slice(0,10);
const money = (v:unknown) => "₹" + Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2});

export function FinanceOwnerBooks() {
  const { toast } = useToast();
  const [assets,setAssets] = useState<Asset[]>([]);
  const [liabilities,setLiabilities] = useState<Liability[]>([]);
  const [transactions,setTransactions] = useState<LiabilityTransaction[]>([]);
  const [imports,setImports] = useState<ImportRow[]>([]);
  const [students,setStudents] = useState<StudentOption[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [assetForm,setAssetForm] = useState({asset_name:"",asset_category:"Computer / IT",acquisition_date:today(),purchase_cost:"",amount_paid:"0",residual_value:"0",useful_life_months:"36",accumulated_depreciation:"0",payment_status:"unpaid",payment_due_date:"",cash_bank:"Bank",payment_mode:"Bank Transfer",notes:""});
  const [liabilityForm,setLiabilityForm] = useState({liability_name:"",liability_type:"Bank Loan",party_name:"",initial_amount:"",outstanding_amount:"",interest_rate:"",fixed_variable:"Fixed",start_date:today(),due_date:"",next_payment_date:"",payment_frequency:"Monthly",notes:""});
  const [txnForm,setTxnForm] = useState({liability_id:"",transaction_date:today(),transaction_type:"repayment",amount:"",payment_mode:"Bank Transfer",cash_bank:"Bank",reference_number:"",notes:""});
  const [matchMap,setMatchMap] = useState<Record<string,string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [a,l,t,i,s] = await Promise.all([
      (supabase as any).from("finance_fixed_assets").select("*").order("acquisition_date",{ascending:false}),
      (supabase as any).from("finance_liabilities").select("*").order("start_date",{ascending:false}),
      (supabase as any).from("finance_liability_transactions").select("*").order("transaction_date",{ascending:false}).limit(500),
      (supabase as any).from("finance_fee_import_staging").select("id,source_row,source_receipt_id,source_student_id,student_name,student_class,program,payment_date,due_date,amount_billed,amount_collected,anomalies,review_status,matched_student_id,review_notes").order("source_row").limit(500),
      supabase.from("students").select("id,name,class,board,batch").eq("status","active").order("name"),
    ]);
    const errors=[a.error,l.error,t.error,i.error,s.error].filter(Boolean);
    if(errors.length) {
      console.error("Owner finance books load errors",errors);
      toast({title:"Some owner finance records could not load",description:"Check owner permissions and refresh.",variant:"destructive"});
    }
    setAssets((a.data as Asset[])||[]);
    setLiabilities((l.data as Liability[])||[]);
    setTransactions((t.data as LiabilityTransaction[])||[]);
    setImports((i.data as ImportRow[])||[]);
    setStudents((s.data as StudentOption[])||[]);
    setLoading(false);
  },[toast]);

  useEffect(()=>{void load();},[load]);

  const saveAsset = async () => {
    if(!assetForm.asset_name.trim() || Number(assetForm.purchase_cost)<0 || !assetForm.purchase_cost) {
      toast({title:"Enter asset name and purchase cost",variant:"destructive"}); return;
    }
    if(Number(assetForm.amount_paid)>Number(assetForm.purchase_cost)) {
      toast({title:"Amount paid cannot exceed purchase cost",variant:"destructive"}); return;
    }
    setSaving(true);
    const {data:user}=await supabase.auth.getUser();
    const payload={...assetForm,purchase_cost:Number(assetForm.purchase_cost),amount_paid:Number(assetForm.amount_paid||0),residual_value:Number(assetForm.residual_value||0),useful_life_months:assetForm.useful_life_months?Number(assetForm.useful_life_months):null,accumulated_depreciation:Number(assetForm.accumulated_depreciation||0),payment_due_date:assetForm.payment_due_date||null,notes:assetForm.notes||null,created_by:user.user?.id||null};
    const {error}=await (supabase as any).from("finance_fixed_assets").insert(payload);
    if(error) toast({title:"Asset not saved",description:error.message,variant:"destructive"});
    else {toast({title:"Fixed asset recorded"});setAssetForm(f=>({...f,asset_name:"",purchase_cost:"",amount_paid:"0",notes:""}));await load();}
    setSaving(false);
  };

  const saveLiability = async () => {
    if(!liabilityForm.liability_name.trim() || Number(liabilityForm.initial_amount)<=0 || Number(liabilityForm.outstanding_amount)<0) {
      toast({title:"Enter liability name and valid amounts",variant:"destructive"});return;
    }
    if(Number(liabilityForm.outstanding_amount)>Number(liabilityForm.initial_amount)) {
      toast({title:"Outstanding cannot exceed initial principal here. Add extra borrowing or interest as a transaction.",variant:"destructive"});return;
    }
    setSaving(true);
    const {data:user}=await supabase.auth.getUser();
    const payload={...liabilityForm,initial_amount:Number(liabilityForm.initial_amount),outstanding_amount:Number(liabilityForm.outstanding_amount),interest_rate:liabilityForm.interest_rate?Number(liabilityForm.interest_rate):null,due_date:liabilityForm.due_date||null,next_payment_date:liabilityForm.next_payment_date||null,party_name:liabilityForm.party_name||null,notes:liabilityForm.notes||null,created_by:user.user?.id||null};
    const {error}=await (supabase as any).from("finance_liabilities").insert(payload);
    if(error)toast({title:"Liability not saved",description:error.message,variant:"destructive"});
    else {toast({title:"Liability recorded"});setLiabilityForm(f=>({...f,liability_name:"",party_name:"",initial_amount:"",outstanding_amount:"",interest_rate:"",notes:""}));await load();}
    setSaving(false);
  };

  const saveLiabilityTransaction = async () => {
    if(!txnForm.liability_id || Number(txnForm.amount)<=0) {toast({title:"Select liability and enter amount",variant:"destructive"});return;}
    const liability=liabilities.find(l=>l.id===txnForm.liability_id);
    if(txnForm.transaction_type==="repayment" && liability && Number(txnForm.amount)>Number(liability.outstanding_amount)) {
      toast({title:"Repayment exceeds outstanding balance",variant:"destructive"});return;
    }
    setSaving(true);
    const {data:user}=await supabase.auth.getUser();
    const {error}=await (supabase as any).from("finance_liability_transactions").insert({...txnForm,amount:Number(txnForm.amount),reference_number:txnForm.reference_number||null,notes:txnForm.notes||null,created_by:user.user?.id||null});
    if(error)toast({title:"Liability transaction not saved",description:error.message,variant:"destructive"});
    else {toast({title:"Liability transaction recorded"});setTxnForm(f=>({...f,amount:"",reference_number:"",notes:""}));await load();}
    setSaving(false);
  };

  const updateImport = async (row:ImportRow, status:"matched"|"skipped") => {
    const studentId=matchMap[row.id]||row.matched_student_id||"";
    if(status==="matched" && !studentId) {toast({title:"Select the matching student first",variant:"destructive"});return;}
    const {data:user}=await supabase.auth.getUser();
    const {error}=await (supabase as any).from("finance_fee_import_staging").update({matched_student_id:status==="matched"?studentId:null,review_status:status,reviewed_by:user.user?.id||null,reviewed_at:new Date().toISOString(),review_notes:status==="skipped"?"Skipped by owner":"Student matched by owner"}).eq("id",row.id);
    if(error)toast({title:"Review update failed",description:error.message,variant:"destructive"});
    else {toast({title:status==="matched"?"Student match saved":"Workbook row skipped"});await load();}
  };

  const assetBookValue=(a:Asset)=>Math.max(0,Number(a.purchase_cost)-Number(a.accumulated_depreciation));
  const outstandingAssets=assets.reduce((n,a)=>n+Math.max(0,Number(a.purchase_cost)-Number(a.amount_paid)),0);
  const netAssets=assets.reduce((n,a)=>n+assetBookValue(a),0);
  const totalLiabilities=liabilities.filter(l=>l.status!=="settled").reduce((n,l)=>n+Number(l.outstanding_amount),0);
  const pendingImport=imports.filter(i=>i.review_status==="needs_review"||i.review_status==="matched").length;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Owner-only ledgers</h3><p className="text-sm text-muted-foreground">Capital assets, borrowings and workbook reconciliation. These records are not visible to admin accounts.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh owner books</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fixed assets at book value</p><p className="mt-1 text-xl font-bold">{money(netAssets)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Asset purchase payable</p><p className="mt-1 text-xl font-bold">{money(outstandingAssets)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding liabilities</p><p className="mt-1 text-xl font-bold">{money(totalLiabilities)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Workbook rows to review</p><p className="mt-1 text-xl font-bold">{pendingImport}</p></CardContent></Card>
    </div>
    <Tabs defaultValue="assets">
      <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="assets">Fixed Assets</TabsTrigger><TabsTrigger value="liabilities">Liabilities & Loans</TabsTrigger><TabsTrigger value="movements">Liability Movements</TabsTrigger><TabsTrigger value="import">Excel Fee Review</TabsTrigger></TabsList>
      <TabsContent value="assets" className="space-y-3">
        <Card><CardHeader><CardTitle>Record fixed asset / capital purchase</CardTitle><p className="text-sm text-muted-foreground">Computers, furniture, equipment, fit-outs and other durable assets. The asset purchase is not treated as an operating expense.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1"><Label>Asset name</Label><Input value={assetForm.asset_name} onChange={e=>setAssetForm(f=>({...f,asset_name:e.target.value}))} placeholder="e.g. Classroom computer"/></div>
          <div className="space-y-1"><Label>Category</Label><NativeSelect value={assetForm.asset_category} onValueChange={v=>setAssetForm(f=>({...f,asset_category:v}))} options={["Computer / IT","Furniture","Projector / AV","Lab Equipment","Leasehold Improvement","Vehicle","Other"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Acquisition date</Label><Input type="date" value={assetForm.acquisition_date} onChange={e=>setAssetForm(f=>({...f,acquisition_date:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Purchase cost (₹)</Label><Input type="number" min="0" value={assetForm.purchase_cost} onChange={e=>setAssetForm(f=>({...f,purchase_cost:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Amount paid (₹)</Label><Input type="number" min="0" value={assetForm.amount_paid} onChange={e=>setAssetForm(f=>({...f,amount_paid:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Payment status</Label><NativeSelect value={assetForm.payment_status} onValueChange={v=>setAssetForm(f=>({...f,payment_status:v}))} options={[{value:"paid",label:"Paid"},{value:"part_paid",label:"Part paid"},{value:"unpaid",label:"Unpaid"},{value:"financed",label:"Financed"}]}/></div>
          <div className="space-y-1"><Label>Useful life (months)</Label><Input type="number" min="1" value={assetForm.useful_life_months} onChange={e=>setAssetForm(f=>({...f,useful_life_months:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Residual value (₹)</Label><Input type="number" min="0" value={assetForm.residual_value} onChange={e=>setAssetForm(f=>({...f,residual_value:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Accumulated depreciation (₹)</Label><Input type="number" min="0" value={assetForm.accumulated_depreciation} onChange={e=>setAssetForm(f=>({...f,accumulated_depreciation:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Payment due date</Label><Input type="date" value={assetForm.payment_due_date} onChange={e=>setAssetForm(f=>({...f,payment_due_date:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Cash / Bank</Label><NativeSelect value={assetForm.cash_bank} onValueChange={v=>setAssetForm(f=>({...f,cash_bank:v}))} options={["Cash","Bank"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Payment mode</Label><NativeSelect value={assetForm.payment_mode} onValueChange={v=>setAssetForm(f=>({...f,payment_mode:v}))} options={["Cash","UPI","Bank Transfer","Card","Cheque","Loan"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1 md:col-span-2 xl:col-span-3"><Label>Notes / serial number / location</Label><Input value={assetForm.notes} onChange={e=>setAssetForm(f=>({...f,notes:e.target.value}))}/></div>
          <div><Button className="w-full" onClick={()=>void saveAsset()} disabled={saving}><Package className="mr-2 h-4 w-4"/>Record asset</Button></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Asset register</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Asset</th><th className="p-2">Date</th><th className="p-2">Cost</th><th className="p-2">Paid</th><th className="p-2">Payable</th><th className="p-2">Book value</th><th className="p-2">Status</th></tr></thead><tbody>{assets.map(a=><tr key={a.id} className="border-b"><td className="p-2">{a.asset_name}<div className="text-xs text-muted-foreground">{a.asset_category}</div></td><td className="p-2">{a.acquisition_date}</td><td className="p-2">{money(a.purchase_cost)}</td><td className="p-2">{money(a.amount_paid)}</td><td className="p-2">{money(Number(a.purchase_cost)-Number(a.amount_paid))}</td><td className="p-2">{money(assetBookValue(a))}</td><td className="p-2">{a.payment_status}</td></tr>)}</tbody></table></div></CardContent></Card>
      </TabsContent>
      <TabsContent value="liabilities" className="space-y-3">
        <Card><CardHeader><CardTitle>Record loan / liability</CardTitle><p className="text-sm text-muted-foreground">Loans, rent or salary payable, supplier dues, tax payable and owner loans. Record repayments in the Movements tab.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1"><Label>Liability name</Label><Input value={liabilityForm.liability_name} onChange={e=>setLiabilityForm(f=>({...f,liability_name:e.target.value}))} placeholder="e.g. HDFC property loan"/></div>
          <div className="space-y-1"><Label>Type</Label><NativeSelect value={liabilityForm.liability_type} onValueChange={v=>setLiabilityForm(f=>({...f,liability_type:v}))} options={["Bank Loan","Property Loan","Vehicle Loan","Supplier Payable","Salary Payable","Tax Payable","Advance from Customer","Owner Loan","Other Liability"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Bank / party / payee</Label><Input value={liabilityForm.party_name} onChange={e=>setLiabilityForm(f=>({...f,party_name:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Initial principal (₹)</Label><Input type="number" min="0" value={liabilityForm.initial_amount} onChange={e=>setLiabilityForm(f=>({...f,initial_amount:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Current outstanding (₹)</Label><Input type="number" min="0" value={liabilityForm.outstanding_amount} onChange={e=>setLiabilityForm(f=>({...f,outstanding_amount:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Interest rate (% p.a.)</Label><Input type="number" min="0" step="0.001" value={liabilityForm.interest_rate} onChange={e=>setLiabilityForm(f=>({...f,interest_rate:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Fixed / Variable</Label><NativeSelect value={liabilityForm.fixed_variable} onValueChange={v=>setLiabilityForm(f=>({...f,fixed_variable:v}))} options={["Fixed","Variable"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Start date</Label><Input type="date" value={liabilityForm.start_date} onChange={e=>setLiabilityForm(f=>({...f,start_date:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Due date</Label><Input type="date" value={liabilityForm.due_date} onChange={e=>setLiabilityForm(f=>({...f,due_date:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Next payment date</Label><Input type="date" value={liabilityForm.next_payment_date} onChange={e=>setLiabilityForm(f=>({...f,next_payment_date:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Payment frequency</Label><NativeSelect value={liabilityForm.payment_frequency} onValueChange={v=>setLiabilityForm(f=>({...f,payment_frequency:v}))} options={["Monthly","Quarterly","Half-yearly","Yearly","One-time","As needed"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={liabilityForm.notes} onChange={e=>setLiabilityForm(f=>({...f,notes:e.target.value}))}/></div>
          <div><Button className="w-full" onClick={()=>void saveLiability()} disabled={saving}><Landmark className="mr-2 h-4 w-4"/>Record liability</Button></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Current liabilities and loans</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Liability</th><th className="p-2">Type</th><th className="p-2">Initial amount</th><th className="p-2">Outstanding</th><th className="p-2">Next payment</th><th className="p-2">Status</th></tr></thead><tbody>{liabilities.map(l=><tr key={l.id} className="border-b"><td className="p-2">{l.liability_name}<div className="text-xs text-muted-foreground">{l.party_name||""}</div></td><td className="p-2">{l.liability_type}</td><td className="p-2">{money(l.initial_amount)}</td><td className="p-2 font-semibold">{money(l.outstanding_amount)}</td><td className="p-2">{l.next_payment_date||l.due_date||"—"}</td><td className="p-2">{l.status}</td></tr>)}</tbody></table></div></CardContent></Card>
      </TabsContent>
      <TabsContent value="movements" className="space-y-3">
        <Card><CardHeader><CardTitle>Record borrowing, repayment or interest</CardTitle><p className="text-sm text-muted-foreground">A repayment reduces the outstanding balance automatically; borrowing and interest increase it.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1"><Label>Liability</Label><NativeSelect value={txnForm.liability_id} onValueChange={v=>setTxnForm(f=>({...f,liability_id:v}))} options={liabilities.map(l=>({value:l.id,label:l.liability_name+" — "+money(l.outstanding_amount)}))} placeholder="Select liability"/></div>
          <div className="space-y-1"><Label>Transaction type</Label><NativeSelect value={txnForm.transaction_type} onValueChange={v=>setTxnForm(f=>({...f,transaction_type:v}))} options={[{value:"borrowed",label:"New borrowing"},{value:"repayment",label:"Repayment"},{value:"interest",label:"Interest added"},{value:"adjustment",label:"Positive adjustment"}]}/></div>
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={txnForm.transaction_date} onChange={e=>setTxnForm(f=>({...f,transaction_date:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" min="1" value={txnForm.amount} onChange={e=>setTxnForm(f=>({...f,amount:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Payment mode</Label><NativeSelect value={txnForm.payment_mode} onValueChange={v=>setTxnForm(f=>({...f,payment_mode:v}))} options={["Cash","UPI","Bank Transfer","Card","Cheque","Non-cash"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Cash / Bank</Label><NativeSelect value={txnForm.cash_bank} onValueChange={v=>setTxnForm(f=>({...f,cash_bank:v}))} options={["Cash","Bank"].map(v=>({value:v,label:v}))}/></div>
          <div className="space-y-1"><Label>Reference</Label><Input value={txnForm.reference_number} onChange={e=>setTxnForm(f=>({...f,reference_number:e.target.value}))}/></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={txnForm.notes} onChange={e=>setTxnForm(f=>({...f,notes:e.target.value}))}/></div>
          <div className="flex items-end"><Button className="w-full" onClick={()=>void saveLiabilityTransaction()} disabled={saving}><Plus className="mr-2 h-4 w-4"/>Save movement</Button></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Liability movement history</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Liability</th><th className="p-2">Type</th><th className="p-2">Amount</th><th className="p-2">Reference</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id} className="border-b"><td className="p-2">{t.transaction_date}</td><td className="p-2">{liabilities.find(l=>l.id===t.liability_id)?.liability_name||"Liability"}</td><td className="p-2">{t.transaction_type}</td><td className="p-2">{money(t.amount)}</td><td className="p-2">{t.reference_number||"—"}</td></tr>)}</tbody></table></div></CardContent></Card>
      </TabsContent>
      <TabsContent value="import" className="space-y-3">
        <Card><CardHeader><CardTitle>Workbook fee register review</CardTitle><p className="text-sm text-muted-foreground">Rows from the uploaded workbook remain staged only. Nothing is posted as a live payment until the source, student match, and meaning of collected amount are verified.</p></CardHeader><CardContent><div className="flex flex-wrap gap-3 text-sm"><span>Rows staged: <b>{imports.length}</b></span><span>Needs review / matched: <b>{pendingImport}</b></span><span>Imported: <b>{imports.filter(i=>i.review_status==="imported").length}</b></span><span>Skipped: <b>{imports.filter(i=>i.review_status==="skipped").length}</b></span></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Rows to match and review</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Excel row / receipt</th><th className="p-2">Student in Excel</th><th className="p-2">Class / course</th><th className="p-2">Billed</th><th className="p-2">Collected</th><th className="p-2">Data warnings</th><th className="p-2">Match student</th><th className="p-2">Review</th></tr></thead><tbody>{imports.filter(i=>i.review_status!=="skipped").map(row=><tr key={row.id} className="border-b align-top"><td className="p-2 whitespace-nowrap">Row {row.source_row}<div className="text-xs text-muted-foreground">{row.source_receipt_id||"No receipt ID"}</div><div className="text-xs text-muted-foreground">{row.payment_date||"No date"}</div></td><td className="p-2">{row.student_name||"Missing name"}<div className="text-xs text-muted-foreground">{row.source_student_id||"No student ID"}</div></td><td className="p-2">{row.student_class||"—"}<div className="text-xs text-muted-foreground">{row.program||""}</div></td><td className="p-2">{row.amount_billed==null?"—":money(row.amount_billed)}</td><td className="p-2">{row.amount_collected==null?"—":money(row.amount_collected)}</td><td className="p-2 max-w-[180px] text-xs">{(row.anomalies||[]).join(", ")||"No flagged fields"}</td><td className="p-2 min-w-[220px]"><NativeSelect value={matchMap[row.id]||row.matched_student_id||""} onValueChange={v=>setMatchMap(m=>({...m,[row.id]:v}))} options={students.filter(s=>!row.student_class||s.class.toLowerCase().replace(/th|st|nd|rd/g,"").trim()===row.student_class.toLowerCase().replace(/th|st|nd|rd/g,"").replace(/ cbse| icse| ssc|igcse/g,"").trim()||s.name.toLowerCase().trim()===String(row.student_name||"").toLowerCase().trim()).map(s=>({value:s.id,label:s.name+" — "+s.class+(s.batch?" / "+s.batch:"")}))} placeholder="Select correct student"/></td><td className="p-2"><div className="flex flex-col gap-2"><Button size="sm" variant="outline" onClick={()=>void updateImport(row,"matched")}><CheckCircle2 className="mr-1 h-3 w-3"/>Save match</Button><Button size="sm" variant="ghost" onClick={()=>void updateImport(row,"skipped")}><Ban className="mr-1 h-3 w-3"/>Skip row</Button></div></td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">Matching only records the proposed student link. The workbook appears to mix balances with receipt-labelled rows and contains invalid dates and duplicate-looking entries, so posting it into live receipts needs a separate reconciliation step.</p></CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}
