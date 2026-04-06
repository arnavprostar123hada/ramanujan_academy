import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { 
  Users, 
  FileText, 
  Eye, 
  LogOut, 
  RefreshCw,
  Mail,
  Phone as PhoneIcon,
  Calendar,
  CheckCircle,
  Circle,
  GraduationCap,
  Plus,
  IndianRupee,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Bell,
  MessageSquare,
  Send,
  Copy,
  Key,
  FileCheck,
  StickyNote,
  BookOpen,
  UserCheck,
  ClipboardList,
  Image as ImageIcon,
  BarChart3,
  History,
  QrCode,
  Download,
  List,
  CalendarDays,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";
import { TestAnalyticsChart } from "@/components/TestAnalyticsChart";
import { PerformanceComment, PerformanceBadge, getPerformanceComment } from "@/components/PerformanceComment";
import { AccessCodeQR } from "@/components/AccessCodeQR";
import { ClassLogsCalendar } from "@/components/ClassLogsCalendar";
import { EnquiryManagement } from "@/components/admin/EnquiryManagement";
import { TeacherSalaryManagement } from "@/components/admin/TeacherSalaryManagement";
import OnlineTestManagement from "@/components/admin/OnlineTestManagement";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  class_interested: string | null;
  created_at: string;
  is_read: boolean;
}

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  class: string;
  parent_name: string | null;
  created_at: string;
  access_code: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_classes: string[];
  created_at: string;
}

interface StudentConcern {
  id: string;
  student_id: string;
  title: string;
  content: string;
  created_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
}

interface ParentMessage {
  id: string;
  student_id: string;
  message: string;
  is_from_parent: boolean;
  is_read: boolean;
  created_at: string;
}

interface StudentPayment {
  id: string;
  student_id: string;
  amount: number;
  month: string;
  year: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  access_code: string;
  assigned_classes: string[];
  created_at: string;
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
}

interface VisitStats {
  total: number;
  today: number;
  thisWeek: number;
}

