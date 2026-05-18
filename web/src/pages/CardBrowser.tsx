import { useEffect, useState } from "react";
import { api, type Card as CardType, type Stats } from "../api";
import Card from "../components/Card";

export default function CardBrowser() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [filter, setFilter] = useState({ type: "", status: "", q: "" });
  const [loading, setLoading] = useState(true);

  const fetchCards = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filter.type) params.type = filter.type;
    if (filter.status) params.status = filter.status;
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
  }, [filter.type, filter.status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCards();
  };

  const handleReview = async (id: number, status: string) => {
    await api.review(id, status);
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, reviewStatus: status } : c)),
    );
  };

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="brutal-border brutal-shadow-sm bg-white px-4 py-2">
            <span className="text-3xl font-bold">{stats.totalCards}</span>
            <span className="text-xs ml-1 text-ink/60">cards</span>
          </div>
          <div className="brutal-border brutal-shadow-sm bg-white px-4 py-2">
            <span className="text-3xl font-bold">{stats.totalSessions}</span>
            <span className="text-xs ml-1 text-ink/60">sessions</span>
          </div>
          {Object.entries(stats.byType).map(([t, n]) => (
            <div
              key={t}
              className="brutal-border brutal-shadow-sm bg-white px-3 py-2 text-sm"
            >
              <span className="font-bold">{n}</span>{" "}
              <span className="text-ink/60">{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <form
        onSubmit={handleSearch}
        className="brutal-border brutal-shadow bg-white p-4 mb-6 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">
            类型
          </label>
          <select
            value={filter.type}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
            className="brutal-border px-3 py-1.5 bg-cream text-sm font-bold"
          >
            <option value="">全部</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">
            状态
          </label>
          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((f) => ({ ...f, status: e.target.value }))
            }
            className="brutal-border px-3 py-1.5 bg-cream text-sm font-bold"
          >
            <option value="">全部</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="learned">Learned</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">
            搜索
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={filter.q}
              onChange={(e) =>
                setFilter((f) => ({ ...f, q: e.target.value }))
              }
              placeholder="搜索词汇或表达..."
              className="brutal-border px-3 py-1.5 bg-cream text-sm flex-1"
            />
            <button type="submit" className="brutal-btn bg-ink text-cream text-sm">
              Go
            </button>
          </div>
        </div>
      </form>

      {/* Card grid */}
      {loading ? (
        <div className="text-center py-12 text-ink/40 font-bold text-xl">
          Loading...
        </div>
      ) : cards.length === 0 ? (
        <div className="brutal-border brutal-shadow bg-white p-12 text-center">
          <p className="text-xl font-bold mb-2">没有卡片</p>
          <p className="text-ink/60 text-sm">
            运行 extract → analyze → push 来生成卡片
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((c) => (
            <Card key={c.id} card={c} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  );
}
