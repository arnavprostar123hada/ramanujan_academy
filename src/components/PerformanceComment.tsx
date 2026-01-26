import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, TrendingDown, Minus, Award, ThumbsUp, AlertTriangle } from "lucide-react";

interface PerformanceCommentProps {
  percentage: number;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export const getPerformanceComment = (percentage: number): { 
  comment: string; 
  color: string; 
  bgColor: string;
  icon: "star" | "award" | "thumbsUp" | "trendingUp" | "minus" | "trendingDown" | "alert";
} => {
  if (percentage >= 90) {
    return { 
      comment: "Outstanding! Keep it up! 🌟", 
      color: "text-emerald-700", 
      bgColor: "bg-emerald-100 border-emerald-200",
      icon: "star"
    };
  } else if (percentage >= 80) {
    return { 
      comment: "Excellent work! 🏆", 
      color: "text-green-700", 
      bgColor: "bg-green-100 border-green-200",
      icon: "award"
    };
  } else if (percentage >= 70) {
    return { 
      comment: "Good going! Keep improving 👍", 
      color: "text-blue-700", 
      bgColor: "bg-blue-100 border-blue-200",
      icon: "thumbsUp"
    };
  } else if (percentage >= 60) {
    return { 
      comment: "Satisfactory. More effort needed 📈", 
      color: "text-yellow-700", 
      bgColor: "bg-yellow-100 border-yellow-200",
      icon: "trendingUp"
    };
  } else if (percentage >= 50) {
    return { 
      comment: "Average. Focus on weak areas 📊", 
      color: "text-orange-700", 
      bgColor: "bg-orange-100 border-orange-200",
      icon: "minus"
    };
  } else if (percentage >= 35) {
    return { 
      comment: "Needs improvement. Study harder! 📉", 
      color: "text-red-600", 
      bgColor: "bg-red-100 border-red-200",
      icon: "trendingDown"
    };
  } else {
    return { 
      comment: "Critical! Needs immediate attention ⚠️", 
      color: "text-red-700", 
      bgColor: "bg-red-200 border-red-300",
      icon: "alert"
    };
  }
};

const iconMap = {
  star: Star,
  award: Award,
  thumbsUp: ThumbsUp,
  trendingUp: TrendingUp,
  minus: Minus,
  trendingDown: TrendingDown,
  alert: AlertTriangle,
};

export const PerformanceComment = ({ percentage, showIcon = true, size = "md" }: PerformanceCommentProps) => {
  const { comment, color, bgColor, icon } = getPerformanceComment(percentage);
  const IconComponent = iconMap[icon];
  
  const sizeClasses = {
    sm: "text-xs py-1 px-2",
    md: "text-sm py-1.5 px-3",
    lg: "text-base py-2 px-4",
  };
  
  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border ${bgColor} ${sizeClasses[size]}`}>
      {showIcon && <IconComponent className={`${iconSizes[size]} ${color}`} />}
      <span className={`font-medium ${color}`}>{comment}</span>
    </div>
  );
};

export const PerformanceBadge = ({ percentage }: { percentage: number }) => {
  const { color, bgColor } = getPerformanceComment(percentage);
  
  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B+";
  else if (percentage >= 60) grade = "B";
  else if (percentage >= 50) grade = "C";
  else if (percentage >= 35) grade = "D";
  
  return (
    <Badge className={`${bgColor} ${color} border`}>
      Grade: {grade}
    </Badge>
  );
};