interface Test {
  id: string;
  teacher_id: string | null;
  title: string;
  subject: string;
  class: string;
  test_date: string;
  max_marks: number;
  description: string | null;
  is_notified: boolean;
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

interface Enquiry {
  id: string;
  name: string;
  class: string;
  board: string;
  date_of_birth: string | null;
  gender: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  parent_occupation: string | null;
  previous_school: string | null;
  previous_percentage: number | null;
  strong_subjects: string[] | null;
  weak_subjects: string[] | null;
  academic_notes: string | null;
  source: string | null;
  status: string;
  followup_date: string | null;
  notes: string | null;
  created_at: string;
  promoted_at: string | null;
  promoted_student_id: string | null;
}

const UPI_ID = "jadhavfivestar-3@okicici";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const CLASSES = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studentConcerns, setStudentConcerns] = useState<StudentConcern[]>([]);
  const [isAccessCodeDialogOpen, setIsAccessCodeDialogOpen] = useState(false);
  const [parentMessages, setParentMessages] = useState<ParentMessage[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classLogs, setClassLogs] = useState<ClassLog[]>([]);
  const [studentComplaints, setStudentComplaints] = useState<StudentComplaint[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [visitStats, setVisitStats] = useState<VisitStats>({ total: 0, today: 0, thisWeek: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] = useState(false);
  const [isAddConcernOpen, setIsAddConcernOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isEditTeacherOpen, setIsEditTeacherOpen] = useState(false);
  const [isTeacherCodeDialogOpen, setIsTeacherCodeDialogOpen] = useState(false);
  const [isTestDetailsOpen, setIsTestDetailsOpen] = useState(false);
  const [isEditTestOpen, setIsEditTestOpen] = useState(false);
  const [selectedTestForDetails, setSelectedTestForDetails] = useState<Test | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newlyAddedTeacher, setNewlyAddedTeacher] = useState<Teacher | null>(null);
  const [newlyAddedStudent, setNewlyAddedStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("500");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [classLogsFilter, setClassLogsFilter] = useState<string>("all");
  const [classLogsTeacherFilter, setClassLogsTeacherFilter] = useState<string>("all");
  const [classLogsViewMode, setClassLogsViewMode] = useState<"list" | "calendar">("list");

  // New announcement form state
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    target_classes: [] as string[],
  });

  // New concern form state
  const [newConcern, setNewConcern] = useState({
    title: "",
    content: "",
  });

  // Reply message state
  const [replyMessage, setReplyMessage] = useState("");

  // New student form state
  const [newStudent, setNewStudent] = useState({
    name: "",
    email: "",
    phone: "",
    class: "",
    parent_name: "",
  });

  // Edit student form state
  const [editStudent, setEditStudent] = useState({
    name: "",
    email: "",
    phone: "",
    class: "",
    parent_name: "",
  });

  // New teacher form state
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    email: "",
    phone: "",
    assigned_classes: [] as string[],
  });

  // Edit teacher form state
  const [editTeacher, setEditTeacher] = useState({
    name: "",
    email: "",
    phone: "",
    assigned_classes: [] as string[],
  });

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin");
      return;
    }

    // Verify admin role
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error || !roles) {
      await supabase.auth.signOut();
      navigate("/admin");
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });

      if (!studentsError && studentsData) {
        setStudents(studentsData as Student[]);
      }

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("student_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (!paymentsError && paymentsData) {
        setPayments(paymentsData as StudentPayment[]);
      }

      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (announcementsData) {
        setAnnouncements(announcementsData as Announcement[]);
      }

      // Fetch student concerns
      const { data: concernsData } = await supabase
        .from("student_concerns")
        .select("*")
        .order("created_at", { ascending: false });

      if (concernsData) {
        setStudentConcerns(concernsData as StudentConcern[]);
      }

      // Fetch parent messages
      const { data: messagesData } = await supabase
        .from("parent_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (messagesData) {
        setParentMessages(messagesData as ParentMessage[]);
      }

      // Fetch teachers
      const { data: teachersData } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: false });

      if (teachersData) {
        setTeachers(teachersData as Teacher[]);
      }

      // Fetch class logs
      const { data: logsData } = await supabase
        .from("class_logs")
        .select("*")
        .order("log_date", { ascending: false });

      if (logsData) {
        setClassLogs(logsData as ClassLog[]);
      }

      // Fetch student complaints
      const { data: complaintsData } = await supabase
        .from("student_complaints")
        .select("*")
        .order("created_at", { ascending: false });

      if (complaintsData) {
        setStudentComplaints(complaintsData as StudentComplaint[]);
      }

      // Fetch tests
      const { data: testsData } = await supabase
        .from("tests")
        .select("*")
        .order("test_date", { ascending: false });

      if (testsData) {
        setTests(testsData as Test[]);
      }

      // Fetch test results
      const { data: testResultsData } = await supabase
        .from("test_results")
        .select("*")
        .order("created_at", { ascending: false });

      if (testResultsData) {
        setTestResults(testResultsData as TestResult[]);
      }

      // Fetch enquiries
      const { data: enquiriesData } = await supabase
        .from("enquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (enquiriesData) {
        setEnquiries(enquiriesData as Enquiry[]);
      }

      // Fetch visit stats
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.setDate(now.getDate() - 7)).toISOString();

      const { count: totalVisits } = await supabase
        .from("page_visits")
        .select("*", { count: "exact", head: true });

      const { count: todayVisits } = await supabase
        .from("page_visits")
        .select("*", { count: "exact", head: true })
        .gte("visited_at", startOfDay);

      const { count: weekVisits } = await supabase
        .from("page_visits")
        .select("*", { count: "exact", head: true })
        .gte("visited_at", startOfWeek);

      setVisitStats({
        total: totalVisits || 0,
        today: todayVisits || 0,
        thisWeek: weekVisits || 0,
      });
    } catch (error) {
      toast({
        title: "Error fetching data",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("contact_submissions")
        .update({ is_read: true })
        .eq("id", id);
      
      setSubmissions(submissions.map(s => 
        s.id === id ? { ...s, is_read: true } : s
      ));
    } catch (error) {
      toast({
        title: "Error updating",
        variant: "destructive",
      });
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newStudent.name || !newStudent.phone || !newStudent.class) {
      toast({
        title: "Missing fields",
        description: "Please fill name, phone, and class",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .insert({
          name: newStudent.name,
          email: newStudent.email || null,
          phone: newStudent.phone,
          class: newStudent.class,
          parent_name: newStudent.parent_name || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const addedStudent = data as Student;
      setStudents([addedStudent, ...students]);
      setNewStudent({ name: "", email: "", phone: "", class: "", parent_name: "" });
      setIsAddStudentOpen(false);
      setNewlyAddedStudent(addedStudent);
    } catch (error) {
      toast({
        title: "Error adding student",
        variant: "destructive",
      });
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast({
        title: "Missing fields",
        description: "Please fill title and content",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          target_classes: newAnnouncement.target_classes,
        } as any)
        .select()
        .single();

      if (error) throw error;

      setAnnouncements([data as Announcement, ...announcements]);
      setNewAnnouncement({ title: "", content: "", target_classes: [] });
      setIsAddAnnouncementOpen(false);
      toast({ title: "Announcement created successfully" });
    } catch (error) {
      toast({
        title: "Error creating announcement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAnnouncements(announcements.filter(a => a.id !== id));
      toast({ title: "Announcement deleted successfully" });
    } catch (error) {
      toast({
        title: "Error deleting announcement",
        variant: "destructive",
      });
    }
  };

  const handleAddConcern = async () => {
    if (!selectedStudent || !newConcern.title || !newConcern.content) {
      toast({
        title: "Missing fields",
        description: "Please fill title and content",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("student_concerns")
        .insert({
          student_id: selectedStudent.id,
          title: newConcern.title,
          content: newConcern.content,
        } as any)
        .select()
        .single();

      if (error) throw error;

      setStudentConcerns([data as StudentConcern, ...studentConcerns]);
      setNewConcern({ title: "", content: "" });
      setIsAddConcernOpen(false);
      setSelectedStudent(null);
      toast({ title: "Note added successfully" });
    } catch (error) {
      toast({
        title: "Error adding note",
        variant: "destructive",
      });
    }
  };

  const handleMarkConcernResolved = async (concernId: string) => {
    try {
      const { error } = await supabase
        .from("student_concerns")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", concernId);

      if (error) throw error;

      setStudentConcerns(studentConcerns.map(c =>
        c.id === concernId ? { ...c, is_resolved: true, resolved_at: new Date().toISOString() } : c
      ));
      toast({ title: "Note marked as resolved" });
    } catch (error) {
      toast({
        title: "Error updating note",
        variant: "destructive",
      });
    }
  };

  const getStudentConcerns = (studentId: string) => {
    return studentConcerns.filter(c => c.student_id === studentId);
  };

  // Teacher management functions
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTeacher.name || !newTeacher.phone) {
      toast({
        title: "Missing fields",
        description: "Please fill name and phone",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .insert({
          name: newTeacher.name,
          email: newTeacher.email || null,
          phone: newTeacher.phone,
          assigned_classes: newTeacher.assigned_classes,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const addedTeacher = data as Teacher;
      setTeachers([addedTeacher, ...teachers]);
      setNewTeacher({ name: "", email: "", phone: "", assigned_classes: [] });
      setIsAddTeacherOpen(false);
      setNewlyAddedTeacher(addedTeacher);
    } catch (error) {
      toast({
        title: "Error adding teacher",
        variant: "destructive",
      });
    }
  };

  const handleEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    if (!editTeacher.name || !editTeacher.phone) {
      toast({
        title: "Missing fields",
        description: "Please fill name and phone",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .update({
          name: editTeacher.name,
          email: editTeacher.email || null,
          phone: editTeacher.phone,
          assigned_classes: editTeacher.assigned_classes,
        })
        .eq("id", selectedTeacher.id)
        .select()
        .single();

      if (error) throw error;

      const updatedTeacher = data as Teacher;
      setTeachers(teachers.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
      setIsEditTeacherOpen(false);
      setSelectedTeacher(null);
      toast({ title: "Teacher updated successfully" });
    } catch (error) {
      toast({
        title: "Error updating teacher",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    try {
      const { error } = await supabase
        .from("teachers")
        .delete()
        .eq("id", teacherId);

      if (error) throw error;

      setTeachers(teachers.filter(t => t.id !== teacherId));
      toast({ title: "Teacher deleted successfully" });
    } catch (error) {
      toast({
        title: "Error deleting teacher",
        variant: "destructive",
      });
    }
  };

  const handleSendComplaintToParent = async (complaintId: string) => {
    try {
      const complaint = studentComplaints.find(c => c.id === complaintId);
      if (!complaint) return;

      const student = students.find(s => s.id === complaint.student_id);
      const teacher = teachers.find(t => t.id === complaint.teacher_id);
      
      // Add as a concern visible to parent
      await supabase
        .from("student_concerns")
        .insert({
          student_id: complaint.student_id,
          title: `Complaint from ${teacher?.name || "Teacher"}`,
          content: complaint.complaint,
        } as any);

      // Mark complaint as sent
      const { error } = await supabase
        .from("student_complaints")
        .update({ is_sent_to_parent: true, sent_at: new Date().toISOString() })
        .eq("id", complaintId);

      if (error) throw error;

      setStudentComplaints(studentComplaints.map(c =>
        c.id === complaintId ? { ...c, is_sent_to_parent: true, sent_at: new Date().toISOString() } : c
      ));
      
      // Refresh concerns
      fetchData();
      toast({ title: "Complaint sent to parent successfully" });
    } catch (error) {
      toast({
        title: "Error sending complaint",
        variant: "destructive",
      });
    }
  };

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher?.name || "Unknown Teacher";
  };

  const handleReplyMessage = async () => {
    if (!selectedStudent || !replyMessage.trim()) return;

    try {
      const { data, error } = await supabase
        .from("parent_messages")
        .insert({
          student_id: selectedStudent.id,
          message: replyMessage.trim(),
          is_from_parent: false,
        } as any)
        .select()
        .single();

      if (error) throw error;

      setParentMessages([data as ParentMessage, ...parentMessages]);
      setReplyMessage("");
      toast({ title: "Reply sent successfully" });
    } catch (error) {
      toast({
        title: "Error sending reply",
        variant: "destructive",
      });
    }
  };

  const getStudentMessages = (studentId: string) => {
    return parentMessages.filter(m => m.student_id === studentId).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  };

  const getUnreadMessagesCount = () => {
    return parentMessages.filter(m => m.is_from_parent && !m.is_read).length;
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from("parent_messages")
        .update({ is_read: true })
        .eq("id", messageId);
      
      setParentMessages(parentMessages.map(m => 
        m.id === messageId ? { ...m, is_read: true } : m
      ));
    } catch (error) {
      console.error("Error marking message as read", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const handleRecordPayment = async () => {
    if (!selectedStudent) return;

    const currentDate = new Date();
    const month = MONTHS[currentDate.getMonth()];
    const year = currentDate.getFullYear();

    try {
      const { data, error } = await supabase
        .from("student_payments")
        .insert({
          student_id: selectedStudent.id,
          amount: parseFloat(paymentAmount),
          month,
          year,
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setPayments([data as StudentPayment, ...payments]);
      setIsPaymentOpen(false);
      setSelectedStudent(null);
      toast({ title: "Payment recorded successfully" });
    } catch (error) {
      toast({
        title: "Error recording payment",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
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

  const getStudentPayments = (studentId: string) => {
    return payments.filter(p => p.student_id === studentId);
  };

  const generateUPIUrl = (amount: string, studentName: string) => {
    return `upi://pay?pa=${UPI_ID}&pn=Ramanujan%20Academy&am=${amount}&cu=INR&tn=Fee%20for%20${encodeURIComponent(studentName)}`;
  };

  const unreadCount = submissions.filter(s => !s.is_read).length;

  // Calculate current installment period (6 months)
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const isFirstHalf = currentMonthIndex < 6; // Jan-Jun = first half, Jul-Dec = second half
  const currentInstallment = isFirstHalf ? "Jan-Jun" : "Jul-Dec";
  const firstHalfMonths = ["January", "February", "March", "April", "May", "June"];
  const secondHalfMonths = ["July", "August", "September", "October", "November", "December"];

  // Calculate students with fee due for current 6-month installment
  const studentsWithFeeDue = useMemo(() => {
    const installmentMonths = isFirstHalf ? firstHalfMonths : secondHalfMonths;
    
    return students.filter(student => {
      // Check if student has paid for any month in the current installment period
      const hasInstallmentPayment = payments.some(
        p => p.student_id === student.id && 
             installmentMonths.includes(p.month) && 
             p.year === currentYear &&
             p.status === "paid"
      );
      return !hasInstallmentPayment;
    });
  }, [students, payments, currentYear, isFirstHalf]);

  // Monthly payment statistics for chart
  const monthlyPaymentStats = useMemo(() => {
    const stats: { month: string; amount: number; count: number }[] = [];
    const last12Months: { month: string; year: number }[] = [];
    
    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      last12Months.push({
        month: MONTHS[date.getMonth()],
        year: date.getFullYear()
      });
    }

    last12Months.forEach(({ month, year }) => {
      const monthPayments = payments.filter(
        p => p.month === month && p.year === year && p.status === "paid"
      );
      const totalAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      stats.push({
        month: `${month.substring(0, 3)} ${year.toString().slice(-2)}`,
        amount: totalAmount,
        count: monthPayments.length
      });
    });

    return stats;
  }, [payments]);

  // Calculate total collection stats
  const collectionStats = useMemo(() => {
    const thisYearPayments = payments.filter(p => p.year === currentYear && p.status === "paid");
    const thisYearTotal = thisYearPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const thisMonthPayments = payments.filter(
      p => p.month === MONTHS[currentMonthIndex] && p.year === currentYear && p.status === "paid"
    );
    const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      thisYear: thisYearTotal,
      thisMonth: thisMonthTotal,
      totalPayments: payments.filter(p => p.status === "paid").length
    };
  }, [payments, currentYear, currentMonthIndex]);

  // Class-wise payment statistics
  const classWiseStats = useMemo(() => {
    return CLASSES.map(cls => {
      const classStudents = students.filter(s => s.class === cls);
      const classStudentIds = classStudents.map(s => s.id);
      const classPayments = payments.filter(
        p => classStudentIds.includes(p.student_id) && p.status === "paid"
      );
      const totalCollection = classPayments.reduce((sum, p) => sum + p.amount, 0);
      const thisYearCollection = classPayments
        .filter(p => p.year === currentYear)
        .reduce((sum, p) => sum + p.amount, 0);
      
      // Students with pending fees for current installment
      const installmentMonths = isFirstHalf ? firstHalfMonths : secondHalfMonths;
      const pendingStudents = classStudents.filter(student => {
        return !payments.some(
          p => p.student_id === student.id && 
               installmentMonths.includes(p.month) && 
               p.year === currentYear &&
               p.status === "paid"
        );
      });

      return {
        class: cls,
        studentCount: classStudents.length,
        totalCollection,
        thisYearCollection,
        paymentCount: classPayments.length,
        pendingCount: pendingStudents.length
      };
    });
  }, [students, payments, currentYear, isFirstHalf]);

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    if (!editStudent.name || !editStudent.phone || !editStudent.class) {
      toast({
        title: "Missing fields",
        description: "Please fill name, phone, and class",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .update({
          name: editStudent.name,
          email: editStudent.email || null,
          phone: editStudent.phone,
          class: editStudent.class,
          parent_name: editStudent.parent_name || null,
        })
        .eq("id", selectedStudent.id)
        .select()
        .single();

      if (error) throw error;

      setStudents(students.map(s => s.id === selectedStudent.id ? data as Student : s));
      setIsEditStudentOpen(false);
      setSelectedStudent(null);
      toast({ title: "Student updated successfully" });
    } catch (error) {
      toast({
        title: "Error updating student",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    try {
      // First delete related payments
      await supabase
        .from("student_payments")
        .delete()
        .eq("student_id", studentToDelete.id);

      // Then delete the student
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentToDelete.id);

      if (error) throw error;

      setStudents(students.filter(s => s.id !== studentToDelete.id));
      setPayments(payments.filter(p => p.student_id !== studentToDelete.id));
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
      toast({ title: "Student deleted successfully" });
    } catch (error) {
      toast({
        title: "Error deleting student",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setEditStudent({
      name: student.name,
      email: student.email || "",
      phone: student.phone,
      class: student.class,
      parent_name: student.parent_name || "",
    });
    setIsEditStudentOpen(true);
  };

  const openDeleteDialog = (student: Student) => {
    setStudentToDelete(student);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container-custom py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Ramanujan Academy" className="w-10 h-10" />
            <div>
              <h1 className="font-heading font-bold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Ramanujan Academy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container-custom py-8 px-4">
        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="card-elevated">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Enquiries
                </CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{submissions.length}</div>
                {unreadCount > 0 && (
                  <p className="text-xs text-secondary">{unreadCount} unread</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="card-elevated">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Students
                </CardTitle>
                <GraduationCap className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{students.length}</div>
                <p className="text-xs text-muted-foreground">enrolled</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="card-elevated">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today's Visits
                </CardTitle>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{visitStats.today}</div>
                <p className="text-xs text-muted-foreground">visitors today</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="card-elevated">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Visits
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{visitStats.total}</div>
                <p className="text-xs text-muted-foreground">all time</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Payment Collection Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Payment Collection Trends (Last 12 Months)
              </CardTitle>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">This Year:</span>
                  <span className="text-primary font-bold">₹{collectionStats.thisYear.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">This Month:</span>
                  <span className="text-primary font-bold">₹{collectionStats.thisMonth.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Total Payments:</span>
                  <span className="font-bold">{collectionStats.totalPayments}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyPaymentStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }} 
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      className="fill-muted-foreground"
                      tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === "amount" ? `₹${value.toLocaleString()}` : value,
                        name === "amount" ? "Collection" : "Payments"
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="amount" 
                      name="Collection (₹)" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Class-wise Payment Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Class-wise Collection Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {classWiseStats.map((stat) => (
                  <div 
                    key={stat.class}
                    className="p-4 rounded-lg border bg-background hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-sm">Class {stat.class}</Badge>
                      <span className="text-xs text-muted-foreground">{stat.studentCount} students</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-primary">
                        ₹{stat.thisYearCollection.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This year ({stat.paymentCount} payments)
                      </p>
                      {stat.pendingCount > 0 && (
                        <p className="text-xs text-destructive font-medium">
                          {stat.pendingCount} pending
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total Row */}
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                    <p className="text-xl font-bold">{students.length}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">This Year Collection</p>
                    <p className="text-xl font-bold text-primary">₹{collectionStats.thisYear.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Payments</p>
                    <p className="text-xl font-bold">{collectionStats.totalPayments}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending ({currentInstallment})</p>
                    <p className="text-xl font-bold text-destructive">{studentsWithFeeDue.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Fee Due Reminder Alert - 6 Month Installments */}
        {studentsWithFeeDue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Fee Due Reminders - {currentInstallment} {currentYear} Installment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {studentsWithFeeDue.length} student{studentsWithFeeDue.length !== 1 ? 's' : ''} haven't paid for the {currentInstallment} installment ({isFirstHalf ? "January to June" : "July to December"})
                </p>
                <div className="flex flex-wrap gap-2">
                  {studentsWithFeeDue.slice(0, 10).map((student) => (
                    <Badge 
                      key={student.id} 
                      variant="outline" 
                      className="border-destructive/50 text-destructive cursor-pointer hover:bg-destructive/10"
                      onClick={() => {
                        setSelectedStudent(student);
                        setIsPaymentOpen(true);
                      }}
                    >
                      {student.name} ({student.class})
                    </Badge>
                  ))}
                  {studentsWithFeeDue.length > 10 && (
                    <Badge variant="outline" className="border-destructive/50 text-destructive">
                      +{studentsWithFeeDue.length - 10} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs for different sections */}
        <Tabs defaultValue="walk-in-enquiries" className="space-y-6">
          {/* Tab Categories */}
          <div className="space-y-3">
            {/* Tab Group Labels */}
            <TabsList className="flex flex-wrap gap-1 h-auto p-2 bg-muted/50 rounded-xl">
              {/* People Management */}
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-lg">
                <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider mr-1 hidden md:inline">People</span>
                <TabsTrigger value="walk-in-enquiries" className="gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Walk-ins</span>
                  {enquiries.filter(e => e.status === "pending").length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">{enquiries.filter(e => e.status === "pending").length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="enquiries" className="gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Form</span>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">{unreadCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="students" className="gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <GraduationCap className="w-4 h-4" />
                  <span className="hidden sm:inline">Students</span>
                  {studentsWithFeeDue.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">{studentsWithFeeDue.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="teachers" className="gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Teachers</span>
                </TabsTrigger>
              </div>

              {/* Academics */}
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded-lg">
                <span className="text-[10px] font-medium text-green-600 uppercase tracking-wider mr-1 hidden md:inline">Academics</span>
                <TabsTrigger value="tests" className="gap-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white">
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline">Tests</span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tests.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="class-logs" className="gap-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white">
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">Class Logs</span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">{classLogs.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="academic-records" className="gap-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white">
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Records</span>
                </TabsTrigger>
              </div>

              {/* Finance */}
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-lg">
                <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider mr-1 hidden md:inline">Finance</span>
                <TabsTrigger value="payments" className="gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                  <IndianRupee className="w-4 h-4" />
                  <span className="hidden sm:inline">Payments</span>
                </TabsTrigger>
                <TabsTrigger value="teacher-salary" className="gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Salary</span>
                </TabsTrigger>
              </div>

              {/* Communication */}
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 rounded-lg">
                <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wider mr-1 hidden md:inline">Comm</span>
                <TabsTrigger value="announcements" className="gap-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">Announce</span>
                </TabsTrigger>
                <TabsTrigger value="complaints" className="gap-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="hidden sm:inline">Complaints</span>
                  {studentComplaints.filter(c => !c.is_sent_to_parent).length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">{studentComplaints.filter(c => !c.is_sent_to_parent).length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                  <StickyNote className="w-4 h-4" />
                  <span className="hidden sm:inline">Notes</span>
                  {studentConcerns.filter(c => !c.is_resolved).length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">{studentConcerns.filter(c => !c.is_resolved).length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Messages</span>
                  {getUnreadMessagesCount() > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">{getUnreadMessagesCount()}</Badge>
                  )}
                </TabsTrigger>
              </div>
            </TabsList>
          </div>

          {/* Enquiries Tab */}
          {/* Walk-in Enquiries Tab */}
          <TabsContent value="walk-in-enquiries">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-4 flex justify-end">
                <Button onClick={() => window.open("/enquiry", "_blank")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Enquiry
                </Button>
              </div>
              <EnquiryManagement enquiries={enquiries} onRefresh={fetchData} />
            </motion.div>
          </TabsContent>

          {/* Form Submissions Tab */}
          <TabsContent value="enquiries">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Form Submissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {submissions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No submissions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {submissions.map((submission) => (
                        <motion.div
                          key={submission.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`p-4 rounded-lg border ${
                            submission.is_read ? "bg-muted/30" : "bg-primary/5 border-primary/20"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2">
                                {submission.is_read ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-primary" />
                                )}
                                <h3 className="font-semibold">{submission.name}</h3>
                                {submission.class_interested && (
                                  <Badge variant="secondary">Class {submission.class_interested}</Badge>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-2">
                                <a href={`mailto:${submission.email}`} className="flex items-center gap-1 hover:text-foreground">
                                  <Mail className="w-3 h-3" />
                                  {submission.email}
                                </a>
                                <a href={`tel:${submission.phone}`} className="flex items-center gap-1 hover:text-foreground">
                                  <PhoneIcon className="w-3 h-3" />
                                  {submission.phone}
                                </a>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(submission.created_at)}
                                </span>
                              </div>

                              {submission.message && (
                                <p className="text-sm text-muted-foreground bg-muted p-2 rounded mt-2">
                                  {submission.message}
                                </p>
                              )}
                            </div>

                            {!submission.is_read && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAsRead(submission.id)}
                              >
                                Mark as Read
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Students
                  </CardTitle>
                  <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Student</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddStudent} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Student Name *</Label>
                          <Input
                            id="name"
                            value={newStudent.name}
                            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            placeholder="Enter student name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number *</Label>
                          <Input
                            id="phone"
                            value={newStudent.phone}
                            onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                            placeholder="Enter phone number"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="class">Class *</Label>
                          <NativeSelect
                            id="class"
                            value={newStudent.class}
                            onValueChange={(value) => setNewStudent({ ...newStudent, class: value })}
                            placeholder="Select class"
                            options={CLASSES.map((cls) => ({ value: cls, label: cls }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email (Optional)</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newStudent.email}
                            onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                            placeholder="Enter email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="parent">Parent Name (Optional)</Label>
                          <Input
                            id="parent"
                            value={newStudent.parent_name}
                            onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                            placeholder="Enter parent name"
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button type="button" variant="outline" onClick={() => setIsAddStudentOpen(false)} className="flex-1">
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Add Student
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {/* Class Filter */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedClassFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedClassFilter("all")}
                      >
                        All ({students.length})
                      </Button>
                      {CLASSES.map((cls) => {
                        const count = students.filter(s => s.class === cls).length;
                        return (
                          <Button
                            key={cls}
                            variant={selectedClassFilter === cls ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedClassFilter(cls)}
                            className={count === 0 ? "opacity-50" : ""}
                          >
                            {cls} ({count})
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No students added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {students
                        .filter(student => selectedClassFilter === "all" || student.class === selectedClassFilter)
                        .map((student) => (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-lg border bg-background hover:border-primary/50 transition-colors"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{student.name}</h3>
                                <Badge variant="secondary">Class {student.class}</Badge>
                              </div>
                              
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <a href={`tel:${student.phone}`} className="flex items-center gap-1 hover:text-foreground">
                                  <PhoneIcon className="w-3 h-3" />
                                  {student.phone}
                                </a>
                                {student.email && (
                                  <a href={`mailto:${student.email}`} className="flex items-center gap-1 hover:text-foreground">
                                    <Mail className="w-3 h-3" />
                                    {student.email}
                                  </a>
                                )}
                                {student.parent_name && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {student.parent_name}
                                  </span>
                                )}
                              </div>

                              {getStudentPayments(student.id).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {getStudentPayments(student.id).slice(0, 3).map((payment) => (
                                    <Badge key={payment.id} variant="outline" className="text-xs">
                                      {payment.month} {payment.year} - ₹{payment.amount}
                                    </Badge>
                                  ))}
                                  {getStudentPayments(student.id).length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{getStudentPayments(student.id).length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View Access Code"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setIsAccessCodeDialogOpen(true);
                                }}
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Add Note"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setIsAddConcernOpen(true);
                                }}
                              >
                                <StickyNote className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit Student"
                                onClick={() => openEditDialog(student)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete Student"
                                onClick={() => openDeleteDialog(student)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setIsPaymentOpen(true);
                                }}
                              >
                                <IndianRupee className="w-4 h-4 mr-1" />
                                Payment
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5" />
                    Payment History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <IndianRupee className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No payments recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {payments.map((payment) => {
                        const student = students.find(s => s.id === payment.student_id);
                        return (
                          <motion.div
                            key={payment.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 rounded-lg border bg-background"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{student?.name || "Unknown"}</h3>
                                  <Badge variant="outline">{student?.class}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {payment.month} {payment.year}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-primary">₹{payment.amount}</p>
                                <p className="text-xs text-muted-foreground">
                                  {payment.paid_at ? formatDate(payment.paid_at) : "Pending"}
                                </p>
                              </div>
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

          {/* Tests Tab */}
          <TabsContent value="tests">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Tests & Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tests.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No tests created yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tests.map((test) => {
                        const teacher = teachers.find(t => t.id === test.teacher_id);
                        const results = testResults.filter(r => r.test_id === test.id);
                        const classStudentsCount = students.filter(s => s.class === test.class).length;
                        const avgMarks = results.length > 0 
                          ? (results.reduce((sum, r) => sum + r.marks_obtained, 0) / results.length).toFixed(1)
                          : "N/A";
                        
                        return (
                          <motion.div
                            key={test.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 rounded-lg border bg-background hover:border-primary/50 transition-colors"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold">{test.title}</h3>
                                  <Badge variant="secondary">{test.subject}</Badge>
                                  <Badge variant="outline">Class {test.class}</Badge>
                                  {test.is_notified && (
                                    <Badge className="bg-green-100 text-green-700">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Parents Notified
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(test.test_date)}
                                  </span>
                                  <span>Max: {test.max_marks}</span>
                                  <span>Results: {results.length}/{classStudentsCount}</span>
                                  <span>Avg: {avgMarks}</span>
                                  {teacher && <span>Teacher: {teacher.name}</span>}
                                </div>
                                {test.description && (
                                  <p className="text-sm text-muted-foreground mt-2">{test.description}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTestForDetails(test);
                                    setIsTestDetailsOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View Results
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTestForDetails(test);
                                    setIsEditTestOpen(true);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={async () => {
                                    if (confirm("Delete this test and all its results?")) {
                                      await supabase.from("tests").delete().eq("id", test.id);
                                      fetchData();
                                      toast({ title: "Test deleted" });
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Analytics Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{tests.length}</p>
                      <p className="text-sm text-muted-foreground">Total Tests</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{testResults.length}</p>
                      <p className="text-sm text-muted-foreground">Results Recorded</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {testResults.length > 0 
                          ? `${Math.round(testResults.reduce((acc, r) => {
                              const test = tests.find(t => t.id === r.test_id);
                              return acc + (test ? (r.marks_obtained / test.max_marks) * 100 : 0);
                            }, 0) / testResults.length)}%`
                          : 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">Overall Average</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{[...new Set(tests.map(t => t.subject))].length}</p>
                      <p className="text-sm text-muted-foreground">Subjects</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Class Filter for Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Performance Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label className="mb-2 block">Filter by Class</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedClassFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedClassFilter("all")}
                      >
                        All Classes
                      </Button>
                      {CLASSES.map((cls) => (
                        <Button
                          key={cls}
                          variant={selectedClassFilter === cls ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedClassFilter(cls)}
                        >
                          {cls}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <TestAnalyticsChart 
                    tests={tests.map(t => ({ ...t, test_date: t.test_date }))}
                    testResults={testResults}
                    students={students}
                    selectedClass={selectedClassFilter === "all" ? undefined : selectedClassFilter}
                    showClassComparison={selectedClassFilter === "all"}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Academic Records Tab */}
          <TabsContent value="academic-records">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Student Academic Records
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Class Filter */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedClassFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedClassFilter("all")}
                      >
                        All ({students.length})
                      </Button>
                      {CLASSES.map((cls) => {
                        const count = students.filter(s => s.class === cls).length;
                        return (
                          <Button
                            key={cls}
                            variant={selectedClassFilter === cls ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedClassFilter(cls)}
                            className={count === 0 ? "opacity-50" : ""}
                          >
                            {cls} ({count})
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No students to show academic records</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {students
                        .filter(student => selectedClassFilter === "all" || student.class === selectedClassFilter)
                        .map((student) => {
                          const studentResults = testResults.filter(r => r.student_id === student.id);
                          const studentTestsWithResults = studentResults.map(result => {
                            const test = tests.find(t => t.id === result.test_id);
                            return test ? { ...result, test } : null;
                          }).filter(Boolean) as Array<TestResult & { test: Test }>;
                          
                          const overallPercentage = studentTestsWithResults.length > 0
                            ? Math.round(
                                studentTestsWithResults.reduce((acc, r) => 
                                  acc + (r.marks_obtained / r.test.max_marks) * 100, 0
                                ) / studentTestsWithResults.length
                              )
                            : null;
                          
                          return (
                            <motion.div
                              key={student.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-4 rounded-lg border bg-background"
                            >
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold">{student.name}</h3>
                                    <Badge variant="secondary">Class {student.class}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {studentTestsWithResults.length} test{studentTestsWithResults.length !== 1 ? 's' : ''} taken
                                  </p>
                                </div>
                                {overallPercentage !== null && (
                                  <div className="text-right">
                                    <p className="text-xl font-bold">{overallPercentage}%</p>
                                    <PerformanceComment percentage={overallPercentage} size="sm" showIcon={false} />
                                  </div>
                                )}
                              </div>
                              
                              {studentTestsWithResults.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No test records yet</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left py-2 px-2 font-medium">Test</th>
                                        <th className="text-left py-2 px-2 font-medium">Subject</th>
                                        <th className="text-left py-2 px-2 font-medium">Date</th>
                                        <th className="text-center py-2 px-2 font-medium">Marks</th>
                                        <th className="text-center py-2 px-2 font-medium">%</th>
                                        <th className="text-left py-2 px-2 font-medium">Grade</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {studentTestsWithResults
                                        .sort((a, b) => new Date(b.test.test_date).getTime() - new Date(a.test.test_date).getTime())
                                        .map((result) => {
                                          const percentage = Math.round((result.marks_obtained / result.test.max_marks) * 100);
                                          const { bgColor, color } = getPerformanceComment(percentage);
                                          return (
                                            <tr key={result.id} className="border-b last:border-0">
                                              <td className="py-2 px-2">{result.test.title}</td>
                                              <td className="py-2 px-2">
                                                <Badge variant="outline" className="text-xs">{result.test.subject}</Badge>
                                              </td>
                                              <td className="py-2 px-2 text-muted-foreground">
                                                {new Date(result.test.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                                              </td>
                                              <td className="py-2 px-2 text-center font-medium">
                                                {result.marks_obtained}/{result.test.max_marks}
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <span className={`font-bold ${color}`}>{percentage}%</span>
                                              </td>
                                              <td className="py-2 px-2">
                                                <PerformanceBadge percentage={percentage} />
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="teachers">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Teachers
                  </CardTitle>
                  <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Teacher
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Teacher</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddTeacher} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="teacher-name">Teacher Name *</Label>
                          <Input
                            id="teacher-name"
                            value={newTeacher.name}
                            onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                            placeholder="Enter teacher name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="teacher-phone">Phone Number *</Label>
                          <Input
                            id="teacher-phone"
                            value={newTeacher.phone}
                            onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                            placeholder="Enter phone number"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="teacher-email">Email (Optional)</Label>
                          <Input
                            id="teacher-email"
                            type="email"
                            value={newTeacher.email}
                            onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                            placeholder="Enter email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Assigned Classes</Label>
                          <div className="flex flex-wrap gap-2">
                            {CLASSES.map((cls) => (
                              <div key={cls} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`teacher-class-${cls}`}
                                  checked={newTeacher.assigned_classes.includes(cls)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewTeacher({
                                        ...newTeacher,
                                        assigned_classes: [...newTeacher.assigned_classes, cls]
                                      });
                                    } else {
                                      setNewTeacher({
                                        ...newTeacher,
                                        assigned_classes: newTeacher.assigned_classes.filter(c => c !== cls)
                                      });
                                    }
                                  }}
                                />
                                <label htmlFor={`teacher-class-${cls}`} className="text-sm">{cls}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button type="button" variant="outline" onClick={() => setIsAddTeacherOpen(false)} className="flex-1">
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Add Teacher
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {teachers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No teachers added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teachers.map((teacher) => (
                        <motion.div
                          key={teacher.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-lg border bg-background hover:border-primary/50 transition-colors"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{teacher.name}</h3>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <a href={`tel:${teacher.phone}`} className="flex items-center gap-1 hover:text-foreground">
                                  <PhoneIcon className="w-3 h-3" />
                                  {teacher.phone}
                                </a>
                                {teacher.email && (
                                  <a href={`mailto:${teacher.email}`} className="flex items-center gap-1 hover:text-foreground">
                                    <Mail className="w-3 h-3" />
                                    {teacher.email}
                                  </a>
                                )}
                              </div>
                              {teacher.assigned_classes.length > 0 && (
                                <div className="flex gap-1 flex-wrap mt-2">
                                  {teacher.assigned_classes.map((cls) => (
                                    <Badge key={cls} variant="outline" className="text-xs">
                                      Class {cls}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground">
                                  Logs: {classLogs.filter(l => l.teacher_id === teacher.id).length}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Complaints: {studentComplaints.filter(c => c.teacher_id === teacher.id).length}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTeacher(teacher);
                                  setEditTeacher({
                                    name: teacher.name,
                                    email: teacher.email || "",
                                    phone: teacher.phone,
                                    assigned_classes: teacher.assigned_classes || [],
                                  });
                                  setIsEditTeacherOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTeacher(teacher);
                                  setIsTeacherCodeDialogOpen(true);
                                }}
                              >
                                <Key className="w-4 h-4 mr-1" />
                                Code
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteTeacher(teacher.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Class Logs Tab */}
          <TabsContent value="class-logs">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-green-600" />
                      Teacher Class Logs
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex border rounded-lg overflow-hidden">
                        <Button
                          variant={classLogsViewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          className="rounded-none"
                          onClick={() => setClassLogsViewMode("list")}
                        >
                          <List className="w-4 h-4 mr-1" />
                          List
                        </Button>
                        <Button
                          variant={classLogsViewMode === "calendar" ? "default" : "ghost"}
                          size="sm"
                          className="rounded-none"
                          onClick={() => setClassLogsViewMode("calendar")}
                        >
                          <CalendarDays className="w-4 h-4 mr-1" />
                          Calendar
                        </Button>
                      </div>
                      <NativeSelect
                        value={classLogsFilter}
                        onValueChange={setClassLogsFilter}
                        className="w-[140px]"
                        options={[
                          { value: "all", label: "All Classes" },
                          ...CLASSES.map((cls) => ({ value: cls, label: `Class ${cls}` })),
                        ]}
                      />
                      <NativeSelect
                        value={classLogsTeacherFilter}
                        onValueChange={setClassLogsTeacherFilter}
                        className="w-[160px]"
                        options={[
                          { value: "all", label: "All Teachers" },
                          ...teachers.map((t) => ({ value: t.id, label: t.name })),
                        ]}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {classLogs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No class logs recorded yet</p>
                      <p className="text-sm mt-1">Teachers can add logs from the Teacher Dashboard</p>
                    </div>
                  ) : classLogsViewMode === "calendar" ? (
                    <ClassLogsCalendar 
                      classLogs={classLogs}
                      teachers={teachers}
                      classFilter={classLogsFilter}
                      teacherFilter={classLogsTeacherFilter}
                    />
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                          <p className="text-sm text-green-600 font-medium">Total Logs</p>
                          <p className="text-2xl font-bold text-green-700">{classLogs.length}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-sm text-blue-600 font-medium">This Week</p>
                          <p className="text-2xl font-bold text-blue-700">
                            {classLogs.filter(log => {
                              const logDate = new Date(log.log_date);
                              const weekAgo = new Date();
                              weekAgo.setDate(weekAgo.getDate() - 7);
                              return logDate >= weekAgo;
                            }).length}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                          <p className="text-sm text-purple-600 font-medium">Active Teachers</p>
                          <p className="text-2xl font-bold text-purple-700">
                            {new Set(classLogs.map(log => log.teacher_id)).size}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-sm text-amber-600 font-medium">Today</p>
                          <p className="text-2xl font-bold text-amber-700">
                            {classLogs.filter(log => {
                              const today = new Date().toISOString().split('T')[0];
                              return log.log_date === today;
                            }).length}
                          </p>
                        </div>
                      </div>

                      {/* Class Logs List */}
                      <div className="space-y-3">
                        {classLogs
                          .filter(log => classLogsFilter === "all" || log.class === classLogsFilter)
                          .filter(log => classLogsTeacherFilter === "all" || log.teacher_id === classLogsTeacherFilter)
                          .map((log) => {
                            const teacher = teachers.find(t => t.id === log.teacher_id);
                            return (
                              <motion.div
                                key={log.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-4 rounded-lg border bg-background hover:border-green-300 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        Class {log.class}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(log.log_date).toLocaleDateString('en-IN', {
                                          weekday: 'short',
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{log.content}</p>
                                    {teacher && (
                                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                        <UserCheck className="w-3 h-3" />
                                        <span className="font-medium">{teacher.name}</span>
                                        <span>•</span>
                                        <span>{teacher.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Teacher Salary Tab */}
          <TabsContent value="teacher-salary">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <TeacherSalaryManagement teachers={teachers} onRefresh={fetchData} />
            </motion.div>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Announcements
                  </CardTitle>
                  <Dialog open={isAddAnnouncementOpen} onOpenChange={setIsAddAnnouncementOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        New Announcement
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Announcement</DialogTitle>
                        <DialogDescription>
                          Create a new announcement for parents
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="announcement-title">Title *</Label>
                          <Input
                            id="announcement-title"
                            value={newAnnouncement.title}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                            placeholder="Enter announcement title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="announcement-content">Content *</Label>
                          <Textarea
                            id="announcement-content"
                            value={newAnnouncement.content}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                            placeholder="Enter announcement content"
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Target Classes (leave empty for all)</Label>
                          <div className="flex flex-wrap gap-2">
                            {CLASSES.map((cls) => (
                              <div key={cls} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`class-${cls}`}
                                  checked={newAnnouncement.target_classes.includes(cls)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewAnnouncement({
                                        ...newAnnouncement,
                                        target_classes: [...newAnnouncement.target_classes, cls]
                                      });
                                    } else {
                                      setNewAnnouncement({
                                        ...newAnnouncement,
                                        target_classes: newAnnouncement.target_classes.filter(c => c !== cls)
                                      });
                                    }
                                  }}
                                />
                                <label htmlFor={`class-${cls}`} className="text-sm">{cls}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button variant="outline" onClick={() => setIsAddAnnouncementOpen(false)} className="flex-1">
                            Cancel
                          </Button>
                          <Button onClick={handleAddAnnouncement} className="flex-1">
                            Create Announcement
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {announcements.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
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
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs shrink-0">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(announcement.created_at)}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                                onClick={() => handleDeleteAnnouncement(announcement.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                            {announcement.content}
                          </p>
                          {announcement.target_classes.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {announcement.target_classes.map((cls) => (
                                <Badge key={cls} variant="outline" className="text-xs">
                                  Class {cls}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {announcement.target_classes.length === 0 && (
                            <Badge variant="outline" className="text-xs">All Classes</Badge>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Parent Messages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parentMessages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No messages from parents yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Group messages by student */}
                      {Array.from(new Set(parentMessages.map(m => m.student_id))).map((studentId) => {
                        const student = students.find(s => s.id === studentId);
                        const studentMsgs = getStudentMessages(studentId);
                        const hasUnread = studentMsgs.some(m => m.is_from_parent && !m.is_read);
                        
                        return (
                          <motion.div
                            key={studentId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`p-4 rounded-lg border ${hasUnread ? "bg-primary/5 border-primary/20" : "bg-background"}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{student?.name || "Unknown"}</h3>
                                <Badge variant="secondary">Class {student?.class}</Badge>
                                {hasUnread && (
                                  <Badge variant="destructive" className="text-xs">New</Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedStudent(student || null);
                                  setIsMessagesOpen(true);
                                  // Mark messages as read
                                  studentMsgs.filter(m => m.is_from_parent && !m.is_read).forEach(m => {
                                    markMessageAsRead(m.id);
                                  });
                                }}
                              >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Open Chat
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {studentMsgs[studentMsgs.length - 1]?.message.substring(0, 100)}
                              {studentMsgs[studentMsgs.length - 1]?.message.length > 100 ? "..." : ""}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Teacher Complaints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentComplaints.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No complaints from teachers yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {studentComplaints.map((complaint) => {
                        const student = students.find(s => s.id === complaint.student_id);
                        return (
                          <motion.div
                            key={complaint.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`p-4 rounded-lg border ${complaint.is_sent_to_parent ? "bg-muted/50" : "bg-orange-50 border-orange-200"}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary">{student?.name || "Unknown"}</Badge>
                                <Badge variant="outline">Class {student?.class}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  by {getTeacherName(complaint.teacher_id)}
                                </span>
                                {complaint.is_sent_to_parent && (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Sent to Parent
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {formatDate(complaint.created_at)}
                                </Badge>
                                {!complaint.is_sent_to_parent && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-orange-600 hover:bg-orange-50 h-7"
                                    onClick={() => handleSendComplaintToParent(complaint.id)}
                                  >
                                    <Send className="w-4 h-4 mr-1" />
                                    Send to Parent
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {complaint.complaint}
                            </p>
                            {complaint.sent_at && (
                              <p className="text-xs text-green-600 mt-2">
                                Sent on {formatDate(complaint.sent_at)}
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
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StickyNote className="w-5 h-5" />
                    Student Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentConcerns.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No notes added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {studentConcerns.map((concern) => {
                        const student = students.find(s => s.id === concern.student_id);
                        return (
                          <motion.div
                            key={concern.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`p-4 rounded-lg border ${concern.is_resolved ? "bg-muted/50" : "bg-background"}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold">{concern.title}</h3>
                                <Badge variant="secondary">{student?.name || "Unknown"}</Badge>
                                <Badge variant="outline">Class {student?.class}</Badge>
                                {concern.is_resolved && (
                                  <Badge variant="default" className="bg-green-500">
                                    <FileCheck className="w-3 h-3 mr-1" />
                                    Resolved
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {formatDate(concern.created_at)}
                                </Badge>
                                {!concern.is_resolved && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 hover:bg-green-50 h-7"
                                    onClick={() => handleMarkConcernResolved(concern.id)}
                                  >
                                    <FileCheck className="w-4 h-4 mr-1" />
                                    Resolve
                                  </Button>
                                )}
                              </div>
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
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Payment QR Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                Payment for {selectedStudent?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <div className="flex flex-col items-center gap-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Scan QR code to pay via UPI
                </p>
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={generateUPIUrl(paymentAmount, selectedStudent?.name || "")}
                    size={180}
                    level="H"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center break-all">
                  UPI ID: {UPI_ID}
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsPaymentOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>
                Update student information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Student Name *</Label>
                <Input
                  id="edit-name"
                  value={editStudent.name}
                  onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })}
                  placeholder="Enter student name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number *</Label>
                <Input
                  id="edit-phone"
                  value={editStudent.phone}
                  onChange={(e) => setEditStudent({ ...editStudent, phone: e.target.value })}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class">Class *</Label>
                <NativeSelect
                  id="edit-class"
                  value={editStudent.class}
                  onValueChange={(value) => setEditStudent({ ...editStudent, class: value })}
                  placeholder="Select class"
                  options={CLASSES.map((cls) => ({ value: cls, label: cls }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email (Optional)</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editStudent.email}
                  onChange={(e) => setEditStudent({ ...editStudent, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-parent">Parent Name (Optional)</Label>
                <Input
                  id="edit-parent"
                  value={editStudent.parent_name}
                  onChange={(e) => setEditStudent({ ...editStudent, parent_name: e.target.value })}
                  placeholder="Enter parent name"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditStudentOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Save Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Student</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {studentToDelete?.name}? This will also delete all their payment records. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteStudent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Student Access Code Dialog */}
        <Dialog open={!!newlyAddedStudent} onOpenChange={() => setNewlyAddedStudent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Student Added Successfully!
              </DialogTitle>
              <DialogDescription>
                Share this code or QR with the parent to access the Parent Portal
              </DialogDescription>
            </DialogHeader>
            {newlyAddedStudent && (
              <div className="space-y-4">
                <AccessCodeQR 
                  code={newlyAddedStudent.access_code}
                  name={`${newlyAddedStudent.name} (Class ${newlyAddedStudent.class})`}
                  type="student"
                  showCard={false}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Parents can scan this QR or enter code at /parent
                </p>
                <Button onClick={() => setNewlyAddedStudent(null)} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Messages Chat Dialog */}
        <Dialog open={isMessagesOpen} onOpenChange={setIsMessagesOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat with {selectedStudent?.name}'s Parent
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="h-[300px] overflow-y-auto border rounded-lg p-4 space-y-3 bg-muted/30">
                {selectedStudent && getStudentMessages(selectedStudent.id).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_from_parent ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.is_from_parent
                          ? "bg-background border"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.is_from_parent ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button onClick={handleReplyMessage} disabled={!replyMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Concern Dialog */}
        <Dialog open={isAddConcernOpen} onOpenChange={setIsAddConcernOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note for {selectedStudent?.name}</DialogTitle>
              <DialogDescription>
                This note will be visible to the parent in their portal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="concern-title">Title *</Label>
                <Input
                  id="concern-title"
                  value={newConcern.title}
                  onChange={(e) => setNewConcern({ ...newConcern, title: e.target.value })}
                  placeholder="Enter note title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="concern-content">Content *</Label>
                <Textarea
                  id="concern-content"
                  value={newConcern.content}
                  onChange={(e) => setNewConcern({ ...newConcern, content: e.target.value })}
                  placeholder="Enter note content"
                  rows={4}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddConcernOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAddConcern} className="flex-1">
                  Add Note
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Teacher Access Code Dialog */}
        <Dialog open={isTeacherCodeDialogOpen} onOpenChange={setIsTeacherCodeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-green-600" />
                Access Code for {selectedTeacher?.name}
              </DialogTitle>
              <DialogDescription>
                Share this code or QR with the teacher to access the Teacher Portal
              </DialogDescription>
            </DialogHeader>
            {selectedTeacher && (
              <div className="space-y-4">
                <AccessCodeQR 
                  code={selectedTeacher.access_code}
                  name={selectedTeacher.name}
                  type="teacher"
                  showCard={false}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Teachers can scan this QR or enter code at /teacher
                </p>
                <Button onClick={() => setIsTeacherCodeDialogOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Teacher Dialog */}
        <Dialog open={isEditTeacherOpen} onOpenChange={setIsEditTeacherOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Teacher</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditTeacher} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-name">Teacher Name *</Label>
                <Input
                  id="edit-teacher-name"
                  value={editTeacher.name}
                  onChange={(e) => setEditTeacher({ ...editTeacher, name: e.target.value })}
                  placeholder="Enter teacher name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-phone">Phone Number *</Label>
                <Input
                  id="edit-teacher-phone"
                  value={editTeacher.phone}
                  onChange={(e) => setEditTeacher({ ...editTeacher, phone: e.target.value })}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-email">Email (Optional)</Label>
                <Input
                  id="edit-teacher-email"
                  type="email"
                  value={editTeacher.email}
                  onChange={(e) => setEditTeacher({ ...editTeacher, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label>Assigned Classes</Label>
                <div className="flex flex-wrap gap-2">
                  {CLASSES.map((cls) => (
                    <div key={cls} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-teacher-class-${cls}`}
                        checked={editTeacher.assigned_classes.includes(cls)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditTeacher({
                              ...editTeacher,
                              assigned_classes: [...editTeacher.assigned_classes, cls]
                            });
                          } else {
                            setEditTeacher({
                              ...editTeacher,
                              assigned_classes: editTeacher.assigned_classes.filter(c => c !== cls)
                            });
                          }
                        }}
                      />
                      <label htmlFor={`edit-teacher-class-${cls}`} className="text-sm">{cls}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditTeacherOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Save Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Newly Added Teacher Dialog */}
        <Dialog open={!!newlyAddedTeacher} onOpenChange={() => setNewlyAddedTeacher(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-green-600" />
                Teacher Added Successfully!
              </DialogTitle>
              <DialogDescription>
                Share this code or QR with the teacher to access the Teacher Portal
              </DialogDescription>
            </DialogHeader>
            {newlyAddedTeacher && (
              <div className="space-y-4">
                <AccessCodeQR 
                  code={newlyAddedTeacher.access_code}
                  name={newlyAddedTeacher.name}
                  type="teacher"
                  showCard={false}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Teachers can scan this QR or enter code at /teacher
                </p>
                <Button onClick={() => setNewlyAddedTeacher(null)} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Access Code Dialog */}
        <Dialog open={isAccessCodeDialogOpen} onOpenChange={setIsAccessCodeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Access Code for {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription>
                Share this code or QR with the parent to access the Parent Portal
              </DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                <AccessCodeQR 
                  code={selectedStudent.access_code}
                  name={`${selectedStudent.name} (Class ${selectedStudent.class})`}
                  type="student"
                  showCard={false}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Parents can scan this QR or enter code at /parent
                </p>
                <Button onClick={() => setIsAccessCodeDialogOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Test Details Dialog */}
        <Dialog open={isTestDetailsOpen} onOpenChange={setIsTestDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTestForDetails?.title} - Results</DialogTitle>
              <DialogDescription>
                {selectedTestForDetails?.subject} | Class {selectedTestForDetails?.class} | Max: {selectedTestForDetails?.max_marks}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTestForDetails && students.filter(s => s.class === selectedTestForDetails.class).map((student) => {
                const result = testResults.find(r => r.test_id === selectedTestForDetails.id && r.student_id === student.id);
                return (
                  <div key={student.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-medium">{student.name}</span>
                      {result?.remarks && <p className="text-xs text-muted-foreground">{result.remarks}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {result ? (
                        <>
                          <span className="font-bold text-lg">{result.marks_obtained}/{selectedTestForDetails.max_marks}</span>
                          {result.photo_url && (
                            <a href={result.photo_url} target="_blank" rel="noopener noreferrer">
                              <ImageIcon className="w-4 h-4 text-blue-600" />
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not entered</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminDashboard;