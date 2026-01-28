import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, Calendar as CalendarIcon, BookOpen } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

interface ClassLog {
  id: string;
  teacher_id: string;
  class: string;
  content: string;
  log_date: string;
  created_at: string;
}

interface Teacher {
  id: string;
  name: string;
  phone: string;
}

interface ClassLogsCalendarProps {
  classLogs: ClassLog[];
  teachers: Teacher[];
  classFilter: string;
  teacherFilter: string;
}

export function ClassLogsCalendar({ classLogs, teachers, classFilter, teacherFilter }: ClassLogsCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Filter logs based on filters
  const filteredLogs = useMemo(() => {
    return classLogs
      .filter(log => classFilter === "all" || log.class === classFilter)
      .filter(log => teacherFilter === "all" || log.teacher_id === teacherFilter);
  }, [classLogs, classFilter, teacherFilter]);

  // Get logs for selected date
  const logsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return filteredLogs.filter(log => 
      isSameDay(new Date(log.log_date), selectedDate)
    );
  }, [filteredLogs, selectedDate]);

  // Create a map of dates that have logs
  const datesWithLogs = useMemo(() => {
    const dateMap = new Map<string, number>();
    filteredLogs.forEach(log => {
      const dateKey = log.log_date;
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });
    return dateMap;
  }, [filteredLogs]);

  // Custom day render to show dots for days with logs
  const modifiers = useMemo(() => {
    const hasLogs: Date[] = [];
    const manyLogs: Date[] = [];
    
    datesWithLogs.forEach((count, dateStr) => {
      const date = new Date(dateStr);
      if (count >= 3) {
        manyLogs.push(date);
      } else if (count > 0) {
        hasLogs.push(date);
      }
    });
    
    return { hasLogs, manyLogs };
  }, [datesWithLogs]);

  const modifiersStyles = {
    hasLogs: {
      position: 'relative' as const,
    },
    manyLogs: {
      position: 'relative' as const,
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <Card className="border-green-200">
        <CardContent className="pt-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border mx-auto"
            components={{
              DayContent: ({ date }) => {
                const dateKey = format(date, 'yyyy-MM-dd');
                const count = datesWithLogs.get(dateKey) || 0;
                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span>{date.getDate()}</span>
                    {count > 0 && (
                      <span 
                        className={`absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                          count >= 3 ? 'bg-green-500' : 'bg-green-300'
                        }`}
                      />
                    )}
                  </div>
                );
              },
            }}
          />
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-300" />
              <span>1-2 logs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>3+ logs</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs for Selected Date */}
      <Card className="border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a date'}
            </h3>
            {logsForSelectedDate.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {logsForSelectedDate.length} log{logsForSelectedDate.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <AnimatePresence mode="wait">
            {logsForSelectedDate.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 text-muted-foreground"
              >
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No logs for this date</p>
              </motion.div>
            ) : (
              <motion.div
                key="logs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 max-h-[400px] overflow-y-auto pr-2"
              >
                {logsForSelectedDate.map((log) => {
                  const teacher = teachers.find(t => t.id === log.teacher_id);
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg border bg-green-50/50 border-green-200"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                          Class {log.class}
                        </Badge>
                        {teacher && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {teacher.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{log.content}</p>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
