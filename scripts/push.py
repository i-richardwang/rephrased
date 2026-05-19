#!/usr/bin/env python3
"""
push.py — 把本地 data/transcripts-extracted/*.md 推送到 server 触发分析。

服务端负责调用 LLM 并写卡片入库；本地脚本只负责上传 transcript。

用法:
  push.py                                            # 推送所有 extracted transcript
  push.py --url https://my-app.up.zeabur.app
  push.py --token $API_TOKEN
  push.py --only <sessionId>                         # 只推一个 session
  push.py --since 7d                                 # 只推 mtime 在 7 天内的
  push.py --force                                    # 即使本地认为已 push 过也再推一次
  push.py --dry-run

环境变量:
  LANGUAGE_COACH_URL    默认 server URL(被 --url 覆盖)
  LANGUAGE_COACH_TOKEN  默认 bearer token(被 --token 覆盖)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EXTRACTED_DIR = PROJECT_ROOT / "data" / "transcripts-extracted"
STATE_PATH = PROJECT_ROOT / "data" / "state.json"
PUSH_STATE_PATH = PROJECT_ROOT / "data" / "push_state.json"

DURATION_RE = re.compile(r"^(\d+)\s*([dhwm])$", re.IGNORECASE)


def load_json(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            pass
    return {}


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def parse_since(s: str) -> float:
    m = DURATION_RE.match(s.strip())
    if m:
        n, unit = int(m.group(1)), m.group(2).lower()
        mult = {"h": 3600, "d": 86400, "w": 86400 * 7, "m": 86400 * 30}[unit]
        return (datetime.now(timezone.utc) - timedelta(seconds=n * mult)).timestamp()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"--since 无法解析: {s!r}")


def push_one(
    md_path: Path,
    *,
    state: dict,
    push_state: dict,
    url: str,
    token: str,
    dry_run: bool,
) -> str:
    sid = md_path.stem
    meta = state.get(sid, {})
    source_path = meta.get("source", "")
    transcript_mtime = meta.get("transcript_mtime", md_path.stat().st_mtime)
    content = md_path.read_text()

    if dry_run:
        return f"would push ({len(content)} chars, mtime={transcript_mtime})"

    payload = json.dumps(
        {
            "session_id": sid,
            "source_path": source_path,
            "content": content,
            "transcript_mtime": transcript_mtime,
        },
        ensure_ascii=False,
    ).encode()

    req = urllib.request.Request(
        f"{url.rstrip('/')}/api/transcripts",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            push_state[sid] = {
                "pushed_at": datetime.now(timezone.utc).isoformat(),
                "transcript_mtime": transcript_mtime,
                "status": result.get("status"),
            }
            queued = result.get("queued")
            status = result.get("status")
            return f"{status} ({'queued' if queued else 'no-change'})"
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        return f"HTTP {e.code}: {body}"
    except Exception as e:
        return f"error: {e}"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--url",
        default=os.environ.get("LANGUAGE_COACH_URL", "http://localhost:8000"),
    )
    ap.add_argument("--token", default=os.environ.get("LANGUAGE_COACH_TOKEN"))
    ap.add_argument("--only", help="只推这个 sessionId")
    ap.add_argument("--since", type=parse_since, help="只推 mtime 在此之后的(如 7d / 2026-05-01)")
    ap.add_argument("--force", action="store_true", help="忽略本地 push_state,全部重推")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.token and not args.dry_run:
        print(
            "error: 需要 bearer token,通过 --token 或环境变量 LANGUAGE_COACH_TOKEN 提供",
            file=sys.stderr,
        )
        return 2

    if not EXTRACTED_DIR.exists():
        print(f"目录不存在: {EXTRACTED_DIR}")
        return 0

    md_files = sorted(EXTRACTED_DIR.glob("*.md"))
    if args.only:
        md_files = [p for p in md_files if p.stem == args.only]
    if args.since is not None:
        md_files = [p for p in md_files if p.stat().st_mtime >= args.since]

    if not md_files:
        print("没有要推送的 transcript")
        return 0

    state = load_json(STATE_PATH)
    push_state = load_json(PUSH_STATE_PATH)

    # 增量: 跳过 transcript_mtime 没变的(除非 --force)
    pending: list[Path] = []
    for p in md_files:
        sid = p.stem
        meta = state.get(sid, {})
        mtime = meta.get("transcript_mtime", p.stat().st_mtime)
        recorded = push_state.get(sid, {})
        if (
            not args.force
            and recorded.get("transcript_mtime") == mtime
            and recorded.get("status") in {"done", "pending"}
        ):
            continue
        pending.append(p)

    if not pending:
        print("全部已是最新状态(用 --force 强制重推)")
        return 0

    print(f"推送 {len(pending)} 个 transcript 到 {args.url}")
    for p in pending:
        result = push_one(
            p,
            state=state,
            push_state=push_state,
            url=args.url,
            token=args.token or "",
            dry_run=args.dry_run,
        )
        print(f"  {p.stem[:8]}... {result}")
        if not args.dry_run:
            save_json(PUSH_STATE_PATH, push_state)

    if args.dry_run:
        print("(dry-run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
