import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, BookOpen, Star, Sparkles, CheckCircle2, Pencil, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnquirySuccessAnimationProps {
  isVisible: boolean;
  onClose: () => void;
}

const FloatingIcon = ({
  children,
  delay,
  x,
  y,
}: {
  children: React.ReactNode;
  delay: number;
  x: number;
  y: number;
}) => (
  <motion.div
    className="absolute"
    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
    animate={{
      opacity: [0, 1, 1, 0],
      scale: [0, 1.2, 1, 0.8],
      x: [0, x * 0.5, x],
      y: [0, y * 0.3, y],
      rotate: [0, 15, -15, 0],
    }}
    transition={{
      duration: 2.5,
      delay,
      ease: "easeOut",
    }}
  >
    {children}
  </motion.div>
);

const Confetti = ({ delay, color }: { delay: number; color: string }) => (
  <motion.div
    className={`absolute w-3 h-3 rounded-sm ${color}`}
    initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 0 }}
    animate={{
      opacity: [0, 1, 1, 0],
      y: [0, -100, 200],
      x: [0, Math.random() * 200 - 100],
      rotate: [0, 360, 720],
      scale: [0, 1, 0.5],
    }}
    transition={{
      duration: 2,
      delay,
      ease: "easeOut",
    }}
  />
);

const EnquirySuccessAnimation = ({ isVisible, onClose }: EnquirySuccessAnimationProps) => {
  const confettiColors = [
    "bg-primary",
    "bg-secondary",
    "bg-yellow-400",
    "bg-green-400",
    "bg-blue-400",
    "bg-purple-400",
    "bg-pink-400",
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Confetti burst */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, -50%)`,
                }}
              >
                <Confetti
                  delay={i * 0.05}
                  color={confettiColors[i % confettiColors.length]}
                />
              </div>
            ))}
          </div>

          {/* Floating educational icons */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <FloatingIcon delay={0.2} x={-120} y={-100}>
                <BookOpen className="w-10 h-10 text-primary" />
              </FloatingIcon>
              <FloatingIcon delay={0.4} x={130} y={-80}>
                <Pencil className="w-8 h-8 text-secondary" />
              </FloatingIcon>
              <FloatingIcon delay={0.3} x={-100} y={80}>
                <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
              </FloatingIcon>
              <FloatingIcon delay={0.5} x={110} y={100}>
                <Award className="w-10 h-10 text-primary" />
              </FloatingIcon>
              <FloatingIcon delay={0.6} x={-150} y={-20}>
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </FloatingIcon>
              <FloatingIcon delay={0.7} x={160} y={20}>
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </FloatingIcon>
            </div>
          </div>

          {/* Main content */}
          <motion.div
            className="relative z-10 text-center px-6"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
          >
            {/* Graduation cap with bounce */}
            <motion.div
              className="relative mx-auto mb-6"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 10 }}
            >
              <motion.div
                animate={{
                  y: [0, -15, 0],
                  rotateZ: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="relative"
              >
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1.5, 1.8, 1.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-2xl">
                  <GraduationCap className="w-12 h-12 text-primary-foreground" />
                </div>
              </motion.div>

              {/* Success checkmark */}
              <motion.div
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 400, damping: 10 }}
              >
                <CheckCircle2 className="w-6 h-6 text-white" />
              </motion.div>
            </motion.div>

            {/* Text content */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.h2
                className="text-3xl md:text-4xl font-bold font-heading mb-3 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ backgroundSize: "200% 200%" }}
              >
                Welcome Aboard!
              </motion.h2>
              <motion.p
                className="text-muted-foreground text-lg mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                Your learning journey begins here 🎓
              </motion.p>
              <motion.p
                className="text-sm text-muted-foreground mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                We'll get back to you very soon!
              </motion.p>
            </motion.div>

            {/* Animated stars around text */}
            <motion.div
              className="absolute -top-4 left-1/4"
              animate={{
                rotate: 360,
                scale: [1, 1.2, 1],
              }}
              transition={{
                rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                scale: { duration: 1, repeat: Infinity },
              }}
            >
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </motion.div>
            <motion.div
              className="absolute -top-2 right-1/4"
              animate={{
                rotate: -360,
                scale: [1, 1.3, 1],
              }}
              transition={{
                rotate: { duration: 5, repeat: Infinity, ease: "linear" },
                scale: { duration: 1.2, repeat: Infinity, delay: 0.3 },
              }}
            >
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            </motion.div>

            {/* Button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1, type: "spring" }}
            >
              <Button
                size="lg"
                onClick={onClose}
                className="px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Submit Another Enquiry
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EnquirySuccessAnimation;
