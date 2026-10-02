import { motion } from "framer-motion";
import { Award, BookOpen, Calendar, CheckCircle2, Flame, GraduationCap, LayoutDashboard, Sparkles, Target, Trophy, User, Video, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  studentName: string; studentClass: string; batch?: string | null;
  todayClasses: number; weekClasses: number; attendanceDays: number;
  onNavigate: (tab: string) => void;
}

const StudentCommandCentre = ({ studentName, studentClass, batch, todayClasses, weekClasses, attendanceDays, onNavigate }: Props) => {
  const streak = Math.max(0, Math.min(attendanceDays, 30));
  const attendanceProgress = Math.min(100, Math.round((attendanceDays / 20) * 100));
  const firstName = studentName.split(" ")[0];
  const nav = [
    { id: "overview", label: "Command Centre", icon: LayoutDashboard },
    { id: "timetable", label: "Timetable", icon: Calendar },
    { id: "classes", label: "Classes", icon: Video },
    { id: "tests", label: "Tests", icon: Target },
    { id: "ai", label: "AI Hub", icon: Sparkles },
  ];
  const achievements = [
    { title: "Academy Starter", desc: "Joined the learning journey", icon: GraduationCap, unlocked: true },
    { title: "Attendance Warrior", desc: "Build a 5-day attendance streak", icon: Flame, unlocked: streak >= 5 },
    { title: "Class Champion", desc: "Attend 10 academy days", icon: Trophy, unlocked: attendanceDays >= 10 },
    { title: "Consistency Pro", desc: "Reach 20 academy days", icon: Award, unlocked: attendanceDays >= 20 },
  ];
  return (
    <div className="space-y-5">
      <motion.section initial={{ opacity: 0, y: 20, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .55, type: "spring" }} className="student-command-shell relative overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-5 text-white shadow-2xl sm:p-7">
        <div className="student-orbit student-orbit-one" /><div className="student-orbit student-orbit-two" />
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div><Badge className="mb-4 border-white/15 bg-white/10 text-white backdrop-blur"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> STUDENT COMMAND CENTRE</Badge>
            <div className="flex items-center gap-4"><div className="student-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur"><User className="h-8 w-8 text-cyan-200" /></div>
              <div><h2 className="text-3xl font-black tracking-tight sm:text-4xl">Hey {firstName}! 👋</h2><p className="mt-1 text-sm text-white/65">Class {studentClass}{batch ? " · Batch " + batch : ""}</p></div></div>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">Your complete learning cockpit — attendance, classes, tests, progress and AI in one place.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{[[ "Today", todayClasses, Calendar ], [ "This week", weekClasses, BookOpen ], [ "Streak", streak + "d", Flame ]].map(([label, value, Icon]: any) => (
            <motion.div key={label} whileHover={{ y: -5, scale: 1.03 }} className="min-w-[88px] rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xl"><Icon className="mb-2 h-4 w-4 text-cyan-300" /><div className="text-xl font-black">{value}</div><div className="text-[11px] text-white/55">{label}</div></motion.div>))}</div>
        </div>
        <div className="relative z-10 mt-7"><div className="mb-2 flex justify-between text-xs text-white/65"><span>30-day learning momentum</span><span>{attendanceProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div initial={{ width: 0 }} animate={{ width: attendanceProgress + "%" }} transition={{ duration: 1.1, delay: .35 }} className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 shadow-[0_0_18px_rgba(34,211,238,.7)]" /></div></div>
      </motion.section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{nav.map((item, index) => (
        <motion.button key={item.id} type="button" onClick={() => onNavigate(item.id)} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: .98 }} className="student-nav-card group rounded-2xl border bg-card p-4 text-left shadow-sm">
          <item.icon className="mb-3 h-5 w-5 text-primary transition-transform group-hover:scale-125" /><span className="block text-sm font-bold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">Open workspace</span>
        </motion.button>))}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="premium-card lg:col-span-2 overflow-hidden"><CardContent className="p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progress engine</p><h3 className="mt-1 text-xl font-black">Keep your momentum 🔥</h3></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500"><Flame className="h-6 w-6" /></div></div>
          <div className="grid grid-cols-3 gap-3">{[[ "Attendance", attendanceProgress + "%", CheckCircle2 ], [ "Classes", weekClasses, BookOpen ], [ "Streak", streak + " days", Flame ]].map(([label, value, Icon]: any) => (<div key={label} className="rounded-2xl border bg-muted/30 p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>))}</div>
        </CardContent></Card>
        <Card className="premium-card"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily mission</p><h3 className="mt-1 text-xl font-black">Win the day</h3><div className="mt-5 space-y-3">{[[ "Attend today’s class", todayClasses > 0 ], [ "Review your timetable", true ], [ "Practise with AI", false ]].map(([label, done]: any) => (<div key={label} className="flex items-center gap-3 rounded-xl border p-3"><div className={"flex h-8 w-8 items-center justify-center rounded-full " + (done ? "bg-emerald-500 text-white" : "bg-muted")}>{done ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}</div><span className="text-sm font-medium">{label}</span></div>))}</div></CardContent></Card>
      </div>
      <Card className="premium-card"><CardContent className="p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Achievement vault</p><h3 className="mt-1 text-xl font-black">Your milestones</h3></div><Zap className="h-6 w-6 text-yellow-500" /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{achievements.map((item, index) => (<motion.div key={item.title} initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .08 }} whileHover={{ y: -4 }} className={"achievement-card rounded-2xl border p-4 " + (item.unlocked ? "achievement-unlocked" : "opacity-55 grayscale")}><item.icon className="h-7 w-7 text-primary" /><p className="mt-3 font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.desc}</p><Badge className="mt-3" variant={item.unlocked ? "default" : "secondary"}>{item.unlocked ? "Unlocked" : "Locked"}</Badge></motion.div>))}</div>
      </CardContent></Card>
    </div>
  );
};
export default StudentCommandCentre;