import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Volume2, VolumeX, Sparkles, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;
const AUDIO_SUMMARY_COST = 5;
const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

type KokoroInstance = {
  generate: (text: string, options: { voice: string; speed?: number }) => Promise<{ toBlob: () => Blob }>;
};

let kokoroPromise: Promise<KokoroInstance> | null = null;

async function loadKokoro(): Promise<KokoroInstance> {
  if (!kokoroPromise) {
    kokoroPromise = (async () => {
      const moduleName = "https://esm.sh/kokoro-js@1.2.1";
      const mod = await import(/* @vite-ignore */ moduleName) as { KokoroTTS: {
        from_pretrained: (
          modelId: string,
          options: { dtype: "q8"; device: "webgpu" | "wasm" }
        ) => Promise<KokoroInstance>;
      } };

      try {
        return await mod.KokoroTTS.from_pretrained(KOKORO_MODEL, {
          dtype: "q8",
          device: "webgpu",
        });
      } catch {
        return await mod.KokoroTTS.from_pretrained(KOKORO_MODEL, {
          dtype: "q8",
          device: "wasm",
        });
      }
    })().catch((error) => {
      kokoroPromise = null;
      throw error;
    });
  }

  return kokoroPromise;
}

async function getSessionHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

async function createAudioSummary(sourceText: string, studentId: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: await getSessionHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        actorRole: "student",
        mode: "audio_summary",
        sourceText: sourceText.slice(0, 6000),
        studentId,
        messages: [{
          role: "user",
          content: "Create a concise audio-friendly study summary. Plain text only, no markdown or special formatting. Make it engaging, clear and educational for a school student. Keep it under about 700 words.",
        }],
      }),
    });

    if (!response.ok) {
      let detail = "Failed to create the summary.";
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.error === "string") detail = errorBody.error;
      } catch {}
      throw new Error(detail);
    }

    const contentType = response.headers.get("content-type") || "";

    // Be tolerant of either the streaming SSE response or a normal JSON response.
    // This prevents a protocol mismatch from turning a valid summary into an empty one.
    if (contentType.includes("application/json")) {
      const data = await response.json();
      const summary = typeof data?.content === "string" ? data.content : "";
      if (!summary.trim()) throw new Error("The AI returned an empty summary.");
      return summary.trim();
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No summary response received.");

    const decoder = new TextDecoder("utf-8", { fatal: false });
    let buffer = "";
    let summary = "";

    const consumeLine = (line: string) => {
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) return;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === "string") summary += delta;
      } catch {
        // Ignore incomplete/non-SSE lines.
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = -1;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) consumeLine(buffer.trim());

    if (!summary.trim()) throw new Error("The AI returned an empty summary.");
    return summary.trim();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Audio summary timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function spendPoints(studentId: string) {
  const { data, error } = await supabase.rpc("consume_student_ra_points", {
    p_student_id: studentId,
    p_points: AUDIO_SUMMARY_COST,
    p_reason: "audio_summary",
    p_metadata: { voice: "af_heart", tts: "kokoro" },
  });
  const row = Array.isArray(data) ? data[0] : data;
  return !error && !!row?.ok;
}

async function refundPoints(studentId: string) {
  await supabase.rpc("refund_student_ra_points", {
    p_student_id: studentId,
    p_points: AUDIO_SUMMARY_COST,
    p_reason: "audio_summary_refund",
    p_metadata: { voice: "af_heart", tts: "kokoro" },
  });
}

const AudioSummary = ({ sourceText = "", studentId }: { sourceText?: string; studentId: string }) => {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [material, setMaterial] = useState(sourceText);
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [engine, setEngine] = useState<"kokoro" | "browser" | null>(null);

  const stopAudio = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const generate = async () => {
    const inputMaterial = material.trim();
    if (!inputMaterial || isGenerating) return;

    const charged = await spendPoints(studentId);
    if (!charged) {
      toast({
        title: "Not enough RA Points",
        description: "An Audio Summary costs 5 RA Points.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setSummary("");
    setEngine(null);
    stopAudio();

    try {
      const text = await createAudioSummary(inputMaterial, studentId);
      setSummary(text);

      let engineUsed: "kokoro" | "browser" = "browser";
      try {
        const kokoro = await Promise.race([
          loadKokoro(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("Kokoro loading timed out")), 12000)
          ),
        ]);
        const audio = await kokoro.generate(text, {
          voice: "af_heart",
          speed: 0.95,
        });
        const blob = audio.toBlob();
        const url = URL.createObjectURL(blob);

        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;

        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = url;
        audioRef.current.onplay = () => setIsSpeaking(true);
        audioRef.current.onended = () => setIsSpeaking(false);
        engineUsed = "kokoro";
        setEngine("kokoro");
      } catch (kokoroError) {
        console.warn("Kokoro TTS unavailable; using browser speech fallback.", kokoroError);
        setEngine("browser");
        toast({
          title: "Kokoro unavailable on this device",
          description: "Using the browser voice as a fallback.",
        });
      }

      toast({
        title: "Audio Summary ready",
        description: `5 RA Points used · ${engineUsed === "kokoro" ? "Kokoro" : "browser voice fallback"}`,
      });
    } catch (error) {
      await refundPoints(studentId);
      setSummary("");
      setEngine(null);
      toast({
        title: "Audio Summary failed",
        description: error instanceof Error ? error.message : "Your 5 RA Points were refunded.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const play = async () => {
    if (!summary) return;

    if (engine === "kokoro" && audioRef.current) {
      await audioRef.current.play();
      return;
    }

    stopAudio();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    speechRef.current = utterance;
    if (!("speechSynthesis" in window)) {
      toast({ title: "Audio playback unavailable", description: "This browser does not support speech playback.", variant: "destructive" });
      return;
    }
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => () => {
    stopAudio();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Audio Summary
            <Badge variant="secondary" className="ml-auto">5 RA Points</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Turn your study material into a short listenable revision summary.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Study material</p>
            <Textarea
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Paste your chapter notes, textbook text, or study material here..."
              className="min-h-[140px] rounded-xl text-sm leading-6"
            />
          </div>

          <Button
            onClick={generate}
            disabled={isGenerating || !material.trim()}
            className="w-full rounded-xl"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Audio Summary...</>
            ) : (
              <><Volume2 className="w-4 h-4 mr-2" /> Generate Audio Summary · 5 RA</>
            )}
          </Button>

          {summary && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="rounded-xl border bg-muted/20 p-3 max-h-[220px] overflow-y-auto">
                <p className="text-sm leading-6">{summary}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={play} className="flex-1 rounded-xl">
                  {isSpeaking ? <><VolumeX className="w-4 h-4 mr-2" /> Playing</> : <><Play className="w-4 h-4 mr-2" /> Listen</>}
                </Button>
                <Button variant="outline" onClick={generate} disabled={isGenerating} className="rounded-xl">
                  <RotateCcw className="w-4 h-4 mr-2" /> Regenerate
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Voice engine: {engine === "kokoro" ? "Kokoro TTS · American Heart" : "Browser voice fallback"}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioSummary;