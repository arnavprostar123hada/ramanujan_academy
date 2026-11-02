import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export const config = { verify_jwt: true };

// Initial server-side generation endpoint. Uses only server-held provider keys.
// A provider integration is deliberately required before returning generated questions.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !authHeader) return json({ error: "Authentication is required." }, 401);

  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await client.from("user_profiles").select("role,active").eq("id", user.id).maybeSingle();
  if (!profile?.active || !["owner", "admin", "teacher"].includes(profile.role)) return json({ error: "Staff access required." }, 403);

  const payload = await req.json().catch(() => null);
  if (!payload || !["CBSE", "ICSE"].includes(payload.board) || !payload.className || !payload.subject || !payload.chapters || !Number.isInteger(payload.totalMarks)) {
    return json({ error: "Please provide board, class, subject, chapters and total marks." }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return json({ error: "AI provider is not configured yet. Add an approved provider key as an Edge Function secret." }, 503);

  // The API key is never sent to the client. Configure a verified model/provider,
  // board pattern source, and JSON schema before activating generation in production.
  return json({ error: "AI provider adapter is not yet configured. The paper builder can save and export teacher-reviewed templates." }, 501);
});

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ramanujanacademy.in",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
