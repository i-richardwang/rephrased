import { useEffect, useState } from "react";
import { api, type TranscriptList, type TranscriptRow } from "@/api";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TranscriptRow["status"], string> = {
  pending: "bg-yellow-200",
  analyzing: "bg-blue-200",
  done: "bg-green-200",
  failed: "bg-coral text-white",
};

const STATUS_LABEL: Record<TranscriptRow["status"], string> = {
  pending: "排队中",
  analyzing: "分析中",
  done: "已完成",
  failed: "失败",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function Transcripts() {
  const [data, setData] = useState<TranscriptList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await api.transcripts();
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>loading…</div>;
  if (!data) return <div>load failed</div>;

  const counts = data.transcripts.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="brutal-border brutal-shadow-sm bg-white px-4 py-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold">{data.transcripts.length}</span>
          <span className="text-xs text-muted-foreground">transcripts</span>
        </div>
        {(["pending", "analyzing", "done", "failed"] as const).map((s) => (
          <div
            key={s}
            className={cn(
              "brutal-border brutal-shadow-sm px-3 py-2 flex items-baseline gap-1 text-sm",
              STATUS_STYLES[s],
            )}
          >
            <span className="font-bold">{counts[s] ?? 0}</span>
            <span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
        <div className="brutal-border brutal-shadow-sm bg-white px-3 py-2 flex items-baseline gap-1 text-sm">
          <span className="font-bold">
            {data.queue.inflight}/{data.queue.size + data.queue.pending}
          </span>
          <span className="text-muted-foreground">queue 运行/总数</span>
        </div>
      </div>

      <div className="space-y-2">
        {data.transcripts.map((t) => (
          <div
            key={t.sessionId}
            className="brutal-border brutal-shadow-sm bg-white p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-muted-foreground truncate">
                {t.sessionId}
              </div>
              {t.sourcePath && (
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {t.sourcePath}
                </div>
              )}
              {t.error && (
                <div className="text-coral text-sm mt-1 font-mono break-all">
                  {t.error}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              <div>uploaded: {formatTime(t.uploadedAt)}</div>
              <div>analyzed: {formatTime(t.analyzedAt)}</div>
            </div>
            <span
              className={cn(
                "brutal-border px-3 py-1 text-sm font-bold whitespace-nowrap",
                STATUS_STYLES[t.status],
              )}
            >
              {STATUS_LABEL[t.status]}
            </span>
          </div>
        ))}
        {data.transcripts.length === 0 && (
          <div className="text-muted-foreground text-center py-12">
            还没有 transcript。在本地运行 <code>python3 scripts/push.py</code> 上传。
          </div>
        )}
      </div>
    </div>
  );
}
