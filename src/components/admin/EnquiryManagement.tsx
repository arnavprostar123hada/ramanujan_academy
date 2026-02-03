import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserPlus, 
  Phone, 
  Mail, 
  Calendar, 
  GraduationCap, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  BookOpen,
  User,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

interface EnquiryManagementProps {
  enquiries: Enquiry[];
  onRefresh: () => void;
}

const CLASSES = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500",
  followup: "bg-blue-500/20 text-blue-700 border-blue-500",
  promoted: "bg-green-500/20 text-green-700 border-green-500",
  rejected: "bg-red-500/20 text-red-700 border-red-500",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  followup: <Calendar className="w-3 h-3" />,
  promoted: <CheckCircle className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
};

export const EnquiryManagement = ({ enquiries, onRefresh }: EnquiryManagementProps) => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [expandedEnquiry, setExpandedEnquiry] = useState<string | null>(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  const filteredEnquiries = enquiries.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (classFilter !== "all" && e.class !== classFilter) return false;
    return true;
  });

  const stats = {
    total: enquiries.length,
    pending: enquiries.filter(e => e.status === "pending").length,
    followup: enquiries.filter(e => e.status === "followup").length,
    promoted: enquiries.filter(e => e.status === "promoted").length,
    rejected: enquiries.filter(e => e.status === "rejected").length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleStatusChange = async (enquiryId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("enquiries")
        .update({ status: newStatus })
        .eq("id", enquiryId);

      if (error) throw error;

      toast({ title: "Status updated successfully" });
      onRefresh();
    } catch (error) {
      toast({
        title: "Error updating status",
        variant: "destructive",
      });
    }
  };

  const handlePromoteToStudent = async () => {
    if (!selectedEnquiry) return;
    setIsPromoting(true);

    try {
      // Create student from enquiry
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .insert({
          name: selectedEnquiry.name,
          phone: selectedEnquiry.parent_phone,
          class: selectedEnquiry.class,
          parent_name: selectedEnquiry.parent_name,
          email: selectedEnquiry.parent_email,
        } as any)
        .select()
        .single();

      if (studentError) throw studentError;

      // Update enquiry status
      const { error: updateError } = await supabase
        .from("enquiries")
        .update({
          status: "promoted",
          promoted_at: new Date().toISOString(),
          promoted_student_id: studentData.id,
        })
        .eq("id", selectedEnquiry.id);

      if (updateError) throw updateError;

      toast({
        title: "Student Created Successfully! 🎉",
        description: `${selectedEnquiry.name} has been promoted to a student.`,
      });

      setPromoteDialogOpen(false);
      setSelectedEnquiry(null);
      onRefresh();
    } catch (error) {
      console.error("Error promoting enquiry:", error);
      toast({
        title: "Error promoting to student",
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Student Enquiries
        </CardTitle>
        
        {/* Stats Row */}
        <div className="flex flex-wrap gap-3 mt-4">
          <Badge variant="outline" className="px-3 py-1">
            Total: {stats.total}
          </Badge>
          <Badge className={`px-3 py-1 ${statusColors.pending}`}>
            Pending: {stats.pending}
          </Badge>
          <Badge className={`px-3 py-1 ${statusColors.followup}`}>
            Follow-up: {stats.followup}
          </Badge>
          <Badge className={`px-3 py-1 ${statusColors.promoted}`}>
            Promoted: {stats.promoted}
          </Badge>
          <Badge className={`px-3 py-1 ${statusColors.rejected}`}>
            Rejected: {stats.rejected}
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="followup">Follow-up</SelectItem>
              <SelectItem value="promoted">Promoted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {CLASSES.map(cls => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredEnquiries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No enquiries found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredEnquiries.map((enquiry) => (
                <motion.div
                  key={enquiry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Enquiry Header */}
                  <div 
                    className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedEnquiry(expandedEnquiry === enquiry.id ? null : enquiry.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{enquiry.name}</h4>
                          <Badge variant="secondary">{enquiry.class}</Badge>
                          <Badge variant="outline">{enquiry.board}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {enquiry.parent_phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(enquiry.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={`${statusColors[enquiry.status]} flex items-center gap-1`}>
                        {statusIcons[enquiry.status]}
                        {enquiry.status}
                      </Badge>
                      {expandedEnquiry === enquiry.id ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedEnquiry === enquiry.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t bg-muted/30"
                      >
                        <div className="p-4 space-y-4">
                          {/* Student Info */}
                          <div className="grid md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Gender</p>
                              <p className="font-medium capitalize">{enquiry.gender}</p>
                            </div>
                            {enquiry.date_of_birth && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date of Birth</p>
                                <p className="font-medium">{formatDate(enquiry.date_of_birth)}</p>
                              </div>
                            )}
                            {enquiry.previous_school && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Previous School</p>
                                <p className="font-medium">{enquiry.previous_school}</p>
                              </div>
                            )}
                          </div>

                          {/* Parent Info */}
                          <div className="p-3 bg-background rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <User className="w-3 h-3" /> Parent Details
                            </p>
                            <div className="grid md:grid-cols-4 gap-3">
                              <div>
                                <p className="text-sm text-muted-foreground">Name</p>
                                <p className="font-medium">{enquiry.parent_name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Phone</p>
                                <a href={`tel:${enquiry.parent_phone}`} className="font-medium text-primary hover:underline">
                                  {enquiry.parent_phone}
                                </a>
                              </div>
                              {enquiry.parent_email && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Email</p>
                                  <a href={`mailto:${enquiry.parent_email}`} className="font-medium text-primary hover:underline">
                                    {enquiry.parent_email}
                                  </a>
                                </div>
                              )}
                              {enquiry.parent_occupation && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Occupation</p>
                                  <p className="font-medium">{enquiry.parent_occupation}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Academic Info */}
                          <div className="p-3 bg-background rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" /> Academic Details
                            </p>
                            <div className="space-y-3">
                              {enquiry.previous_percentage && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Previous Percentage</p>
                                  <p className="font-bold text-lg">{enquiry.previous_percentage}%</p>
                                </div>
                              )}
                              {enquiry.strong_subjects && enquiry.strong_subjects.length > 0 && (
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Strong Subjects</p>
                                  <div className="flex flex-wrap gap-1">
                                    {enquiry.strong_subjects.map(subject => (
                                      <Badge key={subject} className="bg-green-500/20 text-green-700 border-green-500">
                                        {subject}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {enquiry.weak_subjects && enquiry.weak_subjects.length > 0 && (
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Weak Subjects</p>
                                  <div className="flex flex-wrap gap-1">
                                    {enquiry.weak_subjects.map(subject => (
                                      <Badge key={subject} className="bg-red-500/20 text-red-700 border-red-500">
                                        {subject}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {enquiry.academic_notes && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Academic Notes</p>
                                  <p className="text-sm">{enquiry.academic_notes}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Source & Notes */}
                          {(enquiry.source || enquiry.notes) && (
                            <div className="grid md:grid-cols-2 gap-4">
                              {enquiry.source && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Source</p>
                                  <p className="text-sm">{enquiry.source}</p>
                                </div>
                              )}
                              {enquiry.notes && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                                  <p className="text-sm">{enquiry.notes}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t">
                            {enquiry.status !== "promoted" && (
                              <>
                                <Select
                                  value={enquiry.status}
                                  onValueChange={(value) => handleStatusChange(enquiry.id, value)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="followup">Follow-up</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Button
                                  onClick={() => {
                                    setSelectedEnquiry(enquiry);
                                    setPromoteDialogOpen(true);
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <ArrowUpRight className="w-4 h-4 mr-2" />
                                  Promote to Student
                                </Button>
                              </>
                            )}

                            {enquiry.status === "promoted" && enquiry.promoted_at && (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Promoted on {formatDate(enquiry.promoted_at)}
                              </Badge>
                            )}

                            <a href={`https://wa.me/91${enquiry.parent_phone}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm">
                                <Phone className="w-4 h-4 mr-2" />
                                WhatsApp
                              </Button>
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      {/* Promote Confirmation Dialog */}
      <AlertDialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to promote <strong>{selectedEnquiry?.name}</strong> to a student?
              This will create a new student record with the enquiry details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPromoting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePromoteToStudent}
              disabled={isPromoting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPromoting ? "Promoting..." : "Promote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
