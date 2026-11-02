import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export const config = { verify_jwt: true };

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

const schema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          text: { type: "string" },
          marks: { type: "integer" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["type", "text", "marks", "answer"],
        additionalProperties: false
      }
    }
  },
  required: ["questions"],
  additionalProperties: false
};

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.questions)) throw new Error("AI returned an invalid question-paper structure.");
  return parsed.questions;
}

async function callGemini(key: string, prompt: string) {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.45 }
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "Gemini request failed.");
  const text = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("");
  if (!text) throw new Error("Gemini returned an empty response.");
  return extractJson(text);
}

async function callOpenAI(key: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      temperature: 0.45,
      response_format: { type: "json_schema", json_schema: { name: "question_paper", strict: true, schema } },
      messages: [
        { role: "system", content: "You are an expert school assessment setter. Return only valid structured question paper JSON." },
        { role: "user", content: prompt }
      ]
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "OpenAI request failed.");
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response.");
  return extractJson(text);
}

async function callOpenRouter(key: string, prompt: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://ramanujanacademy.in", "X-Title": "Ramanujan Academy AI Paper Setter" },
    body: JSON.stringify({
      model: Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.5-flash",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are an expert school assessment setter. Return only JSON with a questions array. Each question has type, text, marks, optional options, answer, and explanation." },
        { role: "user", content: prompt }
      ]
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "OpenRouter request failed.");
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned an empty response.");
  return extractJson(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !authHeader) return json({ error: "Authentication is required." }, 401);

  const token = authHeader.trim().replace(/^Bearer\s+/i, "");
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  // Verify the signed JWT locally via Supabase JWKS. auth.getUser() performs
  // a session lookup and can reject valid JWTs after session metadata changes.
  const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") return json({ error: "Your login session could not be verified. Please sign out and sign in again." }, 401);

  const { data: profile, error: profileError } = await client.from("user_profiles").select("role,active").eq("id", userId).maybeSingle();
  if (profileError) return json({ error: "Could not verify staff permissions: " + profileError.message }, 500);
  if (!profile?.active || !["owner", "admin", "teacher"].includes(profile.role)) return json({ error: "Staff access required." }, 403);

  const payload = await req.json().catch(() => null);
  const allowedTypes = ["mcq", "assertion", "case", "competency", "short", "long"];
  if (!payload || !["CBSE", "ICSE"].includes(payload.board) || !String(payload.className || "").match(/^(6|7|8|9|10|11|12)$/) ||
      !String(payload.subject || "").trim() || !String(payload.chapters || "").trim() ||
      !Number.isInteger(payload.totalMarks) || payload.totalMarks < 1 || payload.totalMarks > 100 ||
      !Number.isInteger(payload.duration) || payload.duration < 15 || payload.duration > 240 ||
      !Array.isArray(payload.questionTypes) || !payload.questionTypes.length ||
      payload.questionTypes.some((t: string) => !allowedTypes.includes(t))) {
    return json({ error: "Please check board, class, subject, chapters, marks, duration and question types." }, 400);
  }

  const provider = Deno.env.get("AI_PROVIDER") || (Deno.env.get("GEMINI_API_KEY") ? "gemini" : Deno.env.get("OPENAI_API_KEY") ? "openai" : "openrouter");
  const key = provider === "gemini" ? Deno.env.get("GEMINI_API_KEY")
    : provider === "openai" ? Deno.env.get("OPENAI_API_KEY")
    : provider === "openrouter" ? Deno.env.get("OPENROUTER_API_KEY") : undefined;
  if (!key) return json({ error: `AI provider key is missing. Add ${provider.toUpperCase()}_API_KEY in Supabase Edge Function secrets, then retry.` }, 503);

  const prompt = `Create a complete original school examination paper for Ramanujan Academy.
Board: ${payload.board}. Class: ${payload.className}. Subject: ${payload.subject}.
Academic year: ${payload.academicYear || "2026-27"}. Chapters/units (use only these): ${payload.chapters}.
Maximum marks: ${payload.totalMarks}. Duration: ${payload.duration} minutes.
Difficulty: ${payload.difficulty || "Balanced"}. Required question formats: ${payload.questionTypes.join(", ")}.
Instructions: ${payload.instructions || "Use clear student-friendly language."}
Create a sensible number of questions whose marks add up to exactly ${payload.totalMarks}. Do not exceed or fall short of the total. Spread marks and difficulty sensibly. Include MCQ options for MCQs, and options only where appropriate. Use age-appropriate, unambiguous questions, correct terminology, and varied cognitive skills. Do not claim this is an official board paper or invent textbook page references. For every question provide a correct concise answer and a brief explanation/marking guidance. Return JSON only with a questions array. Each question must have type, text, integer marks, answer, explanation, and optional options array.`;

  try {
    let questions = provider === "gemini" ? await callGemini(key, prompt)
      : provider === "openai" ? await callOpenAI(key, prompt)
      : provider === "openrouter" ? await callOpenRouter(key, prompt)
      : null;
    if (!questions) return json({ error: "Unsupported AI_PROVIDER. Choose gemini, openai or openrouter." }, 500);

    questions = questions.map((q: any, index: number) => ({
      id: crypto.randomUUID(),
      type: String(q.type || "Question"),
      text: String(q.text || "").trim(),
      marks: Number(q.marks),
      options: Array.isArray(q.options) ? q.options.map(String) : undefined,
      answer: String(q.answer || "").trim(),
      explanation: String(q.explanation || "").trim()
    }));
    if (questions.some((q: any) => !q.text || !q.answer || !Number.isInteger(q.marks) || q.marks < 1)) {
      return json({ error: "The AI generated an incomplete question. Please retry." }, 502);
    }
    const actualMarks = questions.reduce((sum: number, q: any) => sum + q.marks, 0);
    if (actualMarks !== payload.totalMarks) {
      return json({ error: `AI generated ${actualMarks} marks instead of ${payload.totalMarks}. Please click generate again.` , actualMarks }, 502);
    }
    return json({ questions, provider, totalMarks: actualMarks });
  } catch (error) {
    console.error("AI paper generation failed:", error);
    return json({ error: error instanceof Error ? error.message : "AI generation failed. Please retry." }, 502);
  }
});
