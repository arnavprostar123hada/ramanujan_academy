import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  MessageSquare, 
  AlertCircle, 
  Send, 
  User, 
  GraduationCap,
  Calendar,
  LogOut,
  ClipboardList,
  BookOpen,
  Image as ImageIcon,
  TrendingUp,
  FileText,
  ScanLine,
  Users,
  Sparkles,
  KeyRound,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";
import { PerformanceComment, PerformanceBadge, getPerformanceComment } from "@/components/PerformanceComment";
import { StudentTestAnalytics } from "@/components/TestAnalyticsChart";
import { QRCodeScanner } from "@/components/QRCodeScanner";
import { StudentComparisonChart } from "@/components/StudentComparisonChart";
import StudyAssistant from "@/components/StudyAssistant";
import { Video, ExternalLink, CheckCircle2, XCircle, Clock as ClockIcon } from "lucide-react";

interface Student {
  id: string;
  name: string;
  class: string;
  batch: string | null;
  board: string | null;
  parent_name: string | null;
  access_code: string;
  student_type?: string;
}

interface ZoomLink {
  id: string;
  class: string;
  subject: string;
  zoom_url: string;
  meeting_id: string | null;
  passcode: string | null;
  schedule_day: string;
  schedule_time: string;
  teacher_name: string | null;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string;
  status: string;
  remarks: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_classes: string[];
  created_at: string;
}

interface Concern {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
}

interface Message {
  id: string;
  message: string;
  is_from_parent: boolean;
  created_at: string;
}

interface ClassLog {
  id: string;
  class: string;
  batch: string | null;
  board: string | null;
  subject: string | null;
  topic: string | null;
  content: string;
  homework: string | null;
  log_date: string;
  approval_status: string;
}

interface Test {
  id: string;
  title: string;
  subject: string;
  class: string;
  batch: string | null;
  board: string | null;
  test_date: string;
  max_marks: number;
  description: string | null;
  is_notified: boolean;
}

interface TestResult {
  id: string;
  test_id: string;
  student_id: string;
  marks_obtained: number;
  photo_url: string | null;
  remarks: string | null;
}

