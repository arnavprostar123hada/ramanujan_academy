import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  Image as ImageIcon,
  TrendingUp,
  BarChart3,
  FileText
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

interface Student {
  id: string;
  name: string;
  class: string;
  parent_name: string | null;
  access_code: string;
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

interface Test {
  id: string;
  title: string;
  subject: string;
  class: string;
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
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if there's a stored access code
    const storedCode = localStorage.getItem("parent_access_code");
    if (storedCode) {
      setAccessCode(storedCode);
      handleLogin(storedCode);
    }
  }, []);

  const handleLogin = async (code?: string) => {
    const codeToUse = code || accessCode.trim().toUpperCase();
    if (!codeToUse) {
      toast({
        title: "Please enter access code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Find student by access code
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name, class, parent_name, access_code")
        .eq("access_code", codeToUse)
        .single();

      if (studentError || !studentData) {
        toast({
          title: "Invalid access code",
          description: "Please check your code and try again",
          variant: "destructive",
        });
        localStorage.removeItem("parent_access_code");
        setIsLoading(false);
        return;
      }

      setStudent(studentData);
      localStorage.setItem("parent_access_code", codeToUse);
      setIsLoggedIn(true);

      // Fetch announcements for this student's class
      const { data: announcementsData } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (announcementsData) {
        const filteredAnnouncements = announcementsData.filter(
          (a) => a.target_classes.length === 0 || a.target_classes.includes(studentData.class)
        );
        setAnnouncements(filteredAnnouncements);
      }

      // Fetch concerns for this student
      const { data: concernsData } = await supabase
        .from("student_concerns")
        .select("*")
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false });

      if (concernsData) {
        setConcerns(concernsData);
      }

      // Fetch messages
      const { data: messagesData } = await supabase
        .from("parent_messages")
        .select("*")
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: true });

      if (messagesData) {
        setMessages(messagesData);
      }

      // Fetch tests for this student's class
      const { data: testsData } = await supabase
        .from("tests")
        .select("*")
        .eq("class", studentData.class)
        .order("test_date", { ascending: false });

      if (testsData) {
        setTests(testsData as Test[]);
      }

      // Fetch test results for this student
      const { data: resultsData } = await supabase
        .from("test_results")
        .select("*")
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false });

      if (resultsData) {
        setTestResults(resultsData as TestResult[]);
      }
    } catch (error) {
      toast({
        title: "Error logging in",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("parent_access_code");
    setStudent(null);
    setIsLoggedIn(false);
    setAccessCode("");
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

      // Trigger notification to admin (fire and forget)
      try {
        await supabase.functions.invoke("notify-new-message", {
          body: {
            studentName: student.name,
            studentClass: student.class,
            message: data.message,
            parentPhone: "N/A",
          },
        });
      } catch (notifyError) {
        console.log("Notification sent (or logged)");
      }
    } catch (error) {
      toast({
        title: "Error sending message",
        variant: "destructive",
      });
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-primary/20">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <img src={logo} alt="Ramanujan Academy" className="w-20 h-20 rounded-full object-cover" />
              </div>
              <CardTitle className="text-2xl">Parent Portal</CardTitle>
              <p className="text-muted-foreground text-sm">
                Enter your child's access code to view announcements and communicate with teachers
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter Access Code (e.g., ABC12345)"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="text-center text-lg tracking-widest uppercase"
                  maxLength={8}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => handleLogin()}
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Access Portal"}
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h1 className="font-bold text-lg">Parent Portal</h1>
                <p className="text-sm text-muted-foreground">Ramanujan Academy</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Student Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{student?.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="w-4 h-4" />
                    <span>Class {student?.class}</span>
                    {student?.parent_name && (
                      <>
                        <span>•</span>
                        <span>Parent: {student.parent_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="tests" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tests" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Tests</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Announcements</span>
            </TabsTrigger>
            <TabsTrigger value="concerns" className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-6">
            {/* Upcoming Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
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
                      {upcomingTests.map((test) => (
                        <motion.div
                          key={test.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-lg border bg-blue-50 border-blue-200"
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
                            <Badge className="bg-blue-600 shrink-0">
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

            {/* Test Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
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
                    {testResults.map((result) => {
                      const test = tests.find(t => t.id === result.test_id);
                      if (!test) return null;
                      const percentage = Math.round((result.marks_obtained / test.max_marks) * 100);
                      const { bgColor } = getPerformanceComment(percentage);
                      
                      return (
                        <motion.div
                          key={result.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`p-4 rounded-lg border ${bgColor}`}
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
                                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
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

            {/* Performance Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
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
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
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
                    {announcements.map((announcement) => (
                      <motion.div
                        key={announcement.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 rounded-lg border bg-background"
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
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
                    {concerns.map((concern) => (
                      <motion.div
                        key={concern.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`p-4 rounded-lg border ${concern.is_resolved ? "bg-muted/50" : "bg-background"}`}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[300px] overflow-y-auto border rounded-lg p-4 space-y-3 bg-muted/30">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <p>No messages yet. Start a conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_from_parent ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.is_from_parent
                              ? "bg-primary text-primary-foreground"
                              : "bg-background border"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.is_from_parent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
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
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ParentPortal;
