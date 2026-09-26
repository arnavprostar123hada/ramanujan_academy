import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, MessageCircle, RefreshCw, Send, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type QueueItem = {
  id:string; event_key:string; recipient_name:string|null; recipient_phone:string|null;
  message:string|null; status:string; requires_approval:boolean; document_url:string|null; created_at:string;
};

type Template = { id:string; name:string; event_key:string; category:string; body:string; active:boolean; requires_approval:boolean };

export function CommunicationCenter(){
  const {toast}=useToast();
  const [queue,setQueue]=useState<QueueItem[]>([]);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [selectedTemplate,setSelectedTemplate]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  const load=async()=>{
    setLoading(true);
    const [q,t]=await Promise.all([
      supabase.from("communication_queue").select("*").order("created_at",{ascending:false}).limit(50),
      supabase.from("communication_templates").select("id,name,event_key,category,body,active,requires_approval").eq("active",true).order("name")
    ]);
    if(q.error) toast({title:"Could not load WhatsApp queue",description:q.error.message,variant:"destructive"});
    if(t.error) toast({title:"Could not load templates",description:t.error.message,variant:"destructive"});
    setQueue((q.data||[]) as QueueItem[]); setTemplates((t.data||[]) as Template[]);
    setLoading(false);
  };
  useEffect(()=>{load()},[]);

  const approve=async(item:QueueItem)=>{
    const {error}=await supabase.from("communication_queue").update({status:"approved",approved_at:new Date().toISOString()}).eq("id",item.id);
    if(error)return toast({title:"Approval failed",description:error.message,variant:"destructive"});
    toast({title:"Message approved",description:"It is ready for WhatsApp provider delivery."}); load();
  };

  const sendPlaceholder=async(item:QueueItem)=>{
    // Provider integration will use this approved queue record.
    const {error}=await supabase.from("communication_queue").update({status:"approved",approved_at:new Date().toISOString()}).eq("id",item.id);
    if(error)return toast({title:"Could not prepare message",description:error.message,variant:"destructive"});
    toast({title:"Queued for WhatsApp",description:"Connect your WhatsApp provider to perform the actual send."}); load();
  };

  const createTestMessage=async()=>{
    const t=templates.find(x=>x.id===selectedTemplate); if(!t||!message.trim()) return;
    const {error}=await supabase.from("communication_queue").insert({
      event_key:t.event_key,channel:"whatsapp",recipient_name:"Manual recipient",recipient_phone:"",
      template_id:t.id,message:message.trim(),status:t.requires_approval?"pending":"approved",requires_approval:t.requires_approval
    });
    if(error)return toast({title:"Could not queue message",description:error.message,variant:"destructive"});
    setMessage(""); toast({title:"WhatsApp message queued"}); load();
  };

  const pending=queue.filter(x=>x.status==="pending").length;
  const approved=queue.filter(x=>x.status==="approved").length;

  return <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card><CardContent className="p-4"><Bell className="w-4 h-4 mb-2 text-primary"/><div className="text-xs text-muted-foreground">Pending Approval</div><div className="text-2xl font-bold">{pending}</div></CardContent></Card>
      <Card><CardContent className="p-4"><Send className="w-4 h-4 mb-2 text-primary"/><div className="text-xs text-muted-foreground">Ready to Send</div><div className="text-2xl font-bold">{approved}</div></CardContent></Card>
      <Card><CardContent className="p-4"><MessageCircle className="w-4 h-4 mb-2 text-primary"/><div className="text-xs text-muted-foreground">WhatsApp Templates</div><div className="text-2xl font-bold">{templates.length}</div></CardContent></Card>
      <Card><CardContent className="p-4"><Settings2 className="w-4 h-4 mb-2 text-primary"/><div className="text-xs text-muted-foreground">Provider</div><div className="text-sm font-semibold mt-1">Not connected</div></CardContent></Card>
    </div>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5"/>WhatsApp Communication Center</CardTitle><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="font-medium mb-2">Communication engine is ready</div>
          <p className="text-sm text-muted-foreground">Enquiries, fee events and other academy events can create queue records here. Actual WhatsApp delivery will be connected to the approved provider without changing the CRM workflow.</p>
        </div>
        <div className="grid md:grid-cols-[260px_1fr_auto] gap-3 items-start">
          <NativeSelect value={selectedTemplate} onValueChange={v=>{setSelectedTemplate(v);const t=templates.find(x=>x.id===v);if(t)setMessage(t.body)}} options={[{value:"",label:"Select template"},...templates.map(t=>({value:t.id,label:t.name}))]}/>
          <Textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Message preview / manual message"/>
          <Button onClick={createTestMessage} disabled={!selectedTemplate||!message.trim()}><Send className="w-4 h-4 mr-2"/>Queue</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Communication Queue</CardTitle></CardHeader>
      <CardContent>
        {queue.length===0 ? <div className="py-10 text-center text-muted-foreground">No WhatsApp messages queued yet.</div> :
        <div className="space-y-3">{queue.map(item=><div key={item.id} className="border rounded-lg p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div><div className="font-medium">{item.recipient_name||"Recipient not set"}</div><div className="text-xs text-muted-foreground">{item.recipient_phone||"Phone not set"} · {item.event_key}</div></div>
            <Badge variant={item.status==="sent"?"default":item.status==="pending"?"secondary":"outline"}>{item.status}</Badge>
          </div>
          <p className="text-sm mt-3 whitespace-pre-wrap">{item.message||"No message"}</p>
          <div className="flex gap-2 mt-3">{item.status==="pending"&&<Button size="sm" onClick={()=>approve(item)}><CheckCircle2 className="w-4 h-4 mr-2"/>Approve</Button>}{item.status==="approved"&&<Button size="sm" onClick={()=>sendPlaceholder(item)}><Send className="w-4 h-4 mr-2"/>Send via WhatsApp</Button>}</div>
        </div>)}</div>}
      </CardContent>
    </Card>
  </div>;
}
