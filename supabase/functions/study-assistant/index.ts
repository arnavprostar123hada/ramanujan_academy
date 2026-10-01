import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Msg = { role: "user" | "assistant"; content: string };

type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number;
  cached?: boolean;
};

function calculateCredits(inputTokens: number, outputTokens: number, reportedTotalTokens = 0) {
  // Strict billing: use the provider's reported total when available.
  // 1 RA Credit = 1,000 total AI tokens, rounded UP to 0.01 credit.
  const totalTokens = reportedTotalTokens > 0 ? reportedTotalTokens : inputTokens + outputTokens;
  return Math.max(0.01, Math.ceil((totalTokens / 1000) * 100) / 100);
}

const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 8000;
const MAX_SOURCE_CHARS = 40000;
const MAX_TOTAL_INPUT_CHARS = 50000;
const CACHE_HOURS = 24;
const TEACHER_MONTHLY_CREDITS = 50;

function repairMojibake(value: string) {
  // Repair UTF-8 text that was accidentally decoded as Windows-1252/Latin-1.
  // This covers common corruption such as Marathi/Hindi "à¤...", accents "Ã...",
  // smart punctuation "â€™", and emoji "ðŸ...".
  if (!/[ÃÂâðà]/.test(value)) return value;

  const cp1252: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88,
    0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c,
    0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b,
    0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f,
  };

  const bytes: number[] = [];
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code <= 0xff) bytes.push(code);
    else if (cp1252[code] !== undefined) bytes.push(cp1252[code]);
    else return value;
  }

  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    return repaired.includes("\uFFFD") ? value : repaired;
  } catch {
    return value;
  }
}

function sanitizeText(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "");

  return repairMojibake(normalized)
    .replace(/\uFFFD/g, "");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sse(text: string, usage?: AIUsage) {
  const chunks = text.match(/.{1,80}/gs) || [text];
  const body = chunks.map((c, i) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }], ...(i === chunks.length - 1 && usage ? { usage } : {}) })}\n\n`).join("") + "data: [DONE]\n\n";
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
  const cleaned = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: sanitizeText(m.content.slice(0, MAX_MESSAGE_CHARS)) }));
  let total = 0;
  return cleaned.reverse().filter((m) => {
    if (total >= MAX_TOTAL_INPUT_CHARS) return false;
    const remaining = MAX_TOTAL_INPUT_CHARS - total;
    if (m.content.length > remaining) m.content = m.content.slice(0, remaining);
    total += m.content.length;
    return true;
  }).reverse();
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

  if (mode === "audio_summary") {
    return `Create a concise, audio-friendly study summary using ONLY the supplied source material.
Return plain text only. No markdown, bullets, headings, tables, or special formatting.
Make it engaging, clear and educational for a school student.
Keep it below 700 words. Preserve important definitions, formulas, examples and key facts from the source.
SOURCE:
---
${sourceText || "No source material supplied."}
---`;
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

async function getAuthenticatedUserId(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user?.id || null;
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

async function getTeacherCredits(admin: ReturnType<typeof createClient> | null, teacherId: string) {
  if (!admin || !teacherId) return null;
  const now = new Date();
  const { data } = await admin.from("teacher_ai_credits")
    .select("teacher_id, credits, monthly_allowance, last_reset")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (!data) {
    const { data: created } = await admin.from("teacher_ai_credits")
      .insert({ teacher_id: teacherId, credits: TEACHER_MONTHLY_CREDITS, monthly_allowance: TEACHER_MONTHLY_CREDITS, last_reset: now.toISOString(), updated_at: now.toISOString() })
      .select("teacher_id, credits, monthly_allowance, last_reset")
      .single();
    return created || null;
  }

  const lastReset = new Date(data.last_reset);
  const monthChanged = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
  if (!monthChanged) return data;

  const { data: reset } = await admin.from("teacher_ai_credits")
    .update({ credits: data.monthly_allowance || TEACHER_MONTHLY_CREDITS, last_reset: now.toISOString(), updated_at: now.toISOString() })
    .eq("teacher_id", teacherId)
    .select("teacher_id, credits, monthly_allowance, last_reset")
    .single();
  return reset || data;
}

async function spendTeacherCredits(admin: ReturnType<typeof createClient> | null, teacherId: string, amount: number) {
  if (!admin || amount <= 0) return true;
  const current = await getTeacherCredits(admin, teacherId);
  if (!current || Number(current.credits) < amount) return false;
  const { data } = await admin.from("teacher_ai_credits")
    .update({ credits: Number(current.credits) - amount, updated_at: new Date().toISOString() })
    .eq("teacher_id", teacherId)
    .gte("credits", amount)
    .select("credits")
    .single();
  return !!data;
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

async function callProvider(baseUrl: string, apiKey: string, model: string, systemPrompt: string, messages: Msg[], wantJson: boolean) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.2,
      max_tokens: wantJson ? 1400 : 1800,
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`provider:${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || "";
  const usage = data.usage || {};
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? (inputTokens + outputTokens));

  return {
    content,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
      credits: calculateCredits(inputTokens, outputTokens, totalTokens),
    } satisfies AIUsage,
  };
}

