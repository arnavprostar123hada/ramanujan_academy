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
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users } from "lucide-react";

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

interface StudentComparisonChartProps {
  studentId: string;
  studentName?: string;
  studentClass: string;
  tests: Test[];
  testResults: TestResult[];
}

export const StudentComparisonChart = ({ 
  studentId,
  studentName = "Student",
  studentClass,
  tests, 
  testResults,
}: StudentComparisonChartProps) => {
  
  // Calculate comparison data
  const comparisonData = useMemo(() => {
    // Get tests for this class
    const classTests = tests.filter(t => t.class === studentClass);
    
    return classTests.map(test => {
      // Get all results for this test
      const allResults = testResults.filter(r => r.test_id === test.id);
      
      // Calculate class average
      const classAverage = allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + (r.marks_obtained / test.max_marks) * 100, 0) / allResults.length)
        : 0;
      
      // Get student's result
      const studentResult = allResults.find(r => r.student_id === studentId);
      const studentPercentage = studentResult 
        ? Math.round((studentResult.marks_obtained / test.max_marks) * 100)
        : null;
      
      return {
        test: test.title.length > 12 ? test.title.substring(0, 12) + '...' : test.title,
        fullTitle: test.title,
        subject: test.subject,
        studentScore: studentPercentage,
        classAverage: classAverage,
        date: new Date(test.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      };
    }).filter(d => d.studentScore !== null).reverse().slice(0, 10);
  }, [studentId, studentClass, tests, testResults]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (comparisonData.length === 0) return null;
    
    const studentAvg = Math.round(comparisonData.reduce((sum, d) => sum + (d.studentScore || 0), 0) / comparisonData.length);
    const classAvg = Math.round(comparisonData.reduce((sum, d) => sum + d.classAverage, 0) / comparisonData.length);
    const difference = studentAvg - classAvg;
    
    return {
      studentAvg,
      classAvg,
      difference,
      isAboveAverage: difference >= 0,
      testsAboveAvg: comparisonData.filter(d => (d.studentScore || 0) >= d.classAverage).length,
      totalTests: comparisonData.length,
    };
  }, [comparisonData]);

  if (comparisonData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Performance vs Class Average
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Not enough data for comparison</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Your Average</p>
              <p className="text-2xl font-bold text-primary">{overallStats.studentAvg}%</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Class Average</p>
              <p className="text-2xl font-bold">{overallStats.classAvg}%</p>
            </CardContent>
          </Card>
          <Card className={overallStats.isAboveAverage ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Difference</p>
              <p className={`text-2xl font-bold ${overallStats.isAboveAverage ? "text-green-600" : "text-orange-600"}`}>
                {overallStats.isAboveAverage ? "+" : ""}{overallStats.difference}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tests Above Avg</p>
              <p className="text-2xl font-bold">{overallStats.testsAboveAvg}/{overallStats.totalTests}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparison Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {studentName} vs Class Average
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="test" 
                  tick={{ fontSize: 10 }} 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value}%`, 
                    name === 'studentScore' ? 'Your Score' : 'Class Average'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `${payload[0].payload.fullTitle} (${payload[0].payload.subject})`;
                    }
                    return label;
                  }}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend 
                  formatter={(value) => value === 'studentScore' ? 'Your Score' : 'Class Average'}
                />
                <Bar 
                  dataKey="studentScore" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="studentScore"
                />
                <Bar 
                  dataKey="classAverage" 
                  fill="hsl(var(--muted-foreground))" 
                  radius={[4, 4, 0, 0]}
                  name="classAverage"
                  opacity={0.5}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
