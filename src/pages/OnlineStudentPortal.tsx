import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  LogOut,
  Sparkles,
  Video,
  Calendar,
  ExternalLink,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Coins,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import StudyAssistant from "@/components/StudyAssistant";
import StudentOnlineTest from "@/components/StudentOnlineTest";
import AudioSummary from "@/components/AudioSummary";

const CLASSES = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

interface OnlineStudent {
  id: string;
  student_id: string;
  user_id: string;
  name: string;
  email: string;
  class: string;
  batch: string | null;
}

interface ZoomLink {
  id: string;
  class: string;
  batch: string | null;
  subject: string;
  zoom_url: string;
  meeting_id: string | null;
  passcode: string | null;
  schedule_day: string;
  schedule_time: string;
  teacher_name: string | null;
  is_active: boolean;
}

const OnlineStudentPortal = () => {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [student, setStudent] = useState<OnlineStudent | null>(null);
  const [zoomLinks, setZoomLinks] = useState<ZoomLink[]>([]);

  // Auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedClass, setSelectedClass] = useState("10th");

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadStudentData(session.user.id);
    }
  };

  const loadStudentData = async (userId: string) => {
    const { data, error } = await supabase
      .from("online_students")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setStudent(data as OnlineStudent);
      setIsLoggedIn(true);
      await fetchZoomLinks(data.class, data.batch);
    }
  };

  const fetchZoomLinks = async (studentClass: string, studentBatch?: string | null) => {
    let query = supabase
      .from("zoom_links")
      .select("*")
      .eq("class", studentClass)
      .eq("is_active", true);
    query = studentBatch ? query.eq("batch", studentBatch) : query.is("batch", null);
    const { data } = await query.order("schedule_day");
    if (data) setZoomLinks(data as ZoomLink[]);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed");

      // Create the main academy Student record first so online learning,
      // chat history, AI usage and tests all live under the same student.
      const { data: mainStudent, error: studentError } = await supabase
        .from("students")
        .insert({
          name: name.trim(),
          email: email.trim(),
          phone: `ONLINE-${authData.user.id.slice(0, 8)}`,
          class: selectedClass,
          student_type: "online",
        })
        .select("id")
        .single();

      if (studentError || !mainStudent) throw studentError || new Error("Student profile creation failed");

      // Create online student login/profile linked to the main Student record.
      const { data: studentData, error: profileError } = await supabase
        .from("online_students")
        .insert({
          user_id: authData.user.id,
          student_id: mainStudent.id,
          name: name.trim(),
          email: email.trim(),
          class: selectedClass,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      toast({ title: "Account created! Please check your email to verify." });
      setIsSignUp(false);
    } catch (err: any) {
      toast({ title: err.message || "Signup failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await loadStudentData(authData.user.id);
    } catch (err: any) {
      toast({ title: err.message || "Login failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setStudent(null);
    setEmail("");
    setPassword("");
    setName("");
  };

  const getDayIndex = (day: string) => DAYS.indexOf(day);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // Sort zoom links: today first, then by day order
  const sortedLinks = [...zoomLinks].sort((a, b) => {
    if (a.schedule_day === today && b.schedule_day !== today) return -1;
    if (b.schedule_day === today && a.schedule_day !== today) return 1;
    return getDayIndex(a.schedule_day) - getDayIndex(b.schedule_day);
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="w-full max-w-md"
        >
          <Card className="border-primary/20 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 p-6">
              <CardHeader className="text-center space-y-4 p-0">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="flex justify-center"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-10 h-10 text-primary-foreground" />
                  </div>
                </motion.div>
                <div>
                  <CardTitle className="text-2xl">Online Student Portal</CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">
                    Ramanujan Academy — Learn from Anywhere
                  </p>
                </div>
              </CardHeader>
            </div>

            <CardContent className="p-6 space-y-4">
              <AnimatePresence mode="wait">
                {isSignUp ? (
                  <motion.form
                    key="signup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleSignUp}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your full name"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="pl-10 pr-10 h-11"
                          required
                          minLength={6}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <NativeSelect
                        value={selectedClass}
                        onValueChange={setSelectedClass}
                        options={CLASSES.map(c => ({ value: c, label: `Class ${c}` }))}
                      />
                    </div>
                    <Button className="w-full h-11" type="submit" disabled={isLoading}>
                      {isLoading ? "Creating Account..." : "Sign Up"}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <button type="button" onClick={() => setIsSignUp(false)} className="text-primary font-medium hover:underline">
                        Log In
                      </button>
                    </p>
                  </motion.form>
                ) : (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Your password"
                          className="pl-10 pr-10 h-11"
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full h-11" type="submit" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Log In"}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <button type="button" onClick={() => setIsSignUp(true)} className="text-primary font-medium hover:underline">
                        Sign Up
                      </button>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">Online Portal</h1>
                <p className="text-xs text-muted-foreground">Ramanujan Academy</p>
              </div>
            </motion.div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">
        {/* Student Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" }}
        >
          <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-primary/20 shadow-md">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/10"
                >
                  <User className="w-7 h-7 text-primary" />
                </motion.div>
                <div>
                  <h2 className="font-bold text-lg">{student?.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="w-4 h-4" />
                    <span>Class {student?.class}{student?.batch ? ` · Batch ${student.batch}` : ""}</span>
                    <Badge variant="secondary" className="text-xs">Online Student</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="timetable" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="timetable" className="flex items-center gap-1.5 py-2.5">
              <Clock className="w-4 h-4" />
              <span>Timetable</span>
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex items-center gap-1.5 py-2.5">
              <Video className="w-4 h-4" />
              <span>Classes</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-1.5 py-2.5">
              <FileText className="w-4 h-4" />
              <span>Online Test</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-1.5 py-2.5">
              <Sparkles className="w-4 h-4" />
              <span>Audio Summary</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5 py-2.5">
              <Sparkles className="w-4 h-4" />
              <span>AI Hub</span>
            </TabsTrigger>
          </TabsList>

          {/* Weekly Timetable Tab */}
          <TabsContent value="timetable" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Weekly Class Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {zoomLinks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No classes scheduled yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {DAYS.map((day) => {
                        const dayLinks = zoomLinks.filter(l => l.schedule_day === day);
                        if (dayLinks.length === 0) return null;
                        const isToday = day === today;
                        return (
                          <motion.div
                            key={day}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`rounded-xl border overflow-hidden ${isToday ? "border-primary/40 shadow-md" : ""}`}
                          >
                            <div className={`px-4 py-2 font-semibold text-sm flex items-center gap-2 ${isToday ? "bg-primary/10 text-primary" : "bg-muted/50"}`}>
                              {day}
                              {isToday && <Badge className="bg-primary text-xs">Today</Badge>}
                            </div>
                            <div className="divide-y">
                              {dayLinks
                                .sort((a, b) => a.schedule_time.localeCompare(b.schedule_time))
                                .map((link) => (
                                  <div key={link.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-16 text-xs font-mono text-muted-foreground">{link.schedule_time}</div>
                                      <div>
                                        <p className="font-medium text-sm">{link.subject}</p>
                                        {link.teacher_name && <p className="text-xs text-muted-foreground">{link.teacher_name}</p>}
                                      </div>
                                    </div>
                                    {isToday && (
                                      <Button size="sm" variant="outline" onClick={() => window.open(link.zoom_url, "_blank")} className="shrink-0 text-xs">
                                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                        Join
                                      </Button>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Today's Classes & Zoom Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedLinks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No classes scheduled yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedLinks.map((link, idx) => (
                        <motion.div
                          key={link.id}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.08, type: "spring" }}
                          className={`p-4 rounded-xl border transition-all ${
                            link.schedule_day === today
                              ? "bg-primary/5 border-primary/30 shadow-sm"
                              : "bg-background hover:border-primary/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold">{link.subject}</h3>
                                {link.schedule_day === today && (
                                  <Badge className="bg-primary text-xs">Today</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {link.schedule_day}
                                </span>
                                <span>{link.schedule_time}</span>
                                {link.teacher_name && <span>• {link.teacher_name}</span>}
                              </div>
                              {link.meeting_id && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  ID: {link.meeting_id}{link.passcode && ` | Pass: ${link.passcode}`}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => window.open(link.zoom_url, "_blank")}
                              className="shrink-0"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Join
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* RA Points Purchase */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="shadow-md border-amber-200/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <Coins className="w-5 h-5" />
                    Need More AI Points?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    You get 20 RA points per month for free. If you run out, contact your admin to purchase additional points.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border bg-amber-50/50 text-center">
                      <p className="text-2xl font-bold text-amber-600">50</p>
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="text-sm font-semibold mt-1">₹49</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-amber-50/50 text-center">
                      <p className="text-2xl font-bold text-amber-600">150</p>
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="text-sm font-semibold mt-1">₹99</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Contact admin via WhatsApp to purchase points
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Online Test Tab */}
          <TabsContent value="tests" className="space-y-4">
            {student && (
              <StudentOnlineTest
                studentId={student.student_id}
                studentClass={student.class}
              />
            )}
          </TabsContent>

          {/* Audio Summary Tab */}
          <TabsContent value="audio" className="space-y-4">
            {student && <AudioSummary studentId={student.id} />}
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4">
            {student && (
              <StudyAssistant
                studentName={student.name}
                studentId={student.id}
                studentClass={student.class}
                isOnlineStudent={true}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default OnlineStudentPortal;