async function callAI(systemPrompt: string, messages: Msg[], wantJson: boolean, mode = "") {
  const providers = [
    { name: "gemini", key: Deno.env.get("GEMINI_API_KEY"), url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash" },
    { name: "openrouter", key: Deno.env.get("OPENROUTER_API_KEY"), url: "https://openrouter.ai/api/v1/chat/completions", model: Deno.env.get("OPENROUTER_MODEL") || "google/gemini-3.8-flash" },
    { name: "groq", key: Deno.env.get("GROQ_API_KEY"), url: "https://api.groq.com/openai/v1/chat/completions", model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b" },
    { name: "nvidia", key: Deno.env.get("NVIDIA_API_KEY"), url: "https://integrate.api.nvidia.com/v1/chat/completions", model: Deno.env.get("NVIDIA_MODEL") || "qwen/qwen3-next-80b-a3b-instruct" },
    { name: "mistral", key: Deno.env.get("MISTRAL_API_KEY"), url: "https://api.mistral.ai/v1/chat/completions", model: Deno.env.get("MISTRAL_MODEL") || "mistral-small-latest" },
    { name: "huggingface", key: Deno.env.get("HF_TOKEN"), url: "https://router.huggingface.co/v1/chat/completions", model: Deno.env.get("HF_MODEL") || "Qwen/Qwen3.8-Flash-Next:cheapest" },
  ];

  for (const provider of providers) {
    if (mode === "mindmap" && provider.name !== "gemini") continue;
    if (!provider.key) continue;
    try {
      const result = await callProvider(provider.url, provider.key, provider.model, systemPrompt, messages, wantJson);
      if (result.content) {
        console.log("AI provider used:", provider.name, provider.model, result.usage);
        return { ...result, provider: provider.name };
      }
    } catch (error) {
      console.error("AI provider failed", provider.name, provider.model, error);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = typeof body.mode === "string" ? body.mode : "chat";
    const actorRole = body.actorRole === "teacher" ? "teacher" : "student";
    const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const messages = cleanMessages(body.messages);
    const rawSource = typeof body.sourceText === "string" ? body.sourceText : "";
    const sourceText = sanitizeText(rawSource.slice(0, MAX_SOURCE_CHARS));

    if (!messages.length && !sourceText) return json({ error: "Please provide a message." }, 400);
    if (actorRole === "teacher" && !teacherId) return json({ error: "Teacher identity is required." }, 400);

    const admin = await getAdminClient();
    const authenticatedUserId = await getAuthenticatedUserId(req);

    const teacherCredits = actorRole === "teacher" ? await getTeacherCredits(admin, teacherId) : null;
    if (actorRole === "teacher" && mode === "teacher_balance") {
      return json({ credits: Number(teacherCredits?.credits || 0), monthlyAllowance: Number(teacherCredits?.monthly_allowance || TEACHER_MONTHLY_CREDITS) });
    }
    if (actorRole === "teacher" && !teacherCredits) return json({ error: "Teacher credit account is unavailable." }, 503);
    if (actorRole === "teacher" && Number(teacherCredits?.credits || 0) < 0.01) {
      return json({ error: "Teacher AI credits exhausted for this month.", credits: 0 }, 402);
    }

    let resolvedStudentId = "";
    if (actorRole === "student") {
      if (!authenticatedUserId || !studentId || !admin) {
        return json({ error: "Student identity is required." }, 401);
      }
      const { data: onlineStudent } = await admin
        .from("online_students")
        .select("student_id")
        .eq("user_id", authenticatedUserId)
        .eq("student_id", studentId)
        .maybeSingle();
      resolvedStudentId = onlineStudent?.student_id || "";
      if (!resolvedStudentId) return json({ error: "Student identity is not authorized." }, 403);
    }

    const normalized = JSON.stringify({
      actorRole,
      teacherId: actorRole === "teacher" ? teacherId : "",
      studentId: actorRole === "student" ? resolvedStudentId : "",
      mode,
      messages,
      sourceText,
    });
    const cacheKey = await sha256(normalized);

    const cached = await readCache(admin, cacheKey);
    if (cached) {
      const cachedUsage: AIUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, credits: 0, cached: true };
      return mode === "quiz" || mode === "mindmap"
        ? json({ content: cached, cached: true, usage: cachedUsage })
        : sse(cached);
    }

    // Cheap local responses avoid spending gateway credits on greetings/simple requests.
    const last = messages.filter((m) => m.role === "user").at(-1)?.content?.trim() || "";
    if (/^(hi|hello|hey|namaste|thanks|thank you)\b/i.test(last) || last.length < 4) {
      const local = fallback(messages, mode, sourceText, actorRole);
      return mode === "quiz" || mode === "mindmap" ? json({ content: local, fallback: true }) : sse(local);
    }

    let result: { content: string; usage: AIUsage; provider?: string } | null = null;
    try {
      result = await callAI(
        buildSystemPrompt(mode, sourceText, actorRole),
        messages,
        mode === "quiz" || mode === "mindmap",
        mode,
      );
    } catch (e) {
      console.error("All AI providers failed, using fallback", e);
    }

    if (!result?.content) {
      const content = fallback(messages, mode, sourceText, actorRole);
      const fallbackUsage: AIUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, credits: 0, cached: true };
      return mode === "quiz" || mode === "mindmap"
        ? json({ content, fallback: true, usage: fallbackUsage })
        : sse(content, fallbackUsage);
    }

    const cleanResult = sanitizeText(result.content);

    if (actorRole === "student" && mode !== "audio_summary" && result.usage.credits > 0) {
      const { data: chargeRows, error: chargeError } = await admin.rpc("consume_student_ra_points_admin", {
        p_student_id: resolvedStudentId,
        p_points: result.usage.credits,
        p_reason: "ai_response",
        p_metadata: {
          mode,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          total_tokens: result.usage.totalTokens,
          provider: result.provider || null,
        },
      });
      const charge = Array.isArray(chargeRows) ? chargeRows[0] : chargeRows;
      if (chargeError || !charge?.ok) {
        return json({
          error: "Not enough RA Points for this response.",
          required: result.usage.credits,
          balance: Number(charge?.balance || 0),
        }, 402);
      }
      result.usage.credits = Number(charge.charged || result.usage.credits);
      (result.usage as AIUsage & { studentPointsRemaining?: number }).studentPointsRemaining = Number(charge.balance || 0);
    }

    if (actorRole === "teacher" && result.usage.credits > 0) {
      const spent = await spendTeacherCredits(admin, teacherId, result.usage.credits);
      if (!spent) {
        return json({ error: "Not enough Teacher AI credits for this response. Please try a shorter request or wait for next month's allowance." }, 402);
      }
    }

    await writeCache(admin, cacheKey, mode, cleanResult);

    const responseUsage = actorRole === "teacher"
      ? { ...result.usage, credits: result.usage.credits, teacherCreditsRemaining: Math.max(0, Number(teacherCredits?.credits || 0) - result.usage.credits) }
      : result.usage;

    return mode === "quiz" || mode === "mindmap"
      ? json({ content: cleanResult, cached: false, usage: responseUsage })
      : sse(cleanResult, responseUsage);
  } catch (e) {
    console.error("study-assistant error", e);
    return json({ error: "AI service temporarily unavailable." }, 503);
  }
});
