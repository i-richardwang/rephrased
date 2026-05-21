import { useState } from "react";
import type { Card as CardType } from "@/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TranscriptModal from "@/components/TranscriptModal";
import {
  RefreshCw,
  Crosshair,
  LayoutList,
  Tag,
  FileText,
  Star,
  EyeOff,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TYPE_STYLES: Record<string, string> = {
  "Paraphrase": "card-paraphrase",
  "Precise Wording": "card-wording",
  "Structured Expression": "card-structure",
  "Concept Naming": "card-naming",
};

const TYPE_ICON: Record<string, LucideIcon> = {
  "Paraphrase": RefreshCw,
  "Precise Wording": Crosshair,
  "Structured Expression": LayoutList,
  "Concept Naming": Tag,
};

const TYPE_ACCENT: Record<string, string> = {
  "Paraphrase": "border-coral",
  "Precise Wording": "border-teal",
  "Structured Expression": "border-yellow",
  "Concept Naming": "border-purple",
};

interface CardProps {
  card: CardType;
  onFavorite?: (id: number, value: boolean) => void;
  onHide?: (id: number, value: boolean) => void;
  compact?: boolean;
}

export default function Card({ card, onFavorite, onHide, compact }: CardProps) {
  const [showSource, setShowSource] = useState(false);
  const style = TYPE_STYLES[card.type] || "";
  const accent = TYPE_ACCENT[card.type] || "border-ink/20";
  const hasSource = card.userLine != null || card.aiLine != null;
  const showActions = Boolean(onFavorite || onHide || hasSource);
  const Icon = TYPE_ICON[card.type] || FileText;

  return (
    <>
    <article
      className={`content-card ${style} ${compact ? "p-4" : "p-5"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider gap-1.5">
          <Icon size={12} /> {card.type}
        </Badge>
        <div className="flex items-center gap-2">
          {card.favorite && (
            <Star size={12} className="text-coral fill-coral" />
          )}
          {card.contextHint && (
            <span className="text-xs text-muted-foreground font-mono">
              {card.contextHint}
            </span>
          )}
        </div>
      </div>

      {/* User said */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
          You said
        </div>
        <p className="text-[15px] leading-relaxed text-foreground/60">
          "{card.userSaid}"
        </p>
      </div>

      {/* AI phrased */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
          Better put
        </div>
        <p className={`text-[17px] leading-relaxed font-semibold text-foreground pl-3 border-l-3 max-w-prose ${accent}`}>
          "{card.aiPhrased}"
        </p>
      </div>

      {/* Takeaway */}
      {(card.vocab.length > 0 || card.pattern) && (
        <div className="mb-3 space-y-1.5">
          {card.vocab.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.vocab.map((v) => (
                <Badge key={v} variant="secondary" className="bg-yellow text-foreground font-bold">
                  {v}
                </Badge>
              ))}
            </div>
          )}
          {card.pattern && (
            <div className="bg-lime text-foreground font-mono text-xs px-2.5 py-1 brutal-border break-words">
              {card.pattern}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 mt-4 pt-3 border-t-2 border-foreground/15 items-center">
          {onFavorite && (
            <Button
              size="sm"
              variant={card.favorite ? "default" : "outline"}
              className={card.favorite ? "bg-coral text-white" : ""}
              onClick={() => onFavorite(card.id, !card.favorite)}
            >
              <Star size={14} className={card.favorite ? "fill-current" : ""} />
              {card.favorite ? "Favorited" : "Favorite"}
            </Button>
          )}
          {onHide && (
            <Button
              size="sm"
              variant={card.hidden ? "default" : "outline"}
              className={card.hidden ? "bg-foreground text-background" : ""}
              onClick={() => onHide(card.id, !card.hidden)}
            >
              <EyeOff size={14} />
              {card.hidden ? "Hidden" : "Hide"}
            </Button>
          )}
          {hasSource && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSource(true)}
            >
              <MessageSquare size={14} />
              Source
            </Button>
          )}
          {card.viewCount > 0 && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              viewed {card.viewCount}×
            </span>
          )}
        </div>
      )}
    </article>
    {showSource && (
      <TranscriptModal
        sessionId={card.sessionId}
        userLine={card.userLine}
        aiLine={card.aiLine}
        onClose={() => setShowSource(false)}
      />
    )}
    </>
  );
}
