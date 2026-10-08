import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardCheck, BookOpen, Users, Plus, RefreshCw, CheckCircle2, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const classes = ["4th","5th","6th","7th","8th","9th","10th","11th","12th"];
const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

type Batch = { id:string; name:string; class_name:string; board:string|null; academic_year:string; room:string|null; capacity:number|null; teacher_name:string|null; student_count:number; sessions_last_30_days:number; active_homework:number; lessons_completed_30d:number };
type Teacher = { id:string; name:string };

export function ClassAdministration() {
  const { toast } = useToast();
  const [batches,setBatches]=useState<Batch[]>([]);
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [attendance,setAttendance]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [batch,setBatch]=useState({name:"",class_name:"",board:"CBSE",academic_year:"2026-27",room:"",capacity:"30",primary_teacher_id:""});
  const [homework,setHomework]=useState({batch_id:"",teacher_id:"",subject:"",title:"",description:"",assigned_date:new Date().toISOString().slice(0,10),due_date:""});
  const [lesson,setLesson]=useState({batch_id:"",teacher_id:"",subject:"",topic:"",objectives:"",planned_date:new Date().toISOString().slice(0,10)});
  const [session,setSession]=useState({batch_id:"",teacher_id:"",session_date:new Date().toISOString().slice(0,10),subject:"",topic:"",start_time:"",end_time:"",status:"scheduled",classwork:"",homework:""});

  const load=async()=>{
    setLoading(true);
    const [b,t,a]=await Promise.all([
      supabase.from("class_admin_dashboard").select("*").order("class_name"),
      supabase.from("teachers").select("id,name").order("name"),
      supabase.from("class_admin_attendance_summary").select("*").order("class_name")
    ]);
    if(b.error||t.error||a.error) toast({title:"Class administration load failed",description:(b.error||t.error||a.error)?.message,variant:"destructive"});
    setBatches((b.data||[]) as Batch[]); setTeachers((t.data||[]) as Teacher[]); setAttendance(a.data||[]); setLoading(false);
  };
  useEffect(()=>{void load()},[]);

  const totals=useMemo(()=>({
    students:batches.reduce((n,b)=>n+Number(b.student_count||0),0),
    sessions:batches.reduce((n,b)=>n+Number(b.sessions_last_30_days||0),0),
    homework:batches.reduce((n,b)=>n+Number(b.active_homework||0),0),
    lessons:batches.reduce((n,b)=>n+Number(b.lessons_completed_30d||0),0)
  }),[batches]);

  const addBatch=async()=>{
    if(!batch.name||!batch.class_name){toast({title:"Batch name and class are required",variant:"destructive"});return}
    const {error}=await supabase.from("class_batches").insert({
      name:batch.name,class_name:batch.class_name,board:batch.board||null,academic_year:batch.academic_year,
      room:batch.room||null,capacity:Number(batch.capacity)||null,primary_teacher_id:batch.primary_teacher_id||null
    });
    if(error) toast({title:"Could not create batch",description:error.message,variant:"destructive"});
    else {toast({title:"Batch created"});setBatch({...batch,name:"",room:""});await load();}
  };

  const addHomework=async()=>{
    if(!homework.batch_id||!homework.subject||!homework.title){toast({title:"Batch, subject and title are required",variant:"destructive"});return}
    const {error}=await supabase.from("class_homework").insert({...homework,teacher_id:homework.teacher_id||null,due_date:homework.due_date||null});
    if(error) toast({title:"Could not add homework",description:error.message,variant:"destructive"});
    else {toast({title:"Homework assigned"});setHomework({...homework,title:"",description:"",due_date:""});await load();}
  };

  const addLesson=async()=>{
    if(!lesson.batch_id||!lesson.subject||!lesson.topic){toast({title:"Batch, subject and topic are required",variant:"destructive"});return}
    const {error}=await supabase.from("class_lesson_plans").insert({...lesson,teacher_id:lesson.teacher_id||null});
    if(error) toast({title:"Could not save lesson plan",description:error.message,variant:"destructive"});
    else {toast({title:"Lesson plan saved"});setLesson({...lesson,topic:"",objectives:""});await load();}
  };

  const addSession=async()=>{
    if(!session.batch_id||!session.subject){toast({title:"Batch and subject are required",variant:"destructive"});return}
    const {error}=await supabase.from("class_sessions").insert({...session,teacher_id:session.teacher_id||null,start_time:session.start_time||null,end_time:session.end_time||null});
    if(error) toast({title:"Could not create session",description:error.message,variant:"destructive"});
    else {toast({title:"Class session created"});setSession({...session,topic:"",classwork:"",homework:""});await load();}
  };

  const batchOptions=batches.map(b=>({value:b.id,label:`${b.name} — ${b.class_name}`}));
  const teacherOptions=teachers.map(t=>({value:t.id,label:t.name}));

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div><h2 className="text-2xl font-bold">Class Administration</h2><p className="text-sm text-muted-foreground">One control centre for batches, classes, teachers, homework and academic execution.</p></div>
      <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      {[
        [Users,"Active Students",totals.students],
        [CalendarDays,"Classes Conducted / 30d",totals.sessions],
        [ClipboardCheck,"Active Homework",totals.homework],
        [BookOpen,"Lessons Completed / 30d",totals.lessons]
      ].map(([Icon,label,value]:any)=><Card key={label} className="card-elevated"><CardContent className="p-5 flex items-center gap-4"><Icon className="h-8 w-8 text-primary"/><div><p className="text-xs text-muted-foreground uppercase">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>)}
    </div>

    <Tabs defaultValue="overview">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="batches">Batches</TabsTrigger><TabsTrigger value="sessions">Class Log</TabsTrigger><TabsTrigger value="homework">Homework</TabsTrigger><TabsTrigger value="lessons">Lesson Plans</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <Card><CardHeader><CardTitle>Batch Health</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Batch</th><th>Teacher</th><th>Students</th><th>Classes 30d</th><th>Homework</th><th>Lessons 30d</th></tr></thead><tbody>{batches.map(b=><tr key={b.id} className="border-b last:border-0"><td className="py-2 font-semibold">{b.name}</td><td>{b.teacher_name||"—"}</td><td>{b.student_count}</td><td>{b.sessions_last_30_days}</td><td>{b.active_homework}</td><td>{b.lessons_completed_30d}</td></tr>)}</tbody></table></div></CardContent></Card>
      </TabsContent>

      <TabsContent value="batches"><Card><CardHeader><CardTitle>Create / Configure Batch</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
        <div><Label>Batch Name</Label><Input placeholder="10th CBSE A" value={batch.name} onChange={e=>setBatch({...batch,name:e.target.value})}/></div>
        <div><Label>Class</Label><NativeSelect options={classes.map(v=>({value:v,label:v}))} value={batch.class_name} onValueChange={v=>setBatch({...batch,class_name:v})} placeholder="Select class"/></div>
        <div><Label>Board</Label><NativeSelect options={["CBSE","ICSE","SSC","Other"].map(v=>({value:v,label:v}))} value={batch.board} onValueChange={v=>setBatch({...batch,board:v})}/></div>
        <div><Label>Academic Year</Label><Input value={batch.academic_year} onChange={e=>setBatch({...batch,academic_year:e.target.value})}/></div>
        <div><Label>Room</Label><Input value={batch.room} onChange={e=>setBatch({...batch,room:e.target.value})}/></div>
        <div><Label>Capacity</Label><Input type="number" value={batch.capacity} onChange={e=>setBatch({...batch,capacity:e.target.value})}/></div>
        <div><Label>Primary Teacher</Label><NativeSelect options={teacherOptions} value={batch.primary_teacher_id} onValueChange={v=>setBatch({...batch,primary_teacher_id:v})} placeholder="Select teacher"/></div>
        <div className="md:col-span-2 flex items-end"><Button onClick={()=>void addBatch()} className="w-full"><Plus className="mr-2 h-4 w-4"/>Create Batch</Button></div>
      </CardContent></Card></TabsContent>

      <TabsContent value="sessions"><Card><CardHeader><CardTitle>Daily Class Log</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
        <div><Label>Batch</Label><NativeSelect options={batchOptions} value={session.batch_id} onValueChange={v=>setSession({...session,batch_id:v})} placeholder="Select batch"/></div>
        <div><Label>Teacher</Label><NativeSelect options={teacherOptions} value={session.teacher_id} onValueChange={v=>setSession({...session,teacher_id:v})} placeholder="Teacher"/></div>
        <div><Label>Date</Label><Input type="date" value={session.session_date} onChange={e=>setSession({...session,session_date:e.target.value})}/></div>
        <div><Label>Subject</Label><Input value={session.subject} onChange={e=>setSession({...session,subject:e.target.value})}/></div>
        <div><Label>Topic</Label><Input value={session.topic} onChange={e=>setSession({...session,topic:e.target.value})}/></div>
        <div><Label>Status</Label><NativeSelect options={["scheduled","conducted","cancelled","rescheduled"].map(v=>({value:v,label:v}))} value={session.status} onValueChange={v=>setSession({...session,status:v})}/></div>
        <div><Label>Start</Label><Input type="time" value={session.start_time} onChange={e=>setSession({...session,start_time:e.target.value})}/></div>
        <div><Label>End</Label><Input type="time" value={session.end_time} onChange={e=>setSession({...session,end_time:e.target.value})}/></div>
        <div><Label>Classwork</Label><Textarea value={session.classwork} onChange={e=>setSession({...session,classwork:e.target.value})}/></div>
        <div className="md:col-span-3"><Label>Homework Given</Label><Textarea value={session.homework} onChange={e=>setSession({...session,homework:e.target.value})}/></div>
        <div className="md:col-span-3"><Button onClick={()=>void addSession()} className="w-full"><CheckCircle2 className="mr-2 h-4 w-4"/>Save Class Log</Button></div>
      </CardContent></Card></TabsContent>

      <TabsContent value="homework"><Card><CardHeader><CardTitle>Assign Homework</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Batch</Label><NativeSelect options={batchOptions} value={homework.batch_id} onValueChange={v=>setHomework({...homework,batch_id:v})} placeholder="Select batch"/></div>
        <div><Label>Teacher</Label><NativeSelect options={teacherOptions} value={homework.teacher_id} onValueChange={v=>setHomework({...homework,teacher_id:v})} placeholder="Teacher"/></div>
        <div><Label>Subject</Label><Input value={homework.subject} onChange={e=>setHomework({...homework,subject:e.target.value})}/></div>
        <div><Label>Title</Label><Input value={homework.title} onChange={e=>setHomework({...homework,title:e.target.value})}/></div>
        <div><Label>Assigned Date</Label><Input type="date" value={homework.assigned_date} onChange={e=>setHomework({...homework,assigned_date:e.target.value})}/></div>
        <div><Label>Due Date</Label><Input type="date" value={homework.due_date} onChange={e=>setHomework({...homework,due_date:e.target.value})}/></div>
        <div className="md:col-span-2"><Label>Description</Label><Textarea value={homework.description} onChange={e=>setHomework({...homework,description:e.target.value})}/></div>
        <div className="md:col-span-2"><Button onClick={()=>void addHomework()} className="w-full"><Plus className="mr-2 h-4 w-4"/>Assign Homework</Button></div>
      </CardContent></Card></TabsContent>

      <TabsContent value="lessons"><Card><CardHeader><CardTitle>Lesson Plan</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Batch</Label><NativeSelect options={batchOptions} value={lesson.batch_id} onValueChange={v=>setLesson({...lesson,batch_id:v})} placeholder="Select batch"/></div>
        <div><Label>Teacher</Label><NativeSelect options={teacherOptions} value={lesson.teacher_id} onValueChange={v=>setLesson({...lesson,teacher_id:v})} placeholder="Teacher"/></div>
        <div><Label>Subject</Label><Input value={lesson.subject} onChange={e=>setLesson({...lesson,subject:e.target.value})}/></div>
        <div><Label>Topic</Label><Input value={lesson.topic} onChange={e=>setLesson({...lesson,topic:e.target.value})}/></div>
        <div><Label>Planned Date</Label><Input type="date" value={lesson.planned_date} onChange={e=>setLesson({...lesson,planned_date:e.target.value})}/></div>
        <div className="md:col-span-2"><Label>Objectives</Label><Textarea value={lesson.objectives} onChange={e=>setLesson({...lesson,objectives:e.target.value})}/></div>
        <div className="md:col-span-2"><Button onClick={()=>void addLesson()} className="w-full"><BookOpen className="mr-2 h-4 w-4"/>Save Lesson Plan</Button></div>
      </CardContent></Card></TabsContent>

      <TabsContent value="attendance"><Card><CardHeader><CardTitle>30-Day Class Attendance</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Class</th><th>Marked</th><th>Present</th><th>Absent</th><th>Late</th><th>Attendance %</th></tr></thead><tbody>{attendance.map((a:any)=>{const marked=Number(a.marked_count||0),present=Number(a.present_count||0);return <tr key={a.class_name} className="border-b last:border-0"><td className="py-2 font-semibold">{a.class_name}</td><td>{marked}</td><td>{present}</td><td>{a.absent_count||0}</td><td>{a.late_count||0}</td><td>{marked?Math.round(present/marked*100):0}%</td></tr>})}</tbody></table></div></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}