const ParentPortal = () => {
  const { toast } = useToast();
  const [accessCode, setAccessCode] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [classLogs, setClassLogs] = useState<ClassLog[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [allClassResults, setAllClassResults] = useState<TestResult[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Username/Phone login state
  const [loginMode, setLoginMode] = useState<"code" | "phone">("code");
  const [studentName, setStudentName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [zoomLinks, setZoomLinks] = useState<ZoomLink[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const storedCode = localStorage.getItem("parent_access_code");
    if (storedCode) {
      setAccessCode(storedCode);
      handleLogin(storedCode);
    }
  }, []);

  const fetchStudentData = async (studentData: Student) => {
    setStudent(studentData);
    setIsLoggedIn(true);

    // Fetch announcements
    const { data: announcementsData } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (announcementsData) {
      const filtered = announcementsData.filter(
        (a) => a.target_classes.length === 0 || a.target_classes.includes(studentData.class)
      );
      setAnnouncements(filtered);
    }

    // Fetch concerns
    const { data: concernsData } = await supabase
      .from("student_concerns")
      .select("*")
      .eq("student_id", studentData.id)
      .order("created_at", { ascending: false });
    if (concernsData) setConcerns(concernsData);

    // Fetch messages
    const { data: messagesData } = await supabase
      .from("parent_messages")
      .select("*")
      .eq("student_id", studentData.id)
      .order("created_at", { ascending: true });
    if (messagesData) setMessages(messagesData);

    // Fetch tests
    let testsQuery = supabase
      .from("tests")
      .select("*")
      .eq("class", studentData.class)
      .eq("approval_status", "approved");
    testsQuery = studentData.batch ? testsQuery.eq("batch", studentData.batch) : testsQuery.is("batch", null);
    testsQuery = studentData.board ? testsQuery.eq("board", studentData.board) : testsQuery.is("board", null);
    const { data: testsData } = await testsQuery.order("test_date", { ascending: false });
    if (testsData) setTests(testsData as Test[]);

    // Fetch approved teaching logs for this batch
    let logsQuery = supabase
      .from("class_logs")
      .select("id,class,batch,board,subject,topic,content,homework,log_date,approval_status")
      .eq("class", studentData.class)
      .eq("approval_status", "approved");
    logsQuery = studentData.batch ? logsQuery.eq("batch", studentData.batch) : logsQuery.is("batch", null);
    logsQuery = studentData.board ? logsQuery.eq("board", studentData.board) : logsQuery.is("board", null);
    const { data: logsData } = await logsQuery.order("log_date", { ascending: false }).limit(30);
    if (logsData) setClassLogs(logsData as ClassLog[]);

    // Fetch test results
    const { data: resultsData } = await supabase
      .from("test_results")
      .select("*")
      .eq("student_id", studentData.id)
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false });
    if (resultsData) setTestResults(resultsData as TestResult[]);

    // Fetch class results for comparison
    const classTestIds = testsData?.map(t => t.id) || [];
    if (classTestIds.length > 0) {
      const { data: allResultsData } = await supabase
        .from("test_results")
        .select("*")
        .in("test_id", classTestIds)
        .eq("approval_status", "approved");
      if (allResultsData) setAllClassResults(allResultsData as TestResult[]);
    }

    // Fetch zoom links for online students
    if (studentData.student_type === "online") {
      const { data: zoomData } = await supabase
        .from("zoom_links")
        .select("*")
        .eq("class", studentData.class)
        .eq("is_active", true)
        .order("schedule_day");
      if (zoomData) setZoomLinks(zoomData as ZoomLink[]);
    }

    // Fetch attendance
    const { data: attendanceData } = await supabase
      .from("student_attendance")
      .select("*")
      .eq("student_id", studentData.id)
      .order("attendance_date", { ascending: false });
    if (attendanceData) setAttendance(attendanceData as AttendanceRecord[]);
  };

  const handleLogin = async (code?: string) => {
    const codeToUse = code || accessCode.trim().toUpperCase();
    if (!codeToUse) {
      toast({ title: "Please enter access code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: studentData, error } = await supabase
        .from("students")
        .select("id, name, class, batch, parent_name, access_code, student_type")
        .eq("access_code", codeToUse)
        .single();

      if (error || !studentData) {
        toast({ title: "Invalid access code", description: "Please check your code and try again", variant: "destructive" });
        localStorage.removeItem("parent_access_code");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("parent_access_code", codeToUse);
      await fetchStudentData(studentData);
    } catch {
      toast({ title: "Error logging in", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!studentName.trim() || !phoneNumber.trim()) {
      toast({ title: "Please enter student name and phone number", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: studentData, error } = await supabase
        .from("students")
        .select("id, name, class, batch, parent_name, access_code, student_type")
        .ilike("name", studentName.trim())
        .eq("phone", phoneNumber.trim())
        .single();

      if (error || !studentData) {
        toast({ title: "Student not found", description: "Please check the name and phone number", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      localStorage.setItem("parent_access_code", studentData.access_code);
      await fetchStudentData(studentData);
    } catch {
      toast({ title: "Error logging in", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("parent_access_code");
    setStudent(null);
    setIsLoggedIn(false);
    setAccessCode("");
    setStudentName("");
    setPhoneNumber("");
    setAnnouncements([]);
    setConcerns([]);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!student || !newMessage.trim()) return;

    try {
      const { data, error } = await supabase
        .from("parent_messages")
        .insert({
          student_id: student.id,
          message: newMessage.trim(),
          is_from_parent: true,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, data]);
      setNewMessage("");
      toast({ title: "Message sent successfully" });

      try {
        await supabase.functions.invoke("notify-new-message", {
          body: {
            studentName: student.name,
            studentClass: student.class,
            message: data.message,
            parentPhone: "N/A",
          },
        });
      } catch {
        console.log("Notification sent (or logged)");
      }
    } catch {
      toast({ title: "Error sending message", variant: "destructive" });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const attendancePresent = attendance.filter((record) => record.status.toLowerCase() === "present").length;
  const attendanceRate = attendance.length ? Math.round((attendancePresent / attendance.length) * 100) : 0;
  const averageScore = testResults.length
    ? Math.round(
        testResults.reduce((sum, result) => {
          const test = tests.find((item) => item.id === result.test_id);
          return sum + (test ? (result.marks_obtained / test.max_marks) * 100 : 0);
        }, 0) / testResults.filter((result) => tests.some((item) => item.id === result.test_id)).length
      )
    : 0;
  const upcomingTestCount = tests.filter((test) => new Date(test.test_date) >= new Date()).length;

  const handleQRScan = (code: string) => {
    setShowScanner(false);
    setAccessCode(code.toUpperCase());
    handleLogin(code.toUpperCase());
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        {showScanner && (
          <QRCodeScanner 
            onScan={handleQRScan}
            onClose={() => setShowScanner(false)}
          />
        )}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="w-full max-w-md"
        >
          <Card className="border-primary/20 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 p-6">
              <CardHeader className="text-center space-y-4 p-0">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="flex justify-center"
                >
                  <div className="relative">
                    <img src={logo} alt="Ramanujan Academy" className="w-20 h-20 rounded-full object-cover ring-4 ring-primary/20 shadow-lg" />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-primary-foreground" />
                    </motion.div>
                  </div>
                </motion.div>
                <div>
                  <CardTitle className="text-2xl">Parent Portal</CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">
                    Ramanujan Academy
                  </p>
                </div>
              </CardHeader>
            </div>

            <CardContent className="p-6 space-y-4">
              {/* Login Mode Toggle */}
              <div className="flex rounded-lg border bg-muted/50 p-1">
                <button
                  onClick={() => setLoginMode("code")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                    loginMode === "code" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <KeyRound className="w-4 h-4" /> Access Code
                </button>
                <button
                  onClick={() => setLoginMode("phone")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                    loginMode === "phone" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Phone className="w-4 h-4" /> Name & Phone
                </button>
              </div>

              <AnimatePresence mode="wait">
                {loginMode === "code" ? (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-3"
                  >
                    <Input
                      placeholder="Enter Access Code (e.g., ABC12345)"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      className="text-center text-lg tracking-widest uppercase h-12"
                      maxLength={8}
                    />
                    <Button 
                      className="w-full h-11" 
                      onClick={() => handleLogin()}
                      disabled={isLoading}
                    >
                      {isLoading ? "Verifying..." : "Access Portal"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <Input
                      placeholder="Student's Full Name"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="h-11"
                    />
                    <Input
                      placeholder="Registered Phone Number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-11"
                      type="tel"
                    />
                    <Button 
                      className="w-full h-11" 
                      onClick={handlePhoneLogin}
                      disabled={isLoading}
                    >
                      {isLoading ? "Verifying..." : "Login with Phone"}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              <Button 
                variant="outline"
                className="w-full h-11" 
                onClick={() => setShowScanner(true)}
              >
                <ScanLine className="w-4 h-4 mr-2" />
                Scan QR Code
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Access code was provided when your child was registered
              </p>
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
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
              <div>
                <h1 className="font-bold text-lg leading-tight">Parent Portal</h1>
                <p className="text-xs text-muted-foreground">Ramanujan Academy</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
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
        >
          <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-primary/20 shadow-md">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/10"
                >
                  <User className="w-7 h-7 text-primary" />
                </motion.div>
                <div>
                  <h2 className="font-bold text-lg">{student?.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="w-4 h-4" />
                    <span>Class {student?.class}{student?.batch ? ` · Batch ${student.batch}` : ""}{student?.board ? ` · ${student.board}` : ""}</span>
                    {student?.parent_name && (
                      <>
                        <span className="text-muted">•</span>
                        <span>Parent: {student.parent_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Parent command centre */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground shadow-xl"
        >
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-primary-foreground/75">Parent Command Centre</p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Your child's learning at a glance</h2>
                <p className="mt-2 text-sm text-primary-foreground/75">
                  Attendance, tests, classroom updates and communication in one place.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { label: "Attendance", value: attendance.length ? `${attendanceRate}%` : "—", icon: CheckCircle2 },
                  { label: "Avg. score", value: testResults.length ? `${averageScore}%` : "—", icon: TrendingUp },
                  { label: "Upcoming tests", value: String(upcomingTestCount), icon: ClipboardList },
                ].map((item) => (
                  <div key={item.label} className="min-w-[90px] rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                    <item.icon className="mb-2 h-4 w-4 text-primary-foreground/80" />
                    <p className="text-lg font-bold">{item.value}</p>
                    <p className="text-[11px] text-primary-foreground/70">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Academic updates", value: classLogs.length, icon: BookOpen, tab: "updates" },
            { label: "New announcements", value: announcements.length, icon: Bell, tab: "announcements" },
            { label: "Open concerns", value: concerns.filter((item) => !item.is_resolved).length, icon: AlertCircle, tab: "concerns" },
          ].map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => document.querySelector<HTMLButtonElement>(`[data-state][value="${item.tab}"]`)?.click()}
              className="group rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value} available</p>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="updates" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm"><Sparkles className="w-4 h-4" /><span>Overview</span></TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm"><BookOpen className="w-4 h-4" /><span>Updates</span></TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
              <ClipboardList className="w-4 h-4" />
              <span>Tests</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Attend.</span>
            </TabsTrigger>
            {student?.student_type === "online" && (
              <TabsTrigger value="zoom" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
                <Video className="w-4 h-4" />
                <span>Classes</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="announcements" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
              <Bell className="w-4 h-4" />
              <span>News</span>
            </TabsTrigger>
            <TabsTrigger value="concerns" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Notes</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-0.5 py-2 px-2 text-[10px] sm:text-sm">
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="shadow-md">
              <CardHeader><CardTitle>Parent Overview</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Attendance</p><p className="mt-1 text-2xl font-bold">{attendance.length ? `${attendanceRate}%` : "No data"}</p></div>
                <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Average test score</p><p className="mt-1 text-2xl font-bold">{testResults.length ? `${averageScore}%` : "No results"}</p></div>
                <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Class updates</p><p className="mt-1 text-2xl font-bold">{classLogs.length}</p></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="updates" className="space-y-4">
            <Card><CardHeader><CardTitle>Approved Class Updates</CardTitle></CardHeader><CardContent className="space-y-3">{classLogs.length ? classLogs.map(log => <div key={log.id} className="border rounded-lg p-4"><div className="flex justify-between gap-3"><div><b>{log.subject || "Class Update"}</b>{log.topic && <div className="text-sm text-muted-foreground">{log.topic}</div>}</div><span className="text-xs text-muted-foreground">{new Date(log.log_date).toLocaleDateString("en-IN")}</span></div><p className="text-sm mt-2 whitespace-pre-wrap">{log.content}</p>{log.homework && <p className="text-sm mt-2"><b>Homework:</b> {log.homework}</p>}</div>) : <p className="text-muted-foreground text-sm">No approved class updates yet.</p>}</CardContent></Card>
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-6">
            {/* Upcoming Tests */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Upcoming Tests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const upcomingTests = tests.filter(t => new Date(t.test_date) >= new Date());
                    if (upcomingTests.length === 0) {
                      return (
                        <div className="text-center py-6 text-muted-foreground">
                          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p>No upcoming tests scheduled</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        {upcomingTests.map((test, idx) => (
                          <motion.div
                            key={test.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-4 rounded-xl border bg-primary/5 border-primary/20"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold">{test.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary">{test.subject}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    Max: {test.max_marks} marks
                                  </span>
                                </div>
                                {test.description && (
                                  <p className="text-sm text-muted-foreground mt-2">{test.description}</p>
                                )}
                              </div>
                              <Badge className="bg-primary shrink-0">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(test.test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </Badge>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>

            {/* Test Results */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Test Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {testResults.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>No test results yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {testResults.map((result, idx) => {
                        const test = tests.find(t => t.id === result.test_id);
                        if (!test) return null;
                        const percentage = Math.round((result.marks_obtained / test.max_marks) * 100);
                        const { bgColor } = getPerformanceComment(percentage);
                        
                        return (
                          <motion.div
                            key={result.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`p-4 rounded-xl border shadow-sm ${bgColor}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <h3 className="font-semibold">{test.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary">{test.subject}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(test.test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold">{result.marks_obtained}<span className="text-base font-normal text-muted-foreground">/{test.max_marks}</span></p>
                                <PerformanceBadge percentage={percentage} />
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <PerformanceComment percentage={percentage} size="sm" />
                              {result.photo_url && (
                                <a 
                                  href={result.photo_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                  View Answer Sheet
                                </a>
                              )}
                            </div>
                            
                            {result.remarks && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                Teacher's remark: {result.remarks}
                              </p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance Analytics */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Performance Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {student && (
                    <StudentTestAnalytics 
                      studentId={student.id}
                      tests={tests}
                      testResults={testResults}
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* AI Study Assistant Tab */}
          <TabsContent value="ai" className="space-y-4">
            {student && <StudyAssistant studentName={student.name} studentId={student.id} studentClass={student.class} parentAccessCode={accessCode} />}
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            {student && (
              <StudentComparisonChart
                studentId={student.id}
                studentName={student.name}
                studentClass={student.class}
                tests={tests}
                testResults={allClassResults}
              />
            )}
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {announcements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No announcements yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((announcement, idx) => (
                      <motion.div
                        key={announcement.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 rounded-xl border bg-background shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold">{announcement.title}</h3>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(announcement.created_at)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {announcement.content}
                        </p>
                        {announcement.target_classes.length > 0 && (
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {announcement.target_classes.map((cls) => (
                              <Badge key={cls} variant="outline" className="text-xs">
                                Class {cls}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Concerns Tab */}
          <TabsContent value="concerns" className="space-y-4">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  Notes from Teachers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {concerns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No notes from teachers yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {concerns.map((concern, idx) => (
                      <motion.div
                        key={concern.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-4 rounded-xl border shadow-sm ${concern.is_resolved ? "bg-muted/50" : "bg-background"}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{concern.title}</h3>
                            {concern.is_resolved && (
                              <Badge variant="default" className="bg-green-500 text-xs">
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(concern.created_at)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {concern.content}
                        </p>
                        {concern.resolved_at && (
                          <p className="text-xs text-green-600 mt-2">
                            Resolved on {formatDate(concern.resolved_at)}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[300px] overflow-y-auto border rounded-xl p-4 space-y-3 bg-muted/20">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <p>No messages yet. Start a conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={`flex ${msg.is_from_parent ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.is_from_parent
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-background border shadow-sm rounded-bl-sm"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.is_from_parent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()} className="shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-4">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Attendance Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No attendance records available yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                        <p className="text-2xl font-bold text-green-600">{attendance.filter(a => a.status === "present").length}</p>
                        <p className="text-xs text-green-700">Present</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                        <p className="text-2xl font-bold text-red-600">{attendance.filter(a => a.status === "absent").length}</p>
                        <p className="text-xs text-red-700">Absent</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <p className="text-2xl font-bold text-amber-600">{attendance.filter(a => a.status === "half-day").length}</p>
                        <p className="text-xs text-amber-700">Half Day</p>
                      </div>
                    </div>
                    {/* Records */}
                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                      {attendance.map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            {record.status === "present" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                            {record.status === "absent" && <XCircle className="w-5 h-5 text-red-500" />}
                            {record.status === "half-day" && <ClockIcon className="w-5 h-5 text-amber-500" />}
                            <div>
                              <p className="text-sm font-medium">
                                {new Date(record.attendance_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                              </p>
                              {record.remarks && <p className="text-xs text-muted-foreground">{record.remarks}</p>}
                            </div>
                          </div>
                          <Badge variant={record.status === "present" ? "default" : record.status === "absent" ? "destructive" : "secondary"} className="capitalize text-xs">
                            {record.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zoom Classes Tab (online students only) */}
          {student?.student_type === "online" && (
            <TabsContent value="zoom" className="space-y-4">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Online Class Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {zoomLinks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No online classes scheduled</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {zoomLinks.map((link, idx) => {
                        const isToday = link.schedule_day === new Date().toLocaleDateString("en-US", { weekday: "long" });
                        return (
                          <motion.div
                            key={link.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`p-4 rounded-xl border ${isToday ? "bg-primary/5 border-primary/30" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-sm">{link.subject}</h3>
                                  {isToday && <Badge className="bg-primary text-xs">Today</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {link.schedule_day} • {link.schedule_time}
                                  {link.teacher_name && ` • ${link.teacher_name}`}
                                </p>
                                {link.meeting_id && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    ID: {link.meeting_id}{link.passcode && ` | Pass: ${link.passcode}`}
                                  </p>
                                )}
                              </div>
                              <Button size="sm" onClick={() => window.open(link.zoom_url, "_blank")} className="shrink-0">
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                Join
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ParentPortal;
