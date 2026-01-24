import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, AlertTriangle, LogOut, Calendar, User, Send } from "lucide-react";
import { format } from "date-fns";

interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  access_code: string;
  assigned_classes: string[];
}

interface Student {
  id: string;
  name: string;
  class: string;
}

interface ClassLog {
  id: string;
  teacher_id: string;
  class: string;
  content: string;
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

const CLASS_OPTIONS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

const TeacherDashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classLogs, setClassLogs] = useState<ClassLog[]>([]);
  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [selectedClass, setSelectedClass] = useState("");
  const [logContent, setLogContent] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [complaintText, setComplaintText] = useState("");

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
      .select("id, name, class")
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
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setTeacher(null);
    setAccessCode("");
    localStorage.removeItem("teacher_access_code");
  };

  const handleAddLog = async () => {
    if (!selectedClass || !logContent.trim() || !teacher) {
      toast({ title: "Error", description: "Please select a class and enter content", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("class_logs").insert({
      teacher_id: teacher.id,
      class: selectedClass,
      content: logContent.trim(),
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add class log", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Class log added successfully" });
    setLogContent("");
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-800">Teacher Portal</CardTitle>
            <CardDescription>Enter your access code to login</CardDescription>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredStudents = selectedClass
    ? students.filter((s) => s.class === selectedClass)
    : students;

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
        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Class Logs
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Complaints
            </TabsTrigger>
          </TabsList>

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
                    <Label>Select Class</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {(teacher?.assigned_classes?.length ? teacher.assigned_classes : CLASS_OPTIONS).map((cls) => (
                          <SelectItem key={cls} value={cls}>{cls} Class</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                          <span className="font-medium text-green-800">{log.class} Class</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(log.log_date), "PPP")}
                          </span>
                        </div>
                        <p className="text-sm">{log.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complaints Tab */}
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
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {(teacher?.assigned_classes?.length ? teacher.assigned_classes : CLASS_OPTIONS).map((cls) => (
                          <SelectItem key={cls} value={cls}>{cls} Class</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.class})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
    </div>
  );
};

export default TeacherDashboard;
