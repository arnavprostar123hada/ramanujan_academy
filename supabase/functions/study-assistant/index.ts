import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, sourceText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let useStream = true;

    if (mode === "mindmap") {
      systemPrompt = `You are a mind map generator for students. Given the source text or topic, create a structured mind map in this exact JSON format:
{
  "title": "Main Topic",
  "children": [
    {
      "title": "📚 Subtopic 1",
      "children": [
        { "title": "📝 Detail A", "children": [] },
        { "title": "🔍 Detail B", "children": [] }
      ]
    }
  ]
}
Return ONLY the JSON, no other text. Use relevant emojis at the start of each title. Make the mind map comprehensive with 3-6 main branches and 2-4 sub-branches each. Keep titles concise (max 8 words).`;
    } else if (mode === "quiz") {
      useStream = false;
      systemPrompt = `You are a quiz generator for students. Generate a practice quiz based on the topic provided. Return ONLY valid JSON in this exact format:
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}
Generate exactly 5 questions. Make them educational and appropriate for the student's level. Use a mix of easy, medium, and hard questions.`;
    } else if (mode === "notebook") {
      systemPrompt = `You are an advanced AI study assistant similar to Google NotebookLM. The student has uploaded source material. Your job is to:
- Answer questions ONLY based on the provided source material
- Cite specific parts of the source when answering
- Generate summaries, key takeaways, and study guides from the source
- If asked something not in the source, clearly say so

Here is the source material the student uploaded:
---
${sourceText || "No source material provided yet."}
---

Be thorough, use markdown formatting with headers, bullet points, and emphasis. Use emojis to make responses engaging. Always reference the source material in your answers.`;
    } else if (mode === "solve") {
      systemPrompt = `You are a brilliant tutor solving problems for students. The student has written a question or problem in their notes. Solve it step by step with clear explanations. Use markdown formatting, emojis, and make it easy to understand. Show your work clearly.`;
    } else {
      systemPrompt = `You are an intelligent, friendly AI study assistant for students at Ramanujan Academy. Help students with:
- Answering questions about any subject with emojis and engaging formatting
- Explaining concepts clearly with examples and analogies
- Solving problems step by step
- Providing study tips and strategies
- Creating summaries of topics

Be encouraging, clear, and thorough. Use markdown formatting with emojis 🎓📚✨ for better readability. Use bullet points, numbered lists, and headers when appropriate.`;
    }

    const model = "google/gemini-3-flash-preview";

    if (!useStream) {
      // Non-streaming for quiz
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Service credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Service credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("study-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
