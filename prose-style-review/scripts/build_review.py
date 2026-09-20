#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Fill template.html with review data, validating that every finding's
quote resolves against the source text before writing anything out."""

import argparse
import html
import json
import os
import sys
import tempfile
from pathlib import Path

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "template.html"


def resolve_quote(text, quote, occurrence):
    occurrence = occurrence or 1
    i = -1
    for _ in range(occurrence):
        i = text.find(quote, i + 1)
        if i < 0:
            return None
    return i


def validate_findings(data):
    text = data["text"]
    problems = []
    for f in data.get("findings", []):
        occurrence = f.get("occurrence", 1)
        start = resolve_quote(text, f["quote"], occurrence)
        if start is None:
            count = text.count(f["quote"])
            if count == 0:
                reason = "quote not found in text"
            else:
                reason = f"occurrence {occurrence} requested but quote only appears {count} time(s)"
            problems.append((f.get("id", "?"), f["quote"], reason))
    return problems


def js_embed(value):
    """json.dumps, then neutralise </ so it can't close the surrounding <script>."""
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def build_html(data):
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    out = template
    out = out.replace("__TITLE__", html.escape(data["title"]))
    out = out.replace("__SUBTITLE__", html.escape(data["subtitle"]))
    out = out.replace("__PATTERNS__", js_embed(data["patterns"]))
    out = out.replace("__TEXT__", js_embed(data["text"]))
    out = out.replace("__FINDINGS__", js_embed(data["findings"]))
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="Path to the JSON data file")
    parser.add_argument("--out", help="Output HTML path (default: a fresh temp folder)")
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open the written file with the OS default handler (Windows os.startfile)",
    )
    args = parser.parse_args()

    data = json.loads(Path(args.data).read_text(encoding="utf-8"))

    problems = validate_findings(data)
    if problems:
        print("Unplaced quotes — fix these before the page can be built:", file=sys.stderr)
        for fid, quote, reason in problems:
            short = quote if len(quote) <= 80 else quote[:77] + "..."
            print(f"  [{fid}] {reason}: {short!r}", file=sys.stderr)
        sys.exit(1)

    rendered = build_html(data)

    if args.out:
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        out_dir = Path(tempfile.mkdtemp(prefix="prose-style-review-"))
        out_path = out_dir / "review.html"

    out_path.write_text(rendered, encoding="utf-8")

    if args.open:
        os.startfile(str(out_path))  # noqa: S606 — Windows-only, intentional local open

    print(str(out_path))


if __name__ == "__main__":
    main()
