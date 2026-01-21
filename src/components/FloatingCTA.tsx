import { motion } from "framer-motion";
import { Phone, MessageCircle } from "lucide-react";

const FloatingCTA = () => {
  const phoneNumber = "7774848245";

  return (
    <div className="floating-cta">
      <motion.a
        href={`tel:${phoneNumber}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.3 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        className="cta-button bg-secondary text-secondary-foreground animate-pulse-glow"
        aria-label="Call us"
      >
        <Phone className="w-6 h-6" />
      </motion.a>

      <motion.a
        href={`https://wa.me/91${phoneNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.7, duration: 0.3 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        className="cta-button bg-green-600 text-white"
        aria-label="WhatsApp us"
      >
        <MessageCircle className="w-6 h-6" />
      </motion.a>
    </div>
  );
};

export default FloatingCTA;
