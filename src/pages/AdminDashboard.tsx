import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface VisitStats {
  total: number;
  today: number;
  thisWeek: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [visitStats, setVisitStats] = useState<VisitStats>({ total: 0, today: 0, thisWeek: 0 });
  const [isLoading, setIsLoading] = useState(true);

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
      .single();

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

  const unreadCount = submissions.filter(s => !s.is_read).length;

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
            transition={{ delay: 0.3 }}
          >
            <Card className="card-elevated">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Week
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{visitStats.thisWeek}</div>
                <p className="text-xs text-muted-foreground">visitors this week</p>
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
                <Eye className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{visitStats.total}</div>
                <p className="text-xs text-muted-foreground">all time</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Submissions List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Form Submissions
                {unreadCount > 0 && (
                  <Badge variant="destructive">{unreadCount} new</Badge>
                )}
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
      </main>
    </div>
  );
};

export default AdminDashboard;
