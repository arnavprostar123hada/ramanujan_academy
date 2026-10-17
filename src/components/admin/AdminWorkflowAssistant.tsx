import { useRef, useState } from "react";
import { Bot, ImagePlus, Loader2, Send, X, ShieldCheck, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function AdminWorkflowAssistant() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [cached, setCached] = useState(false);
  const [provider, setProvider] = useState("");

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Unsupported image", description: "Please choose a PNG, JPG or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: "Image is too large", description: "Maximum image size is 4 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setImageDataUrl(reader.result);
      setImageName(file.name);
      setReply("");
    };
    reader.onerror = () => toast({ title: "Could not read image", description: "Try selecting the image again.", variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const runAssistant = async () => {
    if (!prompt.trim() && !imageDataUrl) {
      toast({ title: "Add a prompt or image", description: "Tell the AI what you want done, or upload an image to review.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setReply("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-workflow-ai", {
        body: { prompt: prompt.trim(), imageDataUrl: imageDataUrl || undefined },
      });
      if (error) throw error;
      if (!data?.reply) throw new Error(data?.error || "The assistant returned no result.");
      setReply(String(data.reply));
      setCached(Boolean(data.cached));
      setProvider(String(data.provider || ""));
      toast({ title: data.cached ? "Loaded saved AI response" : "Workflow analysis ready" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reach the workflow assistant.";
      toast({ title: "AI request failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> AI Workflow Copilot</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Describe the work or upload a screenshot, fee note, document photo or other image. Get a clear action plan without searching through every module.</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Owner/admin access</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Review this fee note, identify the standard fee and proposed concession, and tell me what needs approval before it is entered."
          rows={4}
          maxLength={7000}
          aria-label="Describe the workflow for the AI assistant"
        />
        {imageDataUrl && (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <img src={imageDataUrl} alt="Selected upload preview" className="h-20 w-20 rounded-md border object-contain bg-muted" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{imageName}</p><p className="text-xs text-muted-foreground">Image attached</p></div>
            <Button type="button" size="icon" variant="ghost" aria-label="Remove attached image" onClick={() => { setImageDataUrl(""); setImageName(""); if (inputRef.current) inputRef.current.value = ""; }}><X className="h-4 w-4" /></Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => chooseImage(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" /> Add image</Button>
          <Button type="button" onClick={() => void runAssistant()} disabled={busy || (!prompt.trim() && !imageDataUrl)}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analysing…</> : <><Sparkles className="mr-2 h-4 w-4" /><Send className="mr-2 h-4 w-4" />Create action plan</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">For safety, this first version analyses and prepares the workflow; it does not silently change fees, post payments, issue refunds or send messages. Financial or sensitive actions must be reviewed and confirmed before execution.</p>
        {reply && (
          <section className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">AI result</h3>
              <span className="text-xs text-muted-foreground">{cached ? "Cached response" : (provider ? "Provider: " + provider : "Generated response")}</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              <ReactMarkdown>{reply}</ReactMarkdown>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
