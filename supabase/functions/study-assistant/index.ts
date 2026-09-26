import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Msg = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 6;
const MAX_MESSAGE_CHARS = 1800;
const MAX_SOURCE_CHARS = 4500;
const CACHE_HOURS = 24;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sse(text: string) {
  const chunks = text.match(/.{1,80}/gs) || [text];
  const body = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanMessages(messages: unknown): Msg[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

function fallback(messages: Msg[], mode: string, sourceText = "", actorRole = "student") {
  const last = messages.filter((m) => m.role === "user").at(-1)?.content?.trim() || "";
  if (!last) return actorRole === "teacher"
    ? "Teacher AI is ready. Ask for a lesson plan, worksheet, explanation, parent message, test analysis, or teaching idea."
    : "AI Study Assistant is ready. Ask me a question, topic, problem, or study request.";

  if (/^(hi|hello|hey|namaste|thanks|thank you)\b/i.test(last)) {
    return actorRole === "teacher"
      ? "Hello! I can help with lesson planning, worksheets, assessments, student interventions and parent communication."
      : "Hi! Tell me the topic or problem you want to study.";
  }

  if (mode === "notebook" && sourceText.trim()) {
    const excerpt = sourceText.trim().slice(0, 1200);
    return `AI is in low-cost fallback mode right now. Here is the most relevant source excerpt to start with:\n\n${excerpt}\n\nTry again shortly for a full source-grounded answer.`;
  }

  if (actorRole === "teacher") {
    if (/parent|whatsapp|message/i.test(last)) {
      return "Low-cost fallback: keep the parent message short, factual and action-oriented. State the student concern, the evidence/date, the action expected at home, and invite the parent to contact the academy.";
    }
    if (/worksheet|practice|questions|paper|test/i.test(last)) {
      return "Low-cost fallback: structure the worksheet as 3 easy questions, 4 standard questions, 2 application/HOTS questions and 1 challenge question, with marks and a separate answer key.";
    }
    return "Teacher AI is temporarily using low-cost fallback mode. For a full response, retry shortly. You can ask for a lesson plan, worksheet, test analysis, student intervention plan, or parent message.";
  }

  if (/summar|summary|revise|revision/i.test(last)) {
    return "Low-cost fallback: identify the topic, list the 5 key ideas, write one example for each, then finish with 5 self-check questions.";
  }

  return "AI service is temporarily busy, so I switched to low-cost fallback mode. Your request was not charged to the AI gateway. Please retry shortly for the full AI response.";
}

function buildSystemPrompt(mode: string, sourceText: string, actorRole: string) {
  if (actorRole === "teacher" || mode.startsWith("teacher_")) {
    return `You are Ramanujan Academy Teacher AI. Help teachers save time while improving teaching quality.
Be practical, concise and classroom-ready. Never invent student marks or facts that were not supplied.
For lesson plans include objective, explanation flow, activity, practice and quick assessment.
For worksheets/tests include clear questions and an answer key when appropriate.
For parent messages use respectful, concise WhatsApp-ready language.
For student interventions focus on observable academic behaviours and actionable support.
Use Indian school context and CBSE/ICSE/SSC terminology when supplied.`;
  }

  if (mode === "mindmap") {
    return `You create compact student mind maps. Return ONLY valid JSON:
{"title":"Main Topic","children":[{"title":"Subtopic","children":[{"title":"Detail","children":[]}]}]}
Use 3-5 branches and 2-3 details each. Titles max 8 words.`;
  }

  if (mode === "quiz") {
    return `You create a 5-question practice quiz for the student's class level. Return ONLY valid JSON:
{"title":"Quiz Title","questions":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]}
Use a mix of easy, medium and hard questions.`;
  }

  if (mode === "notebook") {
    return `Answer ONLY from the supplied source material. If the answer is not supported by the source, say so. Be concise and cite the relevant source wording by referring to its section or phrase.
SOURCE:
---
${sourceText || "No source material supplied."}
---`;
  }

  if (mode === "solve") {
    return "You are a patient school tutor. Solve the student's problem step by step, show the method, and explain why each step works. Keep it appropriate for the student's class.";
  }

  return "You are Ramanujan Academy Student AI. Explain concepts simply, solve school-level questions step by step, use examples, and keep answers focused. Do not overwhelm the student with unnecessary detail.";
}

async function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let key = legacy || "";
  if (secretJson) {
    try { key = JSON.parse(secretJson)?.default || key; } catch {}
  }
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readCache(admin: ReturnType<typeof createClient> | null, cacheKey: string) {
  if (!admin) return null;
  const { data } = await admin
    .from("ai_response_cache")
    .select("response_text")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data?.response_text || null;
}

async function writeCache(admin: ReturnType<typeof createClient> | null, cacheKey: string, mode: string, responseText: string) {
  if (!admin || !responseText) return;
  await admin.from("ai_response_cache").upsert({
    cache_key: cacheKey,
    mode,
    response_text: responseText,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000).toISOString(),
  });
}

async function callGateway(apiKey: string, systemPrompt: string, messages: Msg[], wantJson: boolean) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.2,
      max_tokens: wantJson ? 1400 : 900,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const detail = await response.text().catch(() => "");
    console.error("AI gateway error", status, detail.slice(0, 500));
    throw new Error(`gateway:${status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = typeof body.mode === "string" ? body.mode : "chat";
    const actorRole = body.actorRole === "teacher" ? "teacher" : "student";
    const messages = cleanMessages(body.messages);
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.slice(0, MAX_SOURCE_CHARS) : "";

    if (!messages.length && !sourceText) return json({ error: "Please provide a message." }, 400);

    const normalized = JSON.stringify({ actorRole, mode, messages, sourceText });
    const cacheKey = await sha256(normalized);
    const admin = await getAdminClient();

    const cached = await readCache(admin, cacheKey);
    if (cached) {
      return mode === "quiz" || mode === "mindmap"
        ? json({ content: cached, cached: true })
        : sse(cached);
    }

    // Cheap local responses avoid spending gateway credits on greetings/simple requests.
    const last = messages.filter((m) => m.role === "user").at(-1)?.content?.trim() || "";
    if (/^(hi|hello|hey|namaste|thanks|thank you)\b/i.test(last) || last.length < 4) {
      const local = fallback(messages, mode, sourceText, actorRole);
      return mode === "quiz" || mode === "mindmap" ? json({ content: local, fallback: true }) : sse(local);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let content = "";

    if (apiKey) {
      try {
        content = await callGateway(apiKey, buildSystemPrompt(mode, sourceText, actorRole), messages, mode === "quiz" || mode === "mindmap");
      } catch (e) {
        console.error("Primary AI failed, using fallback", e);
      }
    }

    if (!content) {
      content = fallback(messages, mode, sourceText, actorRole);
      return mode === "quiz" || mode === "mindmap"
        ? json({ content, fallback: true })
        : sse(content);
    }

    await writeCache(admin, cacheKey, mode, content);

    return mode === "quiz" || mode === "mindmap"
      ? json({ content, cached: false })
      : sse(content);
  } catch (e) {
    console.error("study-assistant error", e);
    return json({ error: "AI service temporarily unavailable." }, 503);
  }
});
