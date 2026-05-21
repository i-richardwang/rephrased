import { useEffect, useRef, useState } from "react";
import { api, type TranscriptDetail } from "@/api";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TranscriptModalProps {
  sessionId: string;
  userLine: number | null;
  aiLine: number | null;
  onClose: () => void;
}

interface Section {
  role: string;
  line: number;
  text: string;
}

// Transcript markdown is a sequence of `### <role> (L<n>)` blocks.
function parseTranscript(content: string): Section[] {
  const sections: Section[] = [];
  for (const part of content.split(/^### /m)) {
    const m = part.match(/^(.+?)\s*\(L(\d+)\)\s*\n([\s\S]*)$/);
    if (!m) continue;
    sections.push({ role: m[1].trim(), line: Number(m[2]), text: m[3].trim() });
  }
  return sections;
}

export default function TranscriptModal({
  sessionId,
  userLine,
  aiLine,
  onClose,
}: TranscriptModalProps) {
  const [transcript, setTranscript] = useState<TranscriptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .transcript(sessionId)
      .then(setTranscript)
      .catch((e) => setError(String(e)));
  }, [sessionId]);

  useEffect(() => {
    if (transcript && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: "center" });
    }
  }, [transcript]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sections = transcript ? parseTranscript(transcript.content) : [];
  const highlighted = new Set(
    [userLine, aiLine].filter((n): n is number => n != null),
  );
  let firstHighlightAssigned = false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background brutal-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-foreground/15">
          <h3 className="font-mono text-sm font-bold">Original conversation</h3>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {error && (
            <p className="text-sm text-coral font-mono">
              Failed to load transcript: {error}
            </p>
          )}
          {!transcript && !error && (
            <p className="text-sm text-muted-foreground font-mono">loading...</p>
          )}
          {sections.map((s) => {
            const isHighlighted = highlighted.has(s.line);
            const takeRef = isHighlighted && !firstHighlightAssigned;
            if (takeRef) firstHighlightAssigned = true;
            return (
              <div
                key={s.line}
                ref={takeRef ? highlightRef : undefined}
                className={`mb-4 ${
                  isHighlighted ? "bg-yellow/40 -mx-2 px-2 py-1.5" : ""
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {s.role} · L{s.line}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                  {s.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
