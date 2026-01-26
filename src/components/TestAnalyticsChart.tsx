import { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon } from "lucide-react";

interface Test {
  id: string;
  title: string;
  subject: string;
  class: string;
  test_date: string;
  max_marks: number;
}

interface TestResult {
  id: string;
  test_id: string;
  student_id: string;
  marks_obtained: number;
}

interface Student {
  id: string;
  name: string;
  class: string;
}

interface TestAnalyticsChartProps {
  tests: Test[];
  testResults: TestResult[];
  students: Student[];
  selectedClass?: string;
  showClassComparison?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const TestAnalyticsChart = ({ 
  tests, 
  testResults, 
  students, 
  selectedClass,
  showClassComparison = false
}: TestAnalyticsChartProps) => {
  
  // Calculate class-wise performance data
  const classPerformanceData = useMemo(() => {
    const classes = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
    
    return classes.map(cls => {
      const classTests = tests.filter(t => t.class === cls);
      const classStudents = students.filter(s => s.class === cls);
      
      if (classTests.length === 0 || classStudents.length === 0) {
        return { class: cls, average: 0, tests: 0, students: classStudents.length };
      }
      
      let totalPercentage = 0;
      let count = 0;
      
      classTests.forEach(test => {
        const results = testResults.filter(r => r.test_id === test.id);
        results.forEach(result => {
          totalPercentage += (result.marks_obtained / test.max_marks) * 100;
          count++;
        });
      });
      
      return {
        class: cls,
        average: count > 0 ? Math.round(totalPercentage / count) : 0,
        tests: classTests.length,
        students: classStudents.length,
      };
    }).filter(d => d.students > 0);
  }, [tests, testResults, students]);

  // Calculate subject-wise performance
  const subjectPerformanceData = useMemo(() => {
    const subjects = [...new Set(tests.map(t => t.subject))];
    
    return subjects.map(subject => {
      const subjectTests = selectedClass 
        ? tests.filter(t => t.subject === subject && t.class === selectedClass)
        : tests.filter(t => t.subject === subject);
      
      if (subjectTests.length === 0) return null;
      
      let totalPercentage = 0;
      let count = 0;
      
      subjectTests.forEach(test => {
        const results = testResults.filter(r => r.test_id === test.id);
        results.forEach(result => {
          totalPercentage += (result.marks_obtained / test.max_marks) * 100;
          count++;
        });
      });
      
      return {
        subject,
        average: count > 0 ? Math.round(totalPercentage / count) : 0,
        tests: subjectTests.length,
      };
    }).filter(Boolean) as { subject: string; average: number; tests: number }[];
  }, [tests, testResults, selectedClass]);

  // Performance distribution for pie chart
  const performanceDistribution = useMemo(() => {
    const relevantTests = selectedClass 
      ? tests.filter(t => t.class === selectedClass)
      : tests;
    
    const distribution = {
      "90-100% (Outstanding)": 0,
      "70-89% (Good)": 0,
      "50-69% (Average)": 0,
      "Below 50% (Needs Work)": 0,
    };
    
    relevantTests.forEach(test => {
      const results = testResults.filter(r => r.test_id === test.id);
      results.forEach(result => {
        const percentage = (result.marks_obtained / test.max_marks) * 100;
        if (percentage >= 90) distribution["90-100% (Outstanding)"]++;
        else if (percentage >= 70) distribution["70-89% (Good)"]++;
        else if (percentage >= 50) distribution["50-69% (Average)"]++;
        else distribution["Below 50% (Needs Work)"]++;
      });
    });
    
    return Object.entries(distribution).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [tests, testResults, selectedClass]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const relevantTests = selectedClass 
      ? tests.filter(t => t.class === selectedClass)
      : tests;
    
    const monthlyData: { [key: string]: { total: number; count: number } } = {};
    
    relevantTests.forEach(test => {
      const date = new Date(test.test_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, count: 0 };
      }
      
      const results = testResults.filter(r => r.test_id === test.id);
      results.forEach(result => {
        monthlyData[monthKey].total += (result.marks_obtained / test.max_marks) * 100;
        monthlyData[monthKey].count++;
      });
    });
    
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          month: date.toLocaleDateString('en-IN', { month: 'short' }),
          average: data.count > 0 ? Math.round(data.total / data.count) : 0,
        };
      });
  }, [tests, testResults, selectedClass]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Class-wise Performance Bar Chart */}
      {showClassComparison && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Class-wise Average Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classPerformanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Average']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar 
                    dataKey="average" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Average %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject-wise Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Subject-wise Performance {selectedClass ? `(Class ${selectedClass})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {subjectPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectPerformanceData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="subject" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Average']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar 
                    dataKey="average" 
                    fill="hsl(var(--accent))" 
                    radius={[0, 4, 4, 0]}
                    name="Average %"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No test data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Distribution Pie Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            Performance Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {performanceDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {performanceDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Students']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No test data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {monthlyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Average']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="average" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAvg)"
                    name="Average %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Single Student Analytics for Parent Portal
export const StudentTestAnalytics = ({ 
  studentId,
  tests, 
  testResults,
}: { 
  studentId: string;
  tests: Test[];
  testResults: TestResult[];
}) => {
  const studentResults = useMemo(() => {
    return testResults.filter(r => r.student_id === studentId);
  }, [testResults, studentId]);

  const testPerformanceData = useMemo(() => {
    return studentResults.map(result => {
      const test = tests.find(t => t.id === result.test_id);
      if (!test) return null;
      
      return {
        test: test.title.length > 15 ? test.title.substring(0, 15) + '...' : test.title,
        fullTitle: test.title,
        subject: test.subject,
        percentage: Math.round((result.marks_obtained / test.max_marks) * 100),
        marks: result.marks_obtained,
        maxMarks: test.max_marks,
        date: new Date(test.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      };
    }).filter(Boolean).reverse();
  }, [studentResults, tests]);

  const subjectWiseData = useMemo(() => {
    const subjectMap: { [key: string]: { total: number; count: number } } = {};
    
    studentResults.forEach(result => {
      const test = tests.find(t => t.id === result.test_id);
      if (!test) return;
      
      const percentage = (result.marks_obtained / test.max_marks) * 100;
      
      if (!subjectMap[test.subject]) {
        subjectMap[test.subject] = { total: 0, count: 0 };
      }
      subjectMap[test.subject].total += percentage;
      subjectMap[test.subject].count++;
    });
    
    return Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      average: Math.round(data.total / data.count),
    }));
  }, [studentResults, tests]);

  if (studentResults.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <LineChartIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No test results yet to show analytics</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Performance Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={testPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number, name, props) => [
                    `${value}% (${props.payload?.marks}/${props.payload?.maxMarks})`,
                    props.payload?.fullTitle
                  ]}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="percentage" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPerf)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Subject-wise Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Subject-wise Average
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectWiseData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis dataKey="subject" type="category" width={60} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Average']}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="average" 
                  fill="#3b82f6" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
