import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { studentName, studentClass, message, parentPhone } = await req.json();

    // Log the notification (in production, integrate with SMS/email provider)
    console.log("=== NEW PARENT MESSAGE NOTIFICATION ===");
    console.log(`Student: ${studentName} (Class ${studentClass})`);
    console.log(`Parent Phone: ${parentPhone}`);
    console.log(`Message: ${message}`);
    console.log("========================================");

    // For now, we'll store this as a notification log
    // In production, you would integrate with:
    // - SMS: Twilio, MSG91, etc.
    // - Email: Resend, SendGrid, etc.

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notification logged successfully. To enable SMS/email notifications, configure an SMS or email provider." 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-new-message:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
