import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  AlertTriangle, 
  LogOut, 
  Calendar, 
  User, 
  Send, 
  ClipboardList, 
  Upload, 
  Image as ImageIcon,
  Check,
  X,
  Loader2,
  ScanLine,
  MapPin,
  Sparkles

} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeScanner } from "@/components/QRCodeScanner";
import { GeoAttendance } from "@/components/GeoAttendance";
import TeacherAIAssistant from "@/components/TeacherAIAssistant";


interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  access_code: string;
  assigned_classes: string[];
  expected_check_in?: string | null;
  expected_check_out?: string | null;
}


interface Student {
  id: string;
  name: string;
  class: string;
  batch: string | null;
  board: string | null;
  phone: string;
}

interface ClassLog {
  id: string;
  teacher_id: string;
  class: string;
  batch: string | null;
  board: string | null;
  content: string;
  subject?: string | null;
  topic?: string | null;
  homework?: string | null;
  approval_status?: string;
  log_date: string;
  created_at: string;
}

interface StudentComplaint {
  id: string;
  teacher_id: string;
  student_id: string;
  complaint: string;
  is_sent_to_parent: boolean;
  sent_at: string | null;
  created_at: string;
  students?: Student;
}

interface Test {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  class: string;
  batch: string | null;
  board: string | null;
  test_date: string;
  max_marks: number;
  description: string | null;
  is_notified: boolean;
  approval_status?: string;
  created_at: string;
}

interface TestResult {
  id: string;
  test_id: string;
  student_id: string;
  marks_obtained: number;
  photo_url: string | null;
  remarks: string | null;
  is_notified: boolean;
  created_at: string;
}

const CLASS_OPTIONS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

const TeacherDashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classLogs, setClassLogs] = useState<ClassLog[]>([]);
  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [logContent, setLogContent] = useState("");
  const [logSubject, setLogSubject] = useState("");
  const [logTopic, setLogTopic] = useState("");
  const [logHomework, setLogHomework] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [complaintText, setComplaintText] = useState("");

  // Test form states
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [newTest, setNewTest] = useState({
    title: "",
    subject: "",
    class: "",
    batch: "",
    board: "",
    test_date: "",
    max_marks: "100",
    description: "",
  });

  // Marks entry states
  const [isEnterMarksOpen, setIsEnterMarksOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [marksEntries, setMarksEntries] = useState<{[studentId: string]: { marks: string; remarks: string; photo: File | null; photoUrl: string | null }}>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadStudent, setCurrentUploadStudent] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const handleLogin = async () => {
    if (!accessCode.trim()) {
      toast({ title: "Error", description: "Please enter your access code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .eq("access_code", accessCode.trim().toUpperCase())
      .single();

    setIsLoading(false);

    if (error || !data) {
      toast({ title: "Error", description: "Invalid access code", variant: "destructive" });
      return;
    }

    setTeacher(data);
    setIsLoggedIn(true);
    localStorage.setItem("teacher_access_code", accessCode.trim().toUpperCase());
    fetchData(data.id, data.assigned_classes || []);
  };

  const fetchData = async (teacherId: string, assignedClasses: string[]) => {
    // Fetch students for assigned classes
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, name, class, batch, board, phone")
      .in("class", assignedClasses.length > 0 ? assignedClasses : CLASS_OPTIONS)
      .order("name");
    
    if (studentsData) setStudents(studentsData);

    // Fetch class logs by this teacher
    const { data: logsData } = await supabase
      .from("class_logs")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("log_date", { ascending: false });
    
    if (logsData) setClassLogs(logsData);

    // Fetch complaints by this teacher
    const { data: complaintsData } = await supabase
      .from("student_complaints")
      .select("*, students(id, name, class)")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    
    if (complaintsData) setComplaints(complaintsData as StudentComplaint[]);

    // Fetch tests by this teacher
    const { data: testsData } = await supabase
      .from("tests")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("test_date", { ascending: false });
    
    if (testsData) setTests(testsData as Test[]);

    // Fetch test results
    const { data: resultsData } = await supabase
      .from("test_results")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (resultsData) setTestResults(resultsData as TestResult[]);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setTeacher(null);
    setAccessCode("");
    localStorage.removeItem("teacher_access_code");
  };

  const handleAddLog = async () => {
    if (!selectedClass || !selectedBatch.trim() || !selectedBoard.trim() || !logContent.trim() || !teacher) {
      toast({ title: "Error", description: "Please select Class, Batch and Board, then enter what you taught.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("class_logs").insert({
      teacher_id: teacher.id,
      class: selectedClass,
      batch: selectedBatch.trim() || null,
      board: selectedBoard.trim() || null,
      subject: logSubject.trim() || null,
      topic: logTopic.trim() || null,
      content: logContent.trim(),
      homework: logHomework.trim() || null,
      approval_status: "pending",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add class log", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Class log added successfully" });
    setLogContent("");
    setLogSubject("");
    setLogTopic("");
    setLogHomework("");
    setSelectedClass("");
    setSelectedBatch("");
    setSelectedBoard("");
    fetchData(teacher.id, teacher.assigned_classes || []);
  };

  const handleAddComplaint = async () => {
    if (!selectedStudent || !complaintText.trim() || !teacher) {
      toast({ title: "Error", description: "Please select a student and enter complaint", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("student_complaints").insert({
      teacher_id: teacher.id,
      student_id: selectedStudent,
      complaint: complaintText.trim(),
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add complaint", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Complaint submitted to admin" });
    setComplaintText("");
    setSelectedStudent("");
    fetchData(teacher.id, teacher.assigned_classes || []);
  };

  const handleAddTest = async () => {
    if (!newTest.title || !newTest.subject || !newTest.class || !newTest.batch.trim() || !newTest.board.trim() || !newTest.test_date || !teacher) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase
      .from("tests")
      .insert({
        teacher_id: teacher.id,
        title: newTest.title,
        subject: newTest.subject,
        class: newTest.class,
        batch: newTest.batch.trim() || null,
        board: newTest.board.trim() || null,
        test_date: newTest.test_date,
        max_marks: parseInt(newTest.max_marks) || 100,
        description: newTest.description || null,
        approval_status: "pending",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to create test", variant: "destructive" });
      return;
    }

    toast({ title: "Test submitted", description: "Waiting for Admin/Owner approval before publishing." });
    setNewTest({ title: "", subject: "", class: "", batch: "", board: "", test_date: "", max_marks: "100", description: "" });
    setIsAddTestOpen(false);
    fetchData(teacher.id, teacher.assigned_classes || []);
  };

  const openMarksEntry = (test: Test) => {
    setSelectedTest(test);
    // Initialize marks entries for students in this class
    const classStudents = students.filter(s => s.class === test.class && (s.batch || "") === (test.batch || "") && (s.board || "") === (test.board || ""));
    const existingResults = testResults.filter(r => r.test_id === test.id);
    
    const entries: {[studentId: string]: { marks: string; remarks: string; photo: File | null; photoUrl: string | null }} = {};
    classStudents.forEach(student => {
      const existing = existingResults.find(r => r.student_id === student.id);
      entries[student.id] = {
        marks: existing ? existing.marks_obtained.toString() : "",
        remarks: existing?.remarks || "",
        photo: null,
        photoUrl: existing?.photo_url || null,
      };
    });
    setMarksEntries(entries);
    setIsEnterMarksOpen(true);
  };

  const handlePhotoUpload = async (studentId: string, file: File) => {
    setIsUploading(true);
    setCurrentUploadStudent(studentId);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedTest?.id}/${studentId}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from("test-photos")
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("test-photos")
        .getPublicUrl(fileName);

      setMarksEntries(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], photo: file, photoUrl: publicUrl }
      }));

      toast({ title: "Photo uploaded successfully" });
    } catch (error) {
      toast({ title: "Error uploading photo", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setCurrentUploadStudent(null);
    }
  };

  const handleSaveMarks = async () => {
    if (!selectedTest || !teacher) return;

    setIsLoading(true);
    const classStudents = students.filter(s => s.class === selectedTest.class && (s.batch || "") === (selectedTest.batch || "") && (s.board || "") === (selectedTest.board || ""));
    
    for (const student of classStudents) {
      const entry = marksEntries[student.id];
      if (entry.marks) {
        const marksValue = parseFloat(entry.marks);
        
        // Upsert the result
        const { error } = await supabase
          .from("test_results")
          .upsert({
            test_id: selectedTest.id,
            student_id: student.id,
            marks_obtained: marksValue,
            photo_url: entry.photoUrl,
            remarks: entry.remarks || null,
            approval_status: "pending",
          }, {
            onConflict: 'test_id,student_id'
          });

        if (error) {
          console.error("Error saving marks for", student.name, error);
          continue;
        }

      }
    }

    toast({ title: "Marks submitted", description: "Waiting for Admin/Owner approval before publishing." });
    setIsEnterMarksOpen(false);
    setSelectedTest(null);
    fetchData(teacher.id, teacher.assigned_classes || []);
    setIsLoading(false);
  };

  // Check for stored session
  useEffect(() => {
    const storedCode = localStorage.getItem("teacher_access_code");
    if (storedCode) {
      setAccessCode(storedCode);
      supabase
        .from("teachers")
        .select("*")
        .eq("access_code", storedCode)
        .single()
        .then(({ data }) => {
          if (data) {
            setTeacher(data);
            setIsLoggedIn(true);
            fetchData(data.id, data.assigned_classes || []);
          }
        });
    }
  }, []);

  const handleQRScan = (code: string) => {
    setShowScanner(false);
    setAccessCode(code.toUpperCase());
    // Auto-login after scanning
    supabase
      .from("teachers")
      .select("*")
      .eq("access_code", code.toUpperCase())
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setTeacher(data);
          setIsLoggedIn(true);
          localStorage.setItem("teacher_access_code", code.toUpperCase());
          fetchData(data.id, data.assigned_classes || []);
          toast({ title: "Login successful!" });
        } else {
          toast({ title: "Invalid QR code", variant: "destructive" });
        }
      });
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        {showScanner && (
          <QRCodeScanner 
            onScan={handleQRScan}
            onClose={() => setShowScanner(false)}
          />
        )}
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-800">Teacher Portal</CardTitle>
            <CardDescription>Enter your access code or scan QR to login</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessCode">Access Code</Label>
              <Input
                id="accessCode"
                placeholder="Enter your teacher access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
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
              className="w-full" 
              onClick={() => setShowScanner(true)}
            >
              <ScanLine className="w-4 h-4 mr-2" />
              Scan QR Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredStudents = selectedClass && selectedClass !== "all"
    ? students.filter((s) => s.class === selectedClass && (!selectedBatch || (s.batch || "") === selectedBatch) && (!selectedBoard || (s.board || "") === selectedBoard))
    : students;

  const getTestResults = (testId: string) => {
    return testResults.filter(r => r.test_id === testId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-green-800">Welcome, {teacher?.name}</h1>
            <p className="text-sm text-muted-foreground">Teacher Dashboard</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-5">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Class Logs
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Tests
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Teacher AI</span>
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Complaints
            </TabsTrigger>
          </TabsList>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            {teacher && (
              <GeoAttendance
                teacherId={teacher.id}
                teacherName={teacher.name}
                expectedCheckIn={teacher.expected_check_in}
                expectedCheckOut={teacher.expected_check_out}
              />
            )}
          </TabsContent>


          {/* Class Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Add Class Log
                </CardTitle>
                <CardDescription>Record what you taught in class today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Class *</Label>
                    <NativeSelect
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                      placeholder="Choose a class"
                      options={(teacher?.assigned_classes?.length ? teacher.assigned_classes : CLASS_OPTIONS).map((cls) => ({
                        value: cls,
                        label: `${cls} Class`,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Batch *</Label>
                    <Input
                      value={selectedBatch}
                      onChange={(e) => setSelectedBatch(e.target.value)}
                      placeholder="e.g. Morning A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Board *</Label>
                    <NativeSelect
                      value={selectedBoard}
                      onValueChange={setSelectedBoard}
                      placeholder="Select board"
                      options={[
                        { value: "CBSE", label: "CBSE" },
                        { value: "ICSE", label: "ICSE" },
                        { value: "SSC", label: "SSC" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input placeholder="e.g. Mathematics" value={logSubject} onChange={(e) => setLogSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Topic / Chapter</Label>
                    <Input placeholder="e.g. Quadratic Equations" value={logTopic} onChange={(e) => setLogTopic(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>What did you teach today?</Label>
                  <Textarea
                    placeholder="Enter details about today's class..."
                    value={logContent}
                    onChange={(e) => setLogContent(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Homework / Practice</Label>
                  <Textarea placeholder="Homework or practice for students..." value={logHomework} onChange={(e) => setLogHomework(e.target.value)} rows={2} />
                </div>
                <Button onClick={handleAddLog} className="bg-green-600 hover:bg-green-700">
                  <Send className="w-4 h-4 mr-2" /> Submit Log
                </Button>
              </CardContent>
            </Card>

            {/* Previous Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Previous Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {classLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No class logs yet</p>
                ) : (
                  <div className="space-y-3">
                    {classLogs.map((log) => (
                      <div key={log.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-green-800">{log.class} Class{log.batch ? ` · Batch ${log.batch}` : ""}{log.board ? ` · ${log.board}` : ""}</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(log.log_date), "PPP")}
                          </span>
                        </div>
                        {log.subject && <p className="text-xs text-muted-foreground mb-1">{log.subject}{log.topic ? " · " + log.topic : ""}</p>}<p className="text-sm">{log.content}</p>{log.homework && <p className="text-xs mt-2"><b>Homework:</b> {log.homework}</p>}
                        <Badge variant={log.approval_status === "approved" ? "default" : log.approval_status === "rejected" ? "destructive" : "secondary"} className="mt-2">{log.approval_status || "pending"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" /> Tests & Results
                  </CardTitle>
                  <CardDescription>Announce tests and enter student marks</CardDescription>
                </div>
                <Button onClick={() => setIsAddTestOpen(true)} className="bg-green-600 hover:bg-green-700">
                  <ClipboardList className="w-4 h-4 mr-2" /> Add Test
                </Button>
              </CardHeader>
              <CardContent>
                {tests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tests created yet</p>
                ) : (
                  <div className="space-y-4">
                    {tests.map((test) => {
                      const results = getTestResults(test.id);
                      const classStudentsCount = students.filter(s => s.class === test.class && (s.batch || "") === (test.batch || "") && (s.board || "") === (test.board || "")).length;
                      return (
                        <div key={test.id} className="p-4 rounded-lg border bg-background hover:border-green-300 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{test.title}</h3>
                                <Badge variant="secondary">{test.subject}</Badge>
                                <Badge variant="outline">Class {test.class}{test.batch ? ` · Batch ${test.batch}` : ""}{test.board ? ` · ${test.board}` : ""}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(test.test_date), "PPP")}
                                </span>
                                <span>Max Marks: {test.max_marks}</span>
                                <span>Results: {results.length}/{classStudentsCount}</span>
                                {test.is_notified && (
                                  <Badge className="bg-green-100 text-green-700">
                                    <Check className="w-3 h-3 mr-1" />
                                    Parents Notified
                                  </Badge>
                                )}
                              </div>
                              {test.description && (
                                <p className="text-sm text-muted-foreground mt-2">{test.description}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => openMarksEntry(test)}
                              className="text-green-600 hover:bg-green-50"
                            >
                              <ClipboardList className="w-4 h-4 mr-2" />
                              Enter Marks
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="ai" className="space-y-6">
            <TeacherAIAssistant teacherName={teacher?.name} />
          </TabsContent>

          <TabsContent value="complaints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Report Student Complaint
                </CardTitle>
                <CardDescription>Submit a complaint about a student to the admin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Filter by Class</Label>
                    <NativeSelect
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                      options={[
                        { value: "all", label: "All Classes" },
                        ...(teacher?.assigned_classes?.length ? teacher.assigned_classes : CLASS_OPTIONS).map((cls) => ({
                          value: cls,
                          label: `${cls} Class`,
                        })),
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <NativeSelect
                      value={selectedStudent}
                      onValueChange={setSelectedStudent}
                      placeholder="Choose a student"
                      options={filteredStudents.map((student) => ({
                        value: student.id,
                        label: `${student.name} (${student.class})`,
                      }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Complaint Details</Label>
                  <Textarea
                    placeholder="Describe the issue..."
                    value={complaintText}
                    onChange={(e) => setComplaintText(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button onClick={handleAddComplaint} className="bg-orange-600 hover:bg-orange-700">
                  <AlertTriangle className="w-4 h-4 mr-2" /> Submit Complaint
                </Button>
              </CardContent>
            </Card>

            {/* Previous Complaints */}
            <Card>
              <CardHeader>
                <CardTitle>Your Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                {complaints.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No complaints submitted</p>
                ) : (
                  <div className="space-y-3">
                    {complaints.map((complaint) => (
                      <div key={complaint.id} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-orange-600" />
                            <span className="font-medium">
                              {complaint.students?.name} ({complaint.students?.class})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {complaint.is_sent_to_parent ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                Sent to Parent
                              </span>
                            ) : (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                Pending Review
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm">{complaint.complaint}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(complaint.created_at), "PPP 'at' p")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Test Dialog */}
      <Dialog open={isAddTestOpen} onOpenChange={setIsAddTestOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85dvh]">
          <DialogHeader>
            <DialogTitle>Create New Test</DialogTitle>
            <DialogDescription>Submit the test for Admin/Owner approval.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Test Title *</Label>
                <Input value={newTest.title} onChange={(e) => setNewTest({ ...newTest, title: e.target.value })} placeholder="e.g. Unit Test 1" />
              </div>
              <div className="space-y-1">
                <Label>Subject *</Label>
                <Input value={newTest.subject} onChange={(e) => setNewTest({ ...newTest, subject: e.target.value })} placeholder="e.g. Mathematics" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Class *</Label>
                <NativeSelect
                  value={newTest.class}
                  onValueChange={(v) => setNewTest({ ...newTest, class: v })}
                  placeholder="Select class"
                  options={(teacher?.assigned_classes?.length ? teacher.assigned_classes : CLASS_OPTIONS).map((cls) => ({ value: cls, label: `${cls} Class` }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Batch *</Label>
                <Input value={newTest.batch} onChange={(e) => setNewTest({ ...newTest, batch: e.target.value })} placeholder="Morning A" required />
              </div>
              <div className="space-y-1">
                <Label>Board *</Label>
                <Input value={newTest.board} onChange={(e) => setNewTest({ ...newTest, board: e.target.value })} placeholder="ICSE / CBSE / SSC" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Test Date *</Label>
                <Input type="date" value={newTest.test_date} onChange={(e) => setNewTest({ ...newTest, test_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Maximum Marks</Label>
                <Input type="number" value={newTest.max_marks} onChange={(e) => setNewTest({ ...newTest, max_marks: e.target.value })} placeholder="100" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description (Optional)</Label>
              <Textarea value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} placeholder="Additional details..." rows={2} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsAddTestOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddTest} className="flex-1 bg-green-600 hover:bg-green-700">Submit Test</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enter Marks Dialog */}
      <Dialog open={isEnterMarksOpen} onOpenChange={setIsEnterMarksOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Marks - {selectedTest?.title}</DialogTitle>
            <DialogDescription>
              {selectedTest?.subject} | Class {selectedTest?.class}{selectedTest?.batch ? ` | Batch ${selectedTest.batch}` : ""}{selectedTest?.board ? ` | ${selectedTest.board}` : ""} | Max Marks: {selectedTest?.max_marks}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && currentUploadStudent) {
                  handlePhotoUpload(currentUploadStudent, file);
                }
              }}
            />
            
            {selectedTest && students.filter(s => s.class === selectedTest.class && (s.batch || "") === (selectedTest.batch || "") && (s.board || "") === (selectedTest.board || "")).map((student) => (
              <div key={student.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{student.name}</span>
                  {marksEntries[student.id]?.photoUrl && (
                    <Badge variant="outline" className="text-green-600">
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Photo Attached
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Marks</Label>
                    <Input
                      type="number"
                      placeholder={`/ ${selectedTest.max_marks}`}
                      value={marksEntries[student.id]?.marks || ""}
                      onChange={(e) => setMarksEntries(prev => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], marks: e.target.value }
                      }))}
                      max={selectedTest.max_marks}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Remarks</Label>
                    <Input
                      placeholder="Optional"
                      value={marksEntries[student.id]?.remarks || ""}
                      onChange={(e) => setMarksEntries(prev => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], remarks: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Photo</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isUploading && currentUploadStudent === student.id}
                      onClick={() => {
                        setCurrentUploadStudent(student.id);
                        fileInputRef.current?.click();
                      }}
                    >
                      {isUploading && currentUploadStudent === student.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : marksEntries[student.id]?.photoUrl ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {marksEntries[student.id]?.photoUrl && (
                  <div className="flex items-center gap-2">
                    <a 
                      href={marksEntries[student.id].photoUrl!} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View uploaded photo
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => setMarksEntries(prev => ({
                        ...prev,
                        [student.id]: { ...prev[student.id], photo: null, photoUrl: null }
                      }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEnterMarksOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveMarks} className="flex-1 bg-green-600 hover:bg-green-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save & Notify Parents
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
