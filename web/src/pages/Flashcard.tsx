import { useCallback, useEffect, useState } from "react";
import { api, type Card } from "../api";

const TYPE_BG: Record<string, string> = {
  "复述澄清": "bg-[#FEE2E2]",
  "精准用词": "bg-[#CCFBF1]",
  "结构化表达": "bg-[#FEF3C7]",
  "概念命名": "bg-[#EDE9FE]",
};

export default function Flashcard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.cards({ status: "new" }).then((c) => {
      if (c.length === 0) {
        api.cards().then((all) => {
          setCards(all);
          setLoading(false);
        });
      } else {
        setCards(c);
        setLoading(false);
      }
    });
  }, []);

  const current = cards[index];
  const total = cards.length;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  const next = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, cards.length - 1));
  }, [cards.length]);

  const handleReview = async (status: string) => {
    if (!current) return;
    await api.review(current.id, status);
    setCards((prev) =>
      prev.map((c) =>
        c.id === current.id ? { ...c, reviewStatus: status } : c,
      ),
    );
    next();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        else next();
      }
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")
        setIndex((i) => {
          setFlipped(false);
          return Math.max(i - 1, 0);
        });
      if (flipped && e.key === "1") handleReview("learned");
      if (flipped && e.key === "2") handleReview("learning");
      if (flipped && e.key === "3") handleReview("skipped");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, current, next]);

  if (loading) {
    return (
      <div className="text-center py-20 text-ink/40 font-bold text-xl">
        Loading...
      </div>
    );
  }

  if (!current) {
    return (
      <div className="brutal-border brutal-shadow bg-white p-12 text-center max-w-lg mx-auto">
        <p className="text-2xl font-bold mb-2">全部看完了!</p>
        <p className="text-ink/60">没有更多卡片了</p>
      </div>
    );
  }

  const bg = TYPE_BG[current.type] || "bg-white";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-bold mb-1 font-[family-name:var(--font-mono)]">
          <span>
            {index + 1} / {total}
          </span>
          <span>{current.type}</span>
        </div>
        <div className="brutal-border bg-white h-4 overflow-hidden">
          <div
            className="h-full bg-ink transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        className={`brutal-border brutal-shadow-lg ${bg} p-8 min-h-[320px] flex flex-col justify-center cursor-pointer select-none`}
      >
        {/* Context hint */}
        <div className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-4 text-center">
          {current.contextHint}
        </div>

        {/* Front: userSaid */}
        <div className="text-center mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-2">
            你说
          </p>
          <p className="text-xl font-[family-name:var(--font-mono)] leading-relaxed">
            "{current.userSaid}"
          </p>
        </div>

        {/* Back: aiPhrased (revealed) */}
        {flipped ? (
          <div className="text-center animate-[fadeUp_200ms_ease-out]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40 mb-2">
              可以说
            </p>
            <p className="text-xl font-bold leading-relaxed brutal-border bg-ink text-cream p-4 inline-block">
              "{current.aiPhrased}"
            </p>

            {(current.vocab.length > 0 || current.pattern) && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                {current.vocab.map((v) => (
                  <span
                    key={v}
                    className="brutal-border brutal-shadow-sm bg-yellow px-2 py-0.5 text-xs font-bold"
                  >
                    {v}
                  </span>
                ))}
                {current.pattern && (
                  <span className="brutal-border brutal-shadow-sm bg-lime px-2 py-0.5 text-xs font-[family-name:var(--font-mono)]">
                    {current.pattern}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-ink/30 text-sm mt-4">
            点击翻转 · space / enter
          </p>
        )}
      </div>

      {/* Actions */}
      {flipped && (
        <div className="flex gap-3 mt-5 justify-center animate-[fadeUp_150ms_ease-out]">
          <button
            onClick={() => handleReview("learned")}
            className="brutal-btn bg-teal text-white text-sm flex-1 max-w-[140px]"
          >
            ✓ 掌握 <kbd className="ml-1 text-[10px] opacity-70">1</kbd>
          </button>
          <button
            onClick={() => handleReview("learning")}
            className="brutal-btn bg-yellow text-ink text-sm flex-1 max-w-[140px]"
          >
            ↻ 再看 <kbd className="ml-1 text-[10px] opacity-70">2</kbd>
          </button>
          <button
            onClick={() => handleReview("skipped")}
            className="brutal-btn bg-white text-ink/50 text-sm flex-1 max-w-[140px]"
          >
            ✕ 跳过 <kbd className="ml-1 text-[10px] opacity-70">3</kbd>
          </button>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-center mt-6 text-[10px] text-ink/30 font-[family-name:var(--font-mono)]">
        ← prev · space flip · → next · 1/2/3 review
      </div>
    </div>
  );
}
