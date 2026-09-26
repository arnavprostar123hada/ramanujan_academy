import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    try {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "No file supplied." }, 400);

      const name = file.name.toLowerCase();
      if (file.size > 10 * 1024 * 1024) return json({ error: "File is too large. Maximum 10 MB." }, 413);

      if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
        const text = (await file.text()).slice(0, 20000);
        return json({ text });
      }

      if (name.endsWith(".pdf") || file.type === "application/pdf") {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(buffer);
        if (pdf.numPages > 40) return json({ error: "PDF is too long. Maximum 40 pages." }, 413);
        const result = await extractText(pdf, { mergePages: true });
        return json({ text: String(result.text || "").slice(0, 20000), totalPages: result.totalPages });
      }

      return json({ error: "This upload type is not supported yet. Use PDF, TXT, MD or CSV." }, 415);
    } catch (e) {
      console.error("extract-text error", e);
      return json({ error: "Could not extract text from this file." }, 500);
    }
  },
};
