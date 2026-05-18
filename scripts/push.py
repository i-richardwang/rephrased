#!/usr/bin/env python3
"""
push.py — 把本地 data/cards/*.json 推送到云端 API。

用法:
  push.py                          # 推送到 http://localhost:8000
  push.py --url https://my-app.up.railway.app
  push.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = PROJECT_ROOT / "data" / "cards"
STATE_PATH = PROJECT_ROOT / "data" / "state.json"


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except json.JSONDecodeError:
            pass
    return {}


def push_file(card_path: Path, url: str, state: dict, dry_run: bool) -> str:
    data = json.loads(card_path.read_text())
    session_id = data.get("session_id", card_path.stem)
    meta = state.get(session_id, {})
    data["transcript_mtime"] = meta.get("transcript_mtime", 0)

    if dry_run:
        return f"would push {data.get('card_count', 0)} cards"

    payload = json.dumps(data, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{url}/api/ingest",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return f"ok, {result.get('cards_ingested', '?')} cards"
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        return f"HTTP {e.code}: {body}"
    except Exception as e:
        return f"error: {e}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000", help="API base URL")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    card_files = sorted(CARDS_DIR.glob("*.json")) if CARDS_DIR.exists() else []
    if not card_files:
        print("no card files found in data/cards/")
        return 0

    state = load_state()
    print(f"pushing {len(card_files)} session(s) to {args.url}")

    for cf in card_files:
        result = push_file(cf, args.url, state, args.dry_run)
        print(f"  {cf.stem[:8]}... {result}")

    if args.dry_run:
        print("(dry-run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
