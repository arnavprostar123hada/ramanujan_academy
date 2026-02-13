import { useState, useEffect, useMemo } from "react";
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  IndianRupee,
  Calendar,
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  Calculator,
  Pencil,
} from "lucide-react";
import { motion } from "framer-motion";

interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  access_code: string;
  assigned_classes: string[];
  created_at: string;
  monthly_salary?: number;
}

interface TeacherAttendance {
  id: string;
  teacher_id: string;
  attendance_date: string;
  status: string;
  created_at: string;
}

interface SalaryRecord {
  id: string;
  teacher_id: string;
  month: string;
  year: number;
  total_days: number;
  days_present: number;
  half_days: number;
  days_absent: number;
  base_salary: number;
  calculated_salary: number;
  deductions: number;
  bonus: number;
  final_salary: number;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface TeacherSalaryManagementProps {
  teachers: Teacher[];
  onRefresh: () => void;
}

export function TeacherSalaryManagement({ teachers, onRefresh }: TeacherSalaryManagementProps) {
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<TeacherAttendance[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());

  // Salary edit
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [salaryEditTeacher, setSalaryEditTeacher] = useState<Teacher | null>(null);
  const [salaryAmount, setSalaryAmount] = useState("");

  // Salary calculation dialog
  const [isCalcDialogOpen, setIsCalcDialogOpen] = useState(false);
  const [calcTeacher, setCalcTeacher] = useState<Teacher | null>(null);
  const [calcMonth, setCalcMonth] = useState(MONTHS[new Date().getMonth()]);
  const [calcYear, setCalcYear] = useState(new Date().getFullYear());
  const [calcBonus, setCalcBonus] = useState("0");
  const [calcDeductions, setCalcDeductions] = useState("0");
  const [calcNotes, setCalcNotes] = useState("");

  // Sub-tab
  const [activeTab, setActiveTab] = useState<"salary" | "attendance" | "payroll">("salary");

  useEffect(() => {
    fetchAttendance();
    fetchSalaryRecords();
  }, []);

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from("teacher_attendance")
      .select("*")
      .order("attendance_date", { ascending: false });
    if (data) setAttendance(data as TeacherAttendance[]);
  };

