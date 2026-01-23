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
  TrendingUp
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";

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

interface VisitStats {
  total: number;
  today: number;
  thisWeek: number;
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
  const [visitStats, setVisitStats] = useState<VisitStats>({ total: 0, today: 0, thisWeek: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("500");

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
        })
        .select()
        .single();

      if (error) throw error;

      setStudents([data as Student, ...students]);
      setNewStudent({ name: "", email: "", phone: "", class: "", parent_name: "" });
      setIsAddStudentOpen(false);
      toast({ title: "Student added successfully" });
    } catch (error) {
      toast({
        title: "Error adding student",
        variant: "destructive",
      });
    }
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
        <Tabs defaultValue="enquiries" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="enquiries" className="gap-2">
              <FileText className="w-4 h-4" />
              Enquiries
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              Students
              {studentsWithFeeDue.length > 0 && (
                <Badge variant="destructive" className="ml-1">{studentsWithFeeDue.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <IndianRupee className="w-4 h-4" />
              Payments
            </TabsTrigger>
          </TabsList>

          {/* Enquiries Tab */}
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
                          <Select
                            value={newStudent.class}
                            onValueChange={(value) => setNewStudent({ ...newStudent, class: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                              {CLASSES.map((cls) => (
                                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                  {students.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No students added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {students.map((student) => (
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

                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(student)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                <Select
                  value={editStudent.class}
                  onValueChange={(value) => setEditStudent({ ...editStudent, class: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
      </main>
    </div>
  );
};

export default AdminDashboard;