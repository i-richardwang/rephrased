import { useEffect, useState } from "react";
import { api, type Card as CardType, type Stats } from "@/api";
import Card from "@/components/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, EyeOff } from "lucide-react";

type View = "all" | "favorites" | "hidden" | "stale";

const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "hidden", label: "Hidden" },
  { key: "stale", label: "Stale" },
];

export default function CardBrowser() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [view, setView] = useState<View>("all");
  const [filter, setFilter] = useState({ type: "", q: "" });
  const [loading, setLoading] = useState(true);

  const fetchCards = async () => {
    setLoading(true);
    const params: Record<string, string> = { view };
    if (filter.type) params.type = filter.type;
    if (filter.q) params.q = filter.q;
    const [c, s] = await Promise.all([api.cards(params), api.stats()]);
    setCards(c);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    api.types().then(setTypes);
  }, []);

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.type, view]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCards();
  };

  const handleFavorite = async (id: number, value: boolean) => {
    await api.favorite(id, value);
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, favorite: value } : c)),
    );
  };

  const handleHide = async (id: number, value: boolean) => {
    await api.hide(id, value);
    if (view === "all" && value) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    } else if (view === "hidden" && !value) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    } else {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, hidden: value } : c)),
      );
    }
  };

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="mb-6">
          {/* Mobile: compact summary */}
          <div className="flex sm:hidden gap-2 flex-wrap">
            <div className="brutal-border brutal-shadow-sm bg-white px-3 py-1.5 flex items-baseline gap-1 text-sm">
              <span className="text-xl font-bold">{stats.totalCards}</span>
              <span className="text-xs text-muted-foreground">cards</span>
            </div>
            <div className="brutal-border brutal-shadow-sm bg-white px-3 py-1.5 flex items-baseline gap-1 text-sm">
              <span className="text-xl font-bold">{stats.totalSessions}</span>
              <span className="text-xs text-muted-foreground">sessions</span>
            </div>
            <div className="brutal-border brutal-shadow-sm bg-white px-3 py-1.5 flex items-baseline gap-1 text-sm">
              <span className="font-bold">{stats.favoriteCount}</span>
              <Star size={12} className="text-muted-foreground" />
            </div>
            <div className="brutal-border brutal-shadow-sm bg-white px-3 py-1.5 flex items-baseline gap-1 text-sm">
              <span className="font-bold">{stats.hiddenCount}</span>
              <EyeOff size={12} className="text-muted-foreground" />
            </div>
          </div>
          {/* Desktop: full stats */}
          <div className="hidden sm:flex flex-wrap gap-3">
            <div className="brutal-border brutal-shadow-sm bg-white px-4 py-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{stats.totalCards}</span>
              <span className="text-xs text-muted-foreground">cards</span>
            </div>
            <div className="brutal-border brutal-shadow-sm bg-white px-4 py-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{stats.totalSessions}</span>
              <span className="text-xs text-muted-foreground">sessions</span>
            </div>
            <div className="brutal-border brutal-shadow-sm bg-white px-3 py-2 flex items-baseline gap-1 text-sm">
              <span className="font-bold">{stats.favoriteCount}</span>
              <span className="text-muted-foreground flex items-center gap-1"><Star size={12} /> favorites</span>
            </div>
            <div className="brutal-border brutal-shadow-sm bg-white px-3 py-2 flex items-baseline gap-1 text-sm">
              <span className="font-bold">{stats.hiddenCount}</span>
              <span className="text-muted-foreground flex items-center gap-1"><EyeOff size={12} /> hidden</span>
            </div>
            {Object.entries(stats.byType).map(([t, n]) => (
              <div
                key={t}
                className="brutal-border brutal-shadow-sm bg-white px-3 py-2 flex items-baseline gap-1 text-sm"
              >
                <span className="font-bold">{n}</span>
                <span className="text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View tabs + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {VIEWS.map((v) => (
              <Button
                key={v.key}
                size="sm"
                variant={view === v.key ? "default" : "outline"}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </Button>
            ))}
          </div>

          <Select
            value={filter.type || undefined}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, type: v === "__all__" ? "" : (v ?? "") }))
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden sm:block flex-1" />

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            type="text"
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search vocab or phrases..."
            className="w-full sm:w-[220px]"
          />
          <Button type="submit" variant="default" className="shrink-0">
            Go
          </Button>
        </form>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-bold text-xl">
          Loading...
        </div>
      ) : cards.length === 0 ? (
        <div className="content-card p-12 text-center">
          <p className="text-xl font-bold mb-2">
            {view === "favorites"
              ? "No favorited cards yet"
              : view === "hidden"
                ? "No hidden cards"
                : "No cards"}
          </p>
          <p className="text-muted-foreground text-sm">
            {view === "all"
              ? "Run rp to upload transcripts and generate cards"
              : "Use the buttons on cards to manage favorites and hidden items"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((c) => (
            <Card
              key={c.id}
              card={c}
              onFavorite={handleFavorite}
              onHide={handleHide}
            />
          ))}
        </div>
      )}
    </div>
  );
}
