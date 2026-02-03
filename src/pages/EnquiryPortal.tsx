import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";
import EnquirySuccessAnimation from "@/components/EnquirySuccessAnimation";

const CLASSES = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const BOARDS = ["CBSE", "ICSE", "State Board", "IB", "IGCSE", "Other"];
const SUBJECTS = ["Mathematics", "Science", "Physics", "Chemistry", "Biology", "English", "Hindi", "Social Studies", "Computer Science", "Other"];

const EnquiryPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    class: "",
    board: "",
    date_of_birth: "",
    gender: "",
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    parent_occupation: "",
    previous_school: "",
    previous_percentage: "",
    strong_subjects: [] as string[],
    weak_subjects: [] as string[],
    academic_notes: "",
    source: "",
    notes: "",
  });

  const handleSubjectToggle = (subject: string, type: "strong" | "weak") => {
    const field = type === "strong" ? "strong_subjects" : "weak_subjects";
    const otherField = type === "strong" ? "weak_subjects" : "strong_subjects";
    
    setFormData(prev => {
      const currentList = prev[field];
      const otherList = prev[otherField];
      
      // Remove from other list if exists
      const newOtherList = otherList.filter(s => s !== subject);
      
      // Toggle in current list
      const newList = currentList.includes(subject)
        ? currentList.filter(s => s !== subject)
        : [...currentList, subject];
      
      return {
        ...prev,
        [field]: newList,
        [otherField]: newOtherList,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.class || !formData.board || !formData.gender || !formData.parent_name || !formData.parent_phone) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("enquiries")
        .insert({
          name: formData.name.trim(),
          class: formData.class,
          board: formData.board,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender,
          parent_name: formData.parent_name.trim(),
          parent_phone: formData.parent_phone.trim(),
          parent_email: formData.parent_email.trim() || null,
          parent_occupation: formData.parent_occupation.trim() || null,
          previous_school: formData.previous_school.trim() || null,
          previous_percentage: formData.previous_percentage ? parseFloat(formData.previous_percentage) : null,
          strong_subjects: formData.strong_subjects.length > 0 ? formData.strong_subjects : null,
          weak_subjects: formData.weak_subjects.length > 0 ? formData.weak_subjects : null,
          academic_notes: formData.academic_notes.trim() || null,
          source: formData.source.trim() || null,
          notes: formData.notes.trim() || null,
        });

      if (error) throw error;

      // Show success animation instead of just toast
      setShowSuccessAnimation(true);
    } catch (error) {
      console.error("Error submitting enquiry:", error);
      toast({
        title: "Error submitting enquiry",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccessAnimation = () => {
    setShowSuccessAnimation(false);
    // Reset form after animation closes
    setFormData({
      name: "",
      class: "",
      board: "",
      date_of_birth: "",
      gender: "",
      parent_name: "",
      parent_phone: "",
      parent_email: "",
      parent_occupation: "",
      previous_school: "",
      previous_percentage: "",
      strong_subjects: [],
      weak_subjects: [],
      academic_notes: "",
      source: "",
      notes: "",
    });
  };

  return (
    <>
      <EnquirySuccessAnimation
        isVisible={showSuccessAnimation}
        onClose={handleCloseSuccessAnimation}
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Header */}
        <header className="bg-card border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h1 className="font-heading font-bold text-lg">Ramanujan Academy</h1>
                <p className="text-xs text-muted-foreground">Enquiry Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="card-elevated">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">New Student Enquiry</CardTitle>
              <CardDescription>
                Fill in the details of the prospective student
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Student Details Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2 text-primary">Student Details</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Student Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter student's full name"
                        required
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="class">Standard/Class *</Label>
                      <NativeSelect
                        id="class"
                        value={formData.class}
                        onValueChange={(value) => setFormData({ ...formData, class: value })}
                        placeholder="Select class"
                        options={CLASSES.map((cls) => ({ value: cls, label: cls }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="board">Board *</Label>
                      <NativeSelect
                        id="board"
                        value={formData.board}
                        onValueChange={(value) => setFormData({ ...formData, board: value })}
                        placeholder="Select board"
                        options={BOARDS.map((b) => ({ value: b, label: b }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Gender *</Label>
                      <NativeSelect
                        value={formData.gender}
                        onValueChange={(value) => setFormData({ ...formData, gender: value })}
                        placeholder="Select gender"
                        options={[
                          { value: "male", label: "Male" },
                          { value: "female", label: "Female" },
                          { value: "other", label: "Other" },
                        ]}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="previous_school">Previous School</Label>
                      <Input
                        id="previous_school"
                        value={formData.previous_school}
                        onChange={(e) => setFormData({ ...formData, previous_school: e.target.value })}
                        placeholder="Enter previous school name"
                        maxLength={200}
                      />
                    </div>
                  </div>
                </div>

                {/* Parent Details Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2 text-primary">Parent/Guardian Details</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parent_name">Parent/Guardian Name *</Label>
                      <Input
                        id="parent_name"
                        value={formData.parent_name}
                        onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                        placeholder="Enter parent's name"
                        required
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parent_phone">Phone Number *</Label>
                      <Input
                        id="parent_phone"
                        type="tel"
                        value={formData.parent_phone}
                        onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                        placeholder="Enter phone number"
                        required
                        maxLength={15}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parent_email">Email</Label>
                      <Input
                        id="parent_email"
                        type="email"
                        value={formData.parent_email}
                        onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                        placeholder="Enter email address"
                        maxLength={255}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parent_occupation">Occupation</Label>
                      <Input
                        id="parent_occupation"
                        value={formData.parent_occupation}
                        onChange={(e) => setFormData({ ...formData, parent_occupation: e.target.value })}
                        placeholder="Enter occupation"
                        maxLength={100}
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Details Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2 text-primary">Academic Details</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="previous_percentage">Previous Percentage (%)</Label>
                      <Input
                        id="previous_percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.previous_percentage}
                        onChange={(e) => setFormData({ ...formData, previous_percentage: e.target.value })}
                        placeholder="e.g., 85.5"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="source">How did they hear about us?</Label>
                      <Input
                        id="source"
                        value={formData.source}
                        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                        placeholder="e.g., Friend, Google, Banner"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {/* Strong Subjects */}
                  <div className="space-y-2">
                    <Label>Strong Subjects</Label>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map((subject) => (
                        <div
                          key={`strong-${subject}`}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                            formData.strong_subjects.includes(subject)
                              ? "bg-green-500/20 border-green-500 text-green-700"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => handleSubjectToggle(subject, "strong")}
                        >
                          <Checkbox
                            checked={formData.strong_subjects.includes(subject)}
                            className="pointer-events-none"
                          />
                          <span className="text-sm">{subject}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weak Subjects */}
                  <div className="space-y-2">
                    <Label>Weak Subjects</Label>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map((subject) => (
                        <div
                          key={`weak-${subject}`}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                            formData.weak_subjects.includes(subject)
                              ? "bg-red-500/20 border-red-500 text-red-700"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => handleSubjectToggle(subject, "weak")}
                        >
                          <Checkbox
                            checked={formData.weak_subjects.includes(subject)}
                            className="pointer-events-none"
                          />
                          <span className="text-sm">{subject}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="academic_notes">Academic Notes</Label>
                    <Textarea
                      id="academic_notes"
                      value={formData.academic_notes}
                      onChange={(e) => setFormData({ ...formData, academic_notes: e.target.value })}
                      placeholder="Any additional academic information (learning style, special needs, etc.)"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </div>

                {/* Additional Notes Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2 text-primary">Additional Notes</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Internal Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any other notes or observations about the enquiry"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5 mr-2" />
                        Submit Enquiry
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
    </>
  );
};

export default EnquiryPortal;
