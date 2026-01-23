import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { GraduationCap, Calculator, FlaskConical, BookText, Languages, Globe } from "lucide-react";

const CoursesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const courses = [
    {
      icon: Calculator,
      title: "Mathematics",
      description: "From basic concepts to advanced problem-solving",
      color: "bg-blue-500",
    },
    {
      icon: FlaskConical,
      title: "Science",
      description: "Physics, Chemistry, and Biology with practical approach",
      color: "bg-green-500",
    },
    {
      icon: Languages,
      title: "English",
      description: "Grammar, comprehension, and communication skills",
      color: "bg-purple-500",
    },
    {
      icon: BookText,
      title: "Social Studies",
      description: "History, Geography, and Civics made interesting",
      color: "bg-orange-500",
    },
    {
      icon: Globe,
      title: "Competitive Exams",
      description: "Preparation for various competitive examinations",
      color: "bg-red-500",
    },
    {
      icon: GraduationCap,
      title: "Board Exam Prep",
      description: "Focused coaching for 10th and 12th board exams",
      color: "bg-yellow-500",
    },
  ];

  return (
    <section ref={ref} className="section-padding bg-background" id="courses">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4">
            Our <span className="text-accent">Courses</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Comprehensive coaching for all subjects to help students excel in their academics
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => (
            <motion.div
              key={course.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="card-elevated p-6 group cursor-pointer"
            >
              <div className={`w-14 h-14 ${course.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <course.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2 group-hover:text-accent transition-colors">
                {course.title}
              </h3>
              <p className="text-muted-foreground text-sm">
                {course.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Classes Info */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="inline-block gradient-hero rounded-2xl p-8 md:p-12">
            <h3 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground mb-4">
              Classes Available
            </h3>
            <p className="text-primary-foreground/80 text-lg mb-6">
              We offer coaching for students from Class 5th to Class 12th
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"].map((cls) => (
                <span
                  key={cls}
                  className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-primary-foreground font-semibold"
                >
                  Class {cls}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CoursesSection;
