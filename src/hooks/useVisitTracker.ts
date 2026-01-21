import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useVisitTracker = () => {
  useEffect(() => {
    const trackVisit = async () => {
      try {
        await supabase.from("page_visits").insert({
          page_path: window.location.pathname,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
        });
      } catch (error) {
        // Silently fail - visit tracking is non-critical
        console.log("Visit tracking failed:", error);
      }
    };

    trackVisit();
  }, []);
};
