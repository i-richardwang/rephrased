# language-coach

从 Claude Code 本地 transcripts 中提取语言学习素材。

## 思路

和 AI 对话时有一种常见时刻：你心里有一个想法，但表达得模糊或不到位；AI 理解了你的意思，用更精准的话把同一个想法说了出来。读到时的感觉是「原来可以这样说」而不是「原来是这样」——前者是表达提升，后者是知识获取。本项目只抓前者。

## 架构

```
[本地 Mac]                                    [server (e.g. Zeabur)]
~/.claude/projects/*.jsonl
    │ scripts/extract.py
    ▼
data/transcripts-extracted/*.md
    │ scripts/push.py (POST /api/transcripts, Bearer auth)
    └────────────────────────────────────────► transcripts 表 (status=pending)
                                                      │
                                                      ▼
                                              in-process worker
                                                      │ Vercel AI SDK + OpenAI 兼容 endpoint
                                                      ▼
                                              cards 表 (status=done)
                                                      ▲
              浏览器 ◄── GET /api/cards, /api/transcripts ──┘
```

**本地只做"读取 + 上传"；分析在 server 完成，用户机器上不需要任何 LLM 工具链。**

## 用法

### 本地

```bash
# 1. 提取(扫 Claude 本地 transcripts)
python3 scripts/extract.py ~/.claude/projects/<proj>/
python3 scripts/extract.py --all --since 7d

# 2. 推送到 server
export LANGUAGE_COACH_URL=https://your-server.example.com
export LANGUAGE_COACH_TOKEN=<bearer token>
python3 scripts/push.py
python3 scripts/push.py --only <sessionId>
python3 scripts/push.py --force
```

### Server 部署

环境变量：

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `API_TOKEN` | push.py 用的 bearer token |
| `LLM_BASE_URL` | OpenAI 兼容 endpoint，如 `https://api.xxx.com/v1` |
| `LLM_API_KEY` | 对应的 key |
| `LLM_MODEL_ID` | 模型 id |
| `LLM_PROVIDER_NAME` | 可选，日志/调试用 |
| `LLM_CONCURRENCY` | 可选，并发分析数(默认 2) |

第一次部署跑迁移：

```bash
cd server
DATABASE_URL=... npx tsx migrations/run.ts 002_transcripts.sql
```

## 设计要点

- **粒度**：一个 session 处理一次，模型看完整对话再挑卡片
- **增量**：transcripts 表里 `transcript_mtime` 没变就跳过重分析
- **判断标准**：这个想法在 AI 开口之前是不是已经在用户脑子里了？是→记录，不是→不记录
- **常见形态**：复述澄清 / 精准用词 / 结构化表达 / 概念命名（不限于此）
- **允许 0 卡片**：多数 session 没学习价值，不强求产出
- **单 session 上限 5 张**

## 目录

- `scripts/` — 本地提取/推送脚本
- `server/` — Hono + Drizzle + PostgreSQL，含分析 worker 和 LLM 调用
- `server/prompts/analyze.md` — 分析提示词
- `web/` — React 前端
- `data/` — 本地运行产出（gitignore，不入库）

## 卡片字段

```json
{
  "type": "复述澄清",
  "user_said": "用户原话（保留模糊感）",
  "ai_phrased": "AI 对同一件事的精准说法",
  "takeaway": {
    "vocab": ["关键词1", "关键词2"],
    "pattern": "可迁移的句式（可空）"
  },
  "context_hint": "回忆场景",
  "source_ref": {"user_line": 12, "ai_line": 14}
}
```
