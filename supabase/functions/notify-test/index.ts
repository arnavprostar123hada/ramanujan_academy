import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyTestRequest {
  type: "announcement" | "result";
  studentName: string;
  studentClass: string;
  parentPhone: string;
  testTitle: string;
  testDate?: string;
  subject?: string;
  marksObtained?: number;
  maxMarks?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: NotifyTestRequest = await req.json();
    
    if (data.type === "announcement") {
      // Test announcement notification
      console.log("=== TEST ANNOUNCEMENT NOTIFICATION ===");
      console.log(`Student: ${data.studentName} (Class ${data.studentClass})`);
      console.log(`Parent Phone: ${data.parentPhone}`);
      console.log(`Test: ${data.testTitle}`);
      console.log(`Subject: ${data.subject}`);
      console.log(`Date: ${data.testDate}`);
      console.log("Message: New test scheduled!");
      console.log("======================================");
    } else if (data.type === "result") {
      // Test result notification
      console.log("=== TEST RESULT NOTIFICATION ===");
      console.log(`Student: ${data.studentName} (Class ${data.studentClass})`);
      console.log(`Parent Phone: ${data.parentPhone}`);
      console.log(`Test: ${data.testTitle}`);
      console.log(`Marks: ${data.marksObtained}/${data.maxMarks}`);
      console.log("================================");
    }

    // In production, integrate with SMS providers like:
    // - Twilio
    // - MSG91
    // - TextLocal
    // Example SMS message:
    // "Dear Parent, ${data.studentName} has ${data.type === 'announcement' ? 
    //   `a test scheduled: ${data.testTitle} on ${data.testDate}` : 
    //   `scored ${data.marksObtained}/${data.maxMarks} in ${data.testTitle}`}"

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${data.type === 'announcement' ? 'Test announcement' : 'Test result'} notification logged. Configure SMS provider for actual delivery.`
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-test:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
