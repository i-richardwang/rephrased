# rephrased

捕捉 AI 把你的话用更精准的方式重新表达的瞬间，做成可复习的卡片。

## 思路

和 AI 对话时有一种常见时刻：你心里有一个想法，但表达得模糊或不到位；AI 理解了你的意思，用更精准的话把同一个想法说了出来。读到时的感觉是「原来可以这样说」而不是「原来是这样」——前者是表达提升，后者是知识获取。本项目只抓前者。

## 架构

```
[本地 Mac (× N 台)]                            [server (e.g. Zeabur)]
~/.claude/projects/*.jsonl
    │ rp  (单文件 Python，零依赖)
    │     POST /api/transcripts, Bearer auth
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

### 本地（每台 Mac 一次）

```bash
# 1. 安装 CLI（单文件，零依赖）
curl -fsSL https://raw.githubusercontent.com/<user>/rephrased/master/cli/rp \
  -o ~/.local/bin/rp && chmod +x ~/.local/bin/rp

# 2. 写配置
rp --init                                       # 生成 ~/.config/rp/config.json 模板
# 编辑该文件，填入 server URL 和 API_TOKEN

# 3. 日常使用
rp                # 增量扫描 ~/.claude/projects/ 并上传
rp --since 7d     # 只看近 7 天
rp --dry-run      # 预览
rp --force        # 全量重推
rp --status       # 查 server 上的处理状态
```

状态分离：`~/.config/rp/config.json`（多设备共享）+ `~/.local/state/rp/state.json`（每台机独立的增量游标）。

### Server 部署

环境变量：

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `API_TOKEN` | `rp` 上传用的 bearer token |
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

- `cli/rp` — 本地端单文件 CLI（Python stdlib only）
- `server/` — Hono + Drizzle + PostgreSQL，含分析 worker 和 LLM 调用
- `server/prompts/analyze.md` — 分析提示词
- `web/` — React 前端

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
