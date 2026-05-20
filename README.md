# Rephrased

Capture the moments when AI rephrases your fuzzy thoughts more precisely — and turn them into reviewable cards.

## What it does

When talking to AI, there's a recurring moment: you have an idea but express it vaguely; the AI understands your intent and says the same thing with sharper language. The feeling is "oh, *that's* how you say it" — not "oh, I didn't know that." The first is an expression upgrade; the second is knowledge acquisition. This tool captures the first kind only.

## Architecture

```
[Local Mac (× N)]                              [Server (e.g. Zeabur)]
~/.claude/projects/*.jsonl
    │ rp  (single-file Python CLI, zero deps)
    │     POST /api/transcripts, Bearer auth
    └────────────────────────────────────────► transcripts table (status=pending)
                                                      │
                                                      ▼
                                              in-process worker
                                                      │ Vercel AI SDK + OpenAI-compatible endpoint
                                                      ▼
                                              cards table (status=done)
                                                      ▲
             Browser ◄── GET /api/cards, /api/transcripts ──┘
```

All analysis happens on the server. Your local machine only reads and uploads transcripts — no LLM toolchain required locally.

## Quick start

### Local setup (once per Mac)

```bash
# 1. Install the CLI (single file, zero dependencies)
curl -fsSL https://raw.githubusercontent.com/i-richardwang/rephrased/master/cli/rp \
  -o ~/.local/bin/rp && chmod +x ~/.local/bin/rp

# 2. Create config
rp --init                  # generates ~/.config/rp/config.json template
# Edit the file — fill in your server URL and API_TOKEN

# 3. Daily use
rp                         # incremental scan & upload (waits 3d after last activity)
rp --cold 1h               # only upload sessions idle for 1+ hour
rp --cold 0                # no cooldown — upload everything including active sessions
rp --since 7d              # only sessions from last 7 days
rp --dry-run               # preview without uploading
rp --force                 # re-push everything (also disables cooldown)
rp --status                # check server-side processing status
```

Config and state are separated: `~/.config/rp/config.json` (shareable across devices) + `~/.local/state/rp/state.json` (per-machine incremental cursor).

### Server deployment

Environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `API_TOKEN` | Bearer token for `rp` uploads |
| `LLM_BASE_URL` | OpenAI-compatible endpoint, e.g. `https://api.xxx.com/v1` |
| `LLM_API_KEY` | API key for the LLM endpoint |
| `LLM_MODEL_ID` | Model ID |
| `LLM_PROVIDER_NAME` | Optional, for logging/debugging |
| `LLM_CONCURRENCY` | Optional, concurrent analysis workers (default: 2) |

Run migrations on first deploy:

```bash
cd server
DATABASE_URL=... npx tsx migrations/run.ts 002_transcripts.sql
```

## Design decisions

- **Granularity**: one session = one analysis pass; the model sees the full conversation before picking cards
- **Incremental**: if a transcript's `transcript_mtime` hasn't changed, re-analysis is skipped
- **Selection criteria**: was this idea already in the user's head before the AI spoke? Yes → record. No → skip.
- **Common types**: Paraphrase / Precise Wording / Structured Expression / Concept Naming (not exhaustive)
- **Zero cards is fine**: most sessions have no learning value — no forced output
- **Max 5 cards per session**

## Project structure

- `cli/rp` — Local single-file CLI (Python stdlib only)
- `server/` — Hono + Drizzle + PostgreSQL, with analysis worker and LLM calls
- `server/prompts/analyze.md` — Analysis prompt
- `web/` — React frontend

## Card schema

```json
{
  "type": "Paraphrase",
  "user_said": "What the user originally said (preserving the vagueness)",
  "ai_phrased": "How the AI expressed the same idea more precisely",
  "takeaway": {
    "vocab": ["key_term_1", "key_term_2"],
    "pattern": "A reusable sentence pattern (can be empty)"
  },
  "context_hint": "Scene for recall",
  "source_ref": { "user_line": 12, "ai_line": 14 }
}
```

## License

MIT