  const fetchSalaryRecords = async () => {
    const { data } = await supabase
      .from("teacher_salary_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSalaryRecords(data as SalaryRecord[]);
  };

  // Set monthly salary for a teacher
  const handleSetSalary = async () => {
    if (!salaryEditTeacher || !salaryAmount) return;
    try {
      const { error } = await supabase
        .from("teachers")
        .update({ monthly_salary: parseFloat(salaryAmount) } as any)
        .eq("id", salaryEditTeacher.id);
      if (error) throw error;
      toast({ title: `Salary set to ₹${salaryAmount} for ${salaryEditTeacher.name}` });
      setIsSalaryDialogOpen(false);
      onRefresh();
    } catch {
      toast({ title: "Error setting salary", variant: "destructive" });
    }
  };

  // Mark attendance
  const handleMarkAttendance = async (teacherId: string, date: string, status: string) => {
    try {
      // Upsert
      const existing = attendance.find(
        (a) => a.teacher_id === teacherId && a.attendance_date === date
      );
      if (existing) {
        if (existing.status === status) {
          // Remove attendance
          await supabase.from("teacher_attendance").delete().eq("id", existing.id);
          setAttendance((prev) => prev.filter((a) => a.id !== existing.id));
          return;
        }
        const { data, error } = await supabase
          .from("teacher_attendance")
          .update({ status })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        setAttendance((prev) =>
          prev.map((a) => (a.id === existing.id ? (data as TeacherAttendance) : a))
        );
      } else {
        const { data, error } = await supabase
          .from("teacher_attendance")
          .insert({ teacher_id: teacherId, attendance_date: date, status } as any)
          .select()
          .single();
        if (error) throw error;
        setAttendance((prev) => [data as TeacherAttendance, ...prev]);
      }
    } catch {
      toast({ title: "Error marking attendance", variant: "destructive" });
    }
  };

  // Calculate salary
  const calcData = useMemo(() => {
    if (!calcTeacher) return null;
    const monthIndex = MONTHS.indexOf(calcMonth);
    const daysInMonth = getDaysInMonth(new Date(calcYear, monthIndex));
    const monthAttendance = attendance.filter(
      (a) =>
        a.teacher_id === calcTeacher.id &&
        new Date(a.attendance_date).getMonth() === monthIndex &&
        new Date(a.attendance_date).getFullYear() === calcYear
    );
    const present = monthAttendance.filter((a) => a.status === "present").length;
    const halfDays = monthAttendance.filter((a) => a.status === "half_day").length;
    const absent = monthAttendance.filter((a) => a.status === "absent").length;
    const baseSalary = (calcTeacher as any).monthly_salary || 0;
    const effectiveDays = present + halfDays * 0.5;
    const perDay = daysInMonth > 0 ? baseSalary / daysInMonth : 0;
    const calculated = perDay * effectiveDays;
    const bonus = parseFloat(calcBonus) || 0;
    const deductions = parseFloat(calcDeductions) || 0;
    const finalSalary = calculated + bonus - deductions;

    return {
      totalDays: daysInMonth,
      daysPresent: present,
      halfDays,
      daysAbsent: absent,
      baseSalary,
      perDay: Math.round(perDay),
      effectiveDays,
      calculated: Math.round(calculated),
      bonus,
      deductions,
      finalSalary: Math.round(finalSalary),
    };
  }, [calcTeacher, calcMonth, calcYear, attendance, calcBonus, calcDeductions]);

  const handleSaveSalaryRecord = async () => {
    if (!calcTeacher || !calcData) return;
    try {
      const { error } = await supabase.from("teacher_salary_records").upsert(
        {
          teacher_id: calcTeacher.id,
          month: calcMonth,
          year: calcYear,
          total_days: calcData.totalDays,
          days_present: calcData.daysPresent,
          half_days: calcData.halfDays,
          days_absent: calcData.daysAbsent,
          base_salary: calcData.baseSalary,
          calculated_salary: calcData.calculated,
          deductions: calcData.deductions,
          bonus: calcData.bonus,
          final_salary: calcData.finalSalary,
          notes: calcNotes || null,
          paid_at: new Date().toISOString(),
        } as any,
        { onConflict: "teacher_id,month,year" }
      );
      if (error) throw error;
      toast({ title: `Salary record saved for ${calcTeacher.name}` });
      setIsCalcDialogOpen(false);
      fetchSalaryRecords();
    } catch {
      toast({ title: "Error saving salary record", variant: "destructive" });
    }
  };

  // Attendance grid data
  const daysInSelectedMonth = getDaysInMonth(new Date(attendanceYear, attendanceMonth));
  const daysArray = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

  const filteredTeachers =
    selectedTeacher === "all" ? teachers : teachers.filter((t) => t.id === selectedTeacher);

  const getAttendanceStatus = (teacherId: string, day: number) => {
    const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return attendance.find((a) => a.teacher_id === teacherId && a.attendance_date === dateStr)?.status || null;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(["salary", "attendance", "payroll"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="capitalize"
          >
            {tab === "salary" && <IndianRupee className="w-4 h-4 mr-1" />}
            {tab === "attendance" && <Calendar className="w-4 h-4 mr-1" />}
            {tab === "payroll" && <Calculator className="w-4 h-4 mr-1" />}
            {tab}
          </Button>
        ))}
      </div>

      {/* Salary Tab */}
      {activeTab === "salary" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                Teacher Salaries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-background"
                  >
                    <div>
                      <h3 className="font-semibold">{teacher.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Monthly Salary:{" "}
                        <span className="font-bold text-primary">
                          ₹{((teacher as any).monthly_salary || 0).toLocaleString()}
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSalaryEditTeacher(teacher);
                        setSalaryAmount(String((teacher as any).monthly_salary || ""));
                        setIsSalaryDialogOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Set Salary
                    </Button>
                  </div>
                ))}
                {teachers.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">No teachers added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Teacher Attendance
                </CardTitle>
                <div className="flex gap-2">
                  <NativeSelect
                    value={String(attendanceMonth)}
                    onValueChange={(v) => setAttendanceMonth(parseInt(v))}
                    options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
                    className="w-[140px]"
                  />
                  <NativeSelect
                    value={String(attendanceYear)}
                    onValueChange={(v) => setAttendanceYear(parseInt(v))}
                    options={[2024, 2025, 2026, 2027].map((y) => ({
                      value: String(y),
                      label: String(y),
                    }))}
                    className="w-[100px]"
                  />
                  <NativeSelect
                    value={selectedTeacher}
                    onValueChange={setSelectedTeacher}
                    options={[
                      { value: "all", label: "All Teachers" },
                      ...teachers.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                    className="w-[160px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> Present
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500" /> Half Day
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" /> Absent
                </span>
                <span className="text-muted-foreground ml-2">Click to mark, click again to change</span>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">Teacher</TableHead>
                      {daysArray.map((day) => (
                        <TableHead key={day} className="text-center px-1 min-w-[36px]">
                          {day}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[50px]">P</TableHead>
                      <TableHead className="text-center min-w-[50px]">H</TableHead>
                      <TableHead className="text-center min-w-[50px]">A</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.map((teacher) => {
                      const presentCount = daysArray.filter(
                        (d) => getAttendanceStatus(teacher.id, d) === "present"
                      ).length;
                      const halfCount = daysArray.filter(
                        (d) => getAttendanceStatus(teacher.id, d) === "half_day"
                      ).length;
                      const absentCount = daysArray.filter(
                        (d) => getAttendanceStatus(teacher.id, d) === "absent"
                      ).length;

                      return (
                        <TableRow key={teacher.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {teacher.name}
                          </TableCell>
                          {daysArray.map((day) => {
                            const status = getAttendanceStatus(teacher.id, day);
                            const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                            const isFuture = new Date(dateStr) > new Date();
                            return (
                              <TableCell key={day} className="text-center px-0.5 py-1">
                                <button
                                  className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                                    status === "present"
                                      ? "bg-green-500 text-white"
                                      : status === "half_day"
                                      ? "bg-amber-500 text-white"
                                      : status === "absent"
                                      ? "bg-red-500 text-white"
                                      : isToday
                                      ? "border-2 border-primary bg-primary/10"
                                      : isFuture
                                      ? "bg-muted/30 text-muted-foreground/50"
                                      : "bg-muted/50 hover:bg-muted"
                                  }`}
                                  onClick={() => {
                                    const nextStatus =
                                      status === null
                                        ? "present"
                                        : status === "present"
                                        ? "half_day"
                                        : status === "half_day"
                                        ? "absent"
                                        : "present";
                                    handleMarkAttendance(teacher.id, dateStr, nextStatus);
                                  }}
                                >
                                  {status === "present"
                                    ? "P"
                                    : status === "half_day"
                                    ? "H"
                                    : status === "absent"
                                    ? "A"
                                    : ""}
                                </button>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold text-green-600">
                            {presentCount}
                          </TableCell>
                          <TableCell className="text-center font-bold text-amber-600">
                            {halfCount}
                          </TableCell>
                          <TableCell className="text-center font-bold text-red-600">
                            {absentCount}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payroll Tab */}
      {activeTab === "payroll" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Calculate & Process Salary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teachers.map((teacher) => {
                  const latestRecord = salaryRecords.find((r) => r.teacher_id === teacher.id);
                  return (
                    <div
                      key={teacher.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-background"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <h3 className="font-semibold">{teacher.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Base: ₹{((teacher as any).monthly_salary || 0).toLocaleString()}
                        </p>
                        {latestRecord && (
                          <p className="text-xs text-muted-foreground">
                            Last: {latestRecord.month} {latestRecord.year} — ₹
                            {latestRecord.final_salary.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setCalcTeacher(teacher);
                          setCalcMonth(MONTHS[new Date().getMonth()]);
                          setCalcYear(new Date().getFullYear());
                          setCalcBonus("0");
                          setCalcDeductions("0");
                          setCalcNotes("");
                          setIsCalcDialogOpen(true);
                        }}
                      >
                        <Calculator className="w-4 h-4 mr-1" />
                        Calculate Salary
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Salary History */}
          {salaryRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Base</TableHead>
                        <TableHead className="text-center">Days (P/H/A)</TableHead>
                        <TableHead className="text-right">Bonus</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryRecords.map((record) => {
                        const teacher = teachers.find((t) => t.id === record.teacher_id);
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{teacher?.name || "—"}</TableCell>
                            <TableCell>
                              {record.month} {record.year}
                            </TableCell>
                            <TableCell className="text-right">₹{record.base_salary.toLocaleString()}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-green-600">{record.days_present}</span>/
                              <span className="text-amber-600">{record.half_days}</span>/
                              <span className="text-red-600">{record.days_absent}</span>
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {record.bonus > 0 ? `+₹${record.bonus.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {record.deductions > 0 ? `-₹${record.deductions.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              ₹{record.final_salary.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Set Salary Dialog */}
      <Dialog open={isSalaryDialogOpen} onOpenChange={setIsSalaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Monthly Salary</DialogTitle>
            <DialogDescription>
              Set the base monthly salary for {salaryEditTeacher?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Salary (₹)</Label>
              <Input
                type="number"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="Enter monthly salary"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsSalaryDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSetSalary} className="flex-1">
                Save Salary
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Calculation Dialog */}
      <Dialog open={isCalcDialogOpen} onOpenChange={setIsCalcDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Calculate Salary — {calcTeacher?.name}</DialogTitle>
            <DialogDescription>
              Review attendance and calculate final salary
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label>Month</Label>
                <NativeSelect
                  value={calcMonth}
                  onValueChange={setCalcMonth}
                  options={MONTHS.map((m) => ({ value: m, label: m }))}
                />
              </div>
              <div className="w-[100px] space-y-2">
                <Label>Year</Label>
                <NativeSelect
                  value={String(calcYear)}
                  onValueChange={(v) => setCalcYear(parseInt(v))}
                  options={[2024, 2025, 2026, 2027].map((y) => ({
                    value: String(y),
                    label: String(y),
                  }))}
                />
              </div>
            </div>

            {calcData && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded bg-green-50 border border-green-200">
                    <p className="text-lg font-bold text-green-700">{calcData.daysPresent}</p>
                    <p className="text-xs text-green-600">Present</p>
                  </div>
                  <div className="p-2 rounded bg-amber-50 border border-amber-200">
                    <p className="text-lg font-bold text-amber-700">{calcData.halfDays}</p>
                    <p className="text-xs text-amber-600">Half Days</p>
                  </div>
                  <div className="p-2 rounded bg-red-50 border border-red-200">
                    <p className="text-lg font-bold text-red-700">{calcData.daysAbsent}</p>
                    <p className="text-xs text-red-600">Absent</p>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Days in Month</span>
                    <span className="font-medium">{calcData.totalDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Effective Working Days</span>
                    <span className="font-medium">{calcData.effectiveDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Monthly Salary</span>
                    <span className="font-medium">₹{calcData.baseSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Day Rate</span>
                    <span className="font-medium">₹{calcData.perDay.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">Calculated (Days × Rate)</span>
                    <span className="font-medium">₹{calcData.calculated.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bonus (₹)</Label>
                <Input
                  type="number"
                  value={calcBonus}
                  onChange={(e) => setCalcBonus(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Deductions (₹)</Label>
                <Input
                  type="number"
                  value={calcDeductions}
                  onChange={(e) => setCalcDeductions(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={calcNotes}
                onChange={(e) => setCalcNotes(e.target.value)}
                placeholder="Optional notes about this salary payment"
                rows={2}
              />
            </div>

            {calcData && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <p className="text-sm text-muted-foreground">Final Salary</p>
                <p className="text-3xl font-bold text-primary">
                  ₹{calcData.finalSalary.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (₹{calcData.calculated.toLocaleString()} + ₹{calcData.bonus.toLocaleString()} bonus - ₹{calcData.deductions.toLocaleString()} deductions)
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsCalcDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveSalaryRecord} className="flex-1">
                Save & Mark Paid
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
