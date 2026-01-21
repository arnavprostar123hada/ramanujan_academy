import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { BookOpen, Users, Trophy, Clock } from "lucide-react";

const AboutSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const stats = [
    { icon: Users, value: "1000+", label: "Students Taught" },
    { icon: Trophy, value: "95%", label: "Success Rate" },
    { icon: BookOpen, value: "10+", label: "Years Experience" },
    { icon: Clock, value: "24/7", label: "Support Available" },
  ];

  return (
    <section ref={ref} className="section-padding bg-muted/50" id="about">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4">
            About <span className="text-secondary">Ramanujan Academy</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            Named after the legendary mathematician Srinivasa Ramanujan, we carry forward 
            his legacy of excellence in education. Our academy provides comprehensive coaching 
            for students aspiring to excel in their academic journey.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-elevated p-6 text-center hover:shadow-xl transition-shadow duration-300"
            >
              <div className="w-14 h-14 mx-auto mb-4 gradient-accent rounded-xl flex items-center justify-center">
                <stat.icon className="w-7 h-7 text-accent-foreground" />
              </div>
              <h3 className="font-heading text-3xl font-bold text-foreground mb-1">
                {stat.value}
              </h3>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="card-elevated p-8"
          >
            <h3 className="font-heading text-2xl font-bold mb-4 text-accent">
              Our Mission
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              To provide quality education that empowers students to achieve academic excellence. 
              We believe every student has the potential to succeed with the right guidance and support. 
              Our dedicated faculty ensures personalized attention for each student.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="card-elevated p-8"
          >
            <h3 className="font-heading text-2xl font-bold mb-4 text-secondary">
              Why Choose Us?
            </h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary text-xl">✓</span>
                Experienced and qualified faculty members
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary text-xl">✓</span>
                Comprehensive study materials
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary text-xl">✓</span>
                Regular tests and performance tracking
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary text-xl">✓</span>
                Small batch sizes for personal attention
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
