import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, RefreshCw, BookOpen, ClipboardList, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Item = {
  id: string;
  kind: "log" | "test" | "result";
  teacher_name?: string;
  student_name?: string;
  class?: string;
  subject?: string;
  title?: string;
  topic?: string;
  content?: string;
  homework?: string;
  test_date?: string;
  marks_obtained?: number;
  max_marks?: number;
  remarks?: string;
  created_at: string;
};

export function AcademicApprovalCenter() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [logs, tests, results] = await Promise.all([
      supabase.from("class_logs").select("id,teacher_id,class,subject,topic,content,homework,created_at").eq("approval_status","pending").order("created_at",{ascending:false}),
      supabase.from("tests").select("id,teacher_id,title,subject,class,test_date,max_marks,description,created_at").eq("approval_status","pending").order("created_at",{ascending:false}),
      supabase.from("test_results").select("id,test_id,student_id,marks_obtained,remarks,created_at").eq("approval_status","pending").order("created_at",{ascending:false})
    ]);

    const teacherIds = Array.from(new Set((logs.data||[]).map(x=>x.teacher_id).concat((tests.data||[]).map(x=>x.teacher_id))));
    const studentIds = Array.from(new Set((results.data||[]).map(x=>x.student_id)));
    const testIds = Array.from(new Set((results.data||[]).map(x=>x.test_id)));

    const [{data: teachers}, {data: students}, {data: resultTests}] = await Promise.all([
      teacherIds.length ? supabase.from("teachers").select("id,name").in("id",teacherIds) : Promise.resolve({data:[] as any[]}),
      studentIds.length ? supabase.from("students").select("id,name,class").in("id",studentIds) : Promise.resolve({data:[] as any[]}),
      testIds.length ? supabase.from("tests").select("id,title,subject,class,max_marks").in("id",testIds) : Promise.resolve({data:[] as any[]})
    ]);

    const teacherMap = new Map((teachers||[]).map(x=>[x.id,x.name]));
    const studentMap = new Map((students||[]).map(x=>[x.id,x]));
    const testMap = new Map((resultTests||[]).map(x=>[x.id,x]));

    const mapped: Item[] = [
      ...(logs.data||[]).map(x=>({...x,kind:"log" as const,teacher_name:teacherMap.get(x.teacher_id)})),
      ...(tests.data||[]).map(x=>({...x,kind:"test" as const,teacher_name:teacherMap.get(x.teacher_id),title:x.title})),
      ...(results.data||[]).map(x=>{
        const t=testMap.get(x.test_id);
        const s=studentMap.get(x.student_id);
        return {...x,kind:"result" as const,student_name:s?.name,class:s?.class,subject:t?.subject,title:t?.title,max_marks:t?.max_marks};
      })
    ].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());

    setItems(mapped);
    setLoading(false);
  };

  useEffect(()=>{load()},[]);

  const review = async (item: Item, action: "approved"|"rejected") => {
    setBusy(item.kind+item.id);
    const {data:{user}} = await supabase.auth.getUser();
    const table = item.kind==="log" ? "class_logs" : item.kind==="test" ? "tests" : "test_results";
    const now = new Date().toISOString();
    const {error} = await supabase.from(table).update({
      approval_status: action,
      approved_by: user?.id || null,
      approved_at: now,
      published_at: action==="approved" ? now : null
    }).eq("id",item.id);

    if (!error && action === "approved") {
      if (item.kind === "log") {
        const { data: classStudents } = await supabase.from("students").select("id,parent_id").eq("class", item.class || "");
        if (classStudents?.length) {
          await supabase.from("communications").insert(classStudents.map(s => ({
            channel: "portal",
            recipient_type: "parent",
            recipient_id: s.parent_id || null,
            student_id: s.id,
            message: "New approved class update" + (item.subject ? ": " + item.subject : "") + (item.topic ? " - " + item.topic : ""),
            status: "queued",
            sent_at: null,
            created_by: user?.id || null
          })));
        }
      } else if (item.kind === "result") {
        await supabase.from("communications").insert({
          channel: "portal",
          recipient_type: "parent",
          student_id: item.student_name ? undefined : undefined,
          message: "A new test result has been approved and published.",
          status: "queued",
          created_by: user?.id || null
        });
      }
    }
    if(error) toast({title:"Could not update approval",description:error.message,variant:"destructive"});
    else toast({title:action==="approved" ? "Approved & published" : "Rejected"});
    setBusy(null);
    load();
  };

  if(loading) return <Card><CardContent className="py-12 text-center"><RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2"/><p>Loading approvals…</p></CardContent></Card>;

  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div><h2 className="text-xl font-bold">Academic Approval Center</h2><p className="text-sm text-muted-foreground">Teacher submissions stay private until Admin/Owner approves them.</p></div>
      <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button>
    </div>
    {items.length===0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle2 className="w-10 h-10 mx-auto mb-2"/><p>No pending academic submissions.</p></CardContent></Card> :
      items.map(item=><Card key={item.kind+item.id}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {item.kind==="log" ? <BookOpen className="w-5 h-5"/> : <ClipboardList className="w-5 h-5"/>}
              <CardTitle className="text-base">{item.kind==="log" ? "Teaching Log" : item.kind==="test" ? "Test Schedule" : "Test Marks"}</CardTitle>
              <Badge variant="secondary">Pending</Badge>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1"><User className="w-3 h-3"/>{item.teacher_name || "Teacher"}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {item.kind==="log" && <><div><b>{item.class} · {item.subject || "Subject"}</b>{item.topic && <div className="text-sm">Topic: {item.topic}</div>}</div><p className="text-sm whitespace-pre-wrap">{item.content}</p>{item.homework && <p className="text-sm"><b>Homework:</b> {item.homework}</p>}</>}
          {item.kind==="test" && <><div><b>{item.title}</b><div className="text-sm text-muted-foreground">{item.class} · {item.subject} · {item.test_date} · Max {item.max_marks}</div></div>{item.content && <p className="text-sm">{item.content}</p>}</>}
          {item.kind==="result" && <><div><b>{item.student_name}</b><div className="text-sm text-muted-foreground">{item.class} · {item.subject} · {item.title}</div></div><div className="text-2xl font-bold">{item.marks_obtained}/{item.max_marks}</div>{item.remarks && <p className="text-sm">{item.remarks}</p>}</>}
          <Textarea placeholder="Optional admin note" value={reviewNote[item.kind+item.id]||""} onChange={e=>setReviewNote({...reviewNote,[item.kind+item.id]:e.target.value})}/>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy===item.kind+item.id} onClick={()=>review(item,"rejected")}><XCircle className="w-4 h-4 mr-1"/>Reject</Button>
            <Button disabled={busy===item.kind+item.id} onClick={()=>review(item,"approved")}><CheckCircle2 className="w-4 h-4 mr-1"/>Approve & Publish</Button>
          </div>
        </CardContent>
      </Card>)
    }
  </div>;
}
