import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import CoursesSection from "@/components/CoursesSection";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import FloatingCTA from "@/components/FloatingCTA";
import { useVisitTracker } from "@/hooks/useVisitTracker";

const Index = () => {
  useVisitTracker();

  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <CoursesSection />
      <ContactForm />
      <Footer />
      <FloatingCTA />
    </div>
  );
};

export default Index;
