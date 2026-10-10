# /// script
# requires-python = ">=3.10"
# dependencies = ["wenmode>=0.14"]
# ///
"""Build and update prose-style-review pages.

  review.py build  <source> --findings f.json [--out review.html] [--open]
  review.py build  <source> --patch p.json    [--out review.html] [--open]
  review.py status <source>

<source> is the file under review. .md/.markdown/.mdx files are parsed as
markdown; anything else is treated as plain text with blank-line paragraphs.
The script extracts the text itself, so the findings file never carries it.

Every build saves the review state (findings plus a snapshot of the text) to
a per-source folder under the system temp directory, so `status` and
`--patch` work across sessions.
"""

import argparse
import difflib
import hashlib
import html
import json
import os
import sys
import tempfile
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_prose import extract, extract_plain  # noqa: E402

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "template.html"
MARKDOWN_SUFFIXES = {".md", ".markdown", ".mdx"}
NEIGHBOUR_FAMILIES = {"cohesion", "coherence", "emphasis"}
FULL_REVIEW_THRESHOLD = 0.4


# --- source and state -------------------------------------------------------

def load_source(path):
    source = Path(path).read_text(encoding="utf-8")
    if Path(path).suffix.lower() in MARKDOWN_SUFFIXES:
        return extract(source)
    return extract_plain(source)


def review_blocks(doc):
    """(type, text) for each reviewable block; plain text falls back to paragraphs."""
    if doc["blocks"]:
        return [(b["type"], b["text"], b["start"]) for b in doc["blocks"] if not b.get("display")]
    out, cur = [], 0
    for p in doc["text"].split("\n\n"):
        if p.strip():
            start = doc["text"].index(p, cur)
            out.append(("paragraph", p, start))
            cur = start + len(p)
    return out


def state_dir(path):
    resolved = str(Path(path).resolve()).lower()
    digest = hashlib.sha1(resolved.encode("utf-8")).hexdigest()[:8]
    return Path(tempfile.gettempdir()) / "prose-style-review" / f"{Path(path).stem[:40]}-{digest}"


def load_state(path):
    f = state_dir(path) / "state.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None


def save_state(path, review, doc):
    d = state_dir(path)
    d.mkdir(parents=True, exist_ok=True)
    state = {
        "source": str(Path(path).resolve()),
        "built": datetime.now().isoformat(timespec="minutes"),
        **review,
        "blocks": [[t, s] for t, s, _ in review_blocks(doc)],
    }
    (d / "state.json").write_text(json.dumps(state, indent=1, ensure_ascii=False), encoding="utf-8")


# --- building ---------------------------------------------------------------

def resolve_quote(text, quote, occurrence):
    occurrence = occurrence or 1
    i = -1
    for _ in range(occurrence):
        i = text.find(quote, i + 1)
        if i < 0:
            return None
    return i


def validate_findings(text, findings):
    problems = []
    for f in findings:
        occurrence = f.get("occurrence", 1)
        if resolve_quote(text, f["quote"], occurrence) is None:
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


def to_utf16(doc):
    """Python offsets count code points; the page's JavaScript counts UTF-16
    units, so shift every offset past each astral character (emoji etc.)."""
    units, n = [0], 0
    for ch in doc["text"]:
        n += 2 if ord(ch) > 0xFFFF else 1
        units.append(n)
    shift = lambda d, keys: {**d, **{k: units[d[k]] for k in keys if k in d}}
    return {
        "blocks": [shift({k: v for k, v in b.items() if k != "text"}, ("start", "end")) for b in doc["blocks"]],
        "marks": [shift(m, ("start", "end")) for m in doc["marks"]],
        "fnrefs": [shift(r, ("at",)) for r in doc["fnrefs"]],
    }


def build_html(review, doc):
    out = TEMPLATE_PATH.read_text(encoding="utf-8")
    out = out.replace("__TITLE__", html.escape(review["title"]))
    out = out.replace("__SUBTITLE__", html.escape(review["subtitle"]))
    out = out.replace("__PATTERNS__", js_embed(review["patterns"]))
    out = out.replace("__TEXT__", js_embed(doc["text"]))
    out = out.replace("__DOC__", js_embed(to_utf16(doc)))
    out = out.replace("__FINDINGS__", js_embed(review["findings"]))
    return out


def apply_patch(state, patch):
    findings = {f["id"]: f for f in state["findings"]}
    unknown = [i for i in patch.get("remove", []) if i not in findings]
    if unknown:
        sys.exit(f"Patch removes unknown finding ids: {', '.join(unknown)}")
    for i in patch.get("remove", []):
        del findings[i]
    for f in patch.get("upsert", []):
        findings[f["id"]] = f  # replacement keeps its slot; new ids append
    review = {k: state[k] for k in ("title", "subtitle", "patterns")}
    review.update({k: patch[k] for k in ("title", "subtitle", "patterns") if k in patch})
    review["findings"] = list(findings.values())
    return review


def cmd_build(args):
    doc = load_source(args.source)

    if args.patch:
        state = load_state(args.source)
        if state is None:
            sys.exit("No saved review for this source; build with --findings first.")
        review = apply_patch(state, json.loads(Path(args.patch).read_text(encoding="utf-8")))
    else:
        data = json.loads(Path(args.findings).read_text(encoding="utf-8"))
        review = {k: data[k] for k in ("title", "subtitle", "patterns", "findings")}

    problems = validate_findings(doc["text"], review["findings"])
    if problems:
        print("Unplaced quotes — fix these before the page can be built:", file=sys.stderr)
        for fid, quote, reason in problems:
            short = quote if len(quote) <= 80 else quote[:77] + "..."
            print(f"  [{fid}] {reason}: {short!r}", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out).resolve() if args.out else state_dir(args.source) / "review.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(build_html(review, doc), encoding="utf-8")
    save_state(args.source, review, doc)

    if args.open:
        os.startfile(str(out_path))  # noqa: S606 — Windows-only, intentional local open

    issues = [f for f in review["findings"] if f.get("severity") != "strength"]
    print(f"{len(issues)} findings, {len(review['findings']) - len(issues)} strengths")
    print(str(out_path))


# --- status -----------------------------------------------------------------

def one_line(s, n=90):
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


def describe(f):
    sev = f.get("severity", "")
    return f'  {f["id"]} [{f["family"]}/{sev}] {f.get("label", "")} — "{one_line(f["quote"], 60)}"'


def cmd_status(args):
    doc = load_source(args.source)
    new = review_blocks(doc)
    words = len(doc["text"].split())
    state = load_state(args.source)
    if state is None:
        print(f"No previous review of this source ({len(new)} blocks, {words} words). Do a full review.")
        return

    old_texts = [s for _, s in state["blocks"]]
    new_texts = [s for _, s, _ in new]
    print(f"Previous review: {len(state['findings'])} findings, built {state['built']}.")
    if old_texts == new_texts:
        print("No changes since the last review.")
        return

    opcodes = difflib.SequenceMatcher(a=old_texts, b=new_texts, autojunk=False).get_opcodes()
    changed, gone, removed = [], [], []  # new block indices; old texts replaced or deleted; old texts with no successor
    for op, i1, i2, j1, j2 in opcodes:
        if op in ("replace", "insert"):
            changed.extend(range(j1, j2))
        if op in ("replace", "delete"):
            gone.extend(old_texts[i1:i2])
            # a replace pairs old blocks with new ones; only the surplus is removed
            removed.extend(old_texts[i1 + (j2 - j1 if op == "replace" else 0):i2])

    moved = [j for j in changed if new_texts[j] in gone]
    edited = [j for j in changed if j not in moved]
    removed_only = [s for s in removed if s not in new_texts]
    ratio = (len(edited) + len(removed_only)) / max(len(old_texts), len(new_texts))

    print(f"Changed: {len(edited)} of {len(new_texts)} blocks edited or added, "
          f"{len(removed_only)} removed, {len(moved)} moved ({ratio:.0%}).")
    if ratio >= FULL_REVIEW_THRESHOLD or moved:
        print("Suggested: full review — the structure changed too much to patch safely.")
    else:
        print("Suggested: patch.")

    print("\nChanged blocks (current text):")
    for j in edited:
        print(f"  b{j} ({new[j][0]}): {new_texts[j]}")
    for j in moved:
        print(f"  b{j} ({new[j][0]}, moved, text unchanged): {one_line(new_texts[j], 70)}")
    if removed_only:
        print("\nRemoved blocks:")
        for s in removed_only:
            print(f"  - {one_line(s)}")

    starts = [s for _, _, s in new]

    def block_of(pos):
        idx = 0
        for k, s in enumerate(starts):
            if s <= pos:
                idx = k
        return idx

    touched = set(changed)
    near = {k for j in touched for k in (j - 1, j + 1)} - touched
    for op, _, _, j1, _ in opcodes:
        if op == "delete":  # a removal leaves a seam between the blocks either side of it
            near |= {j1 - 1, j1} - touched

    stale, rejudge, check, carried = [], [], [], []
    for f in state["findings"]:
        pos = resolve_quote(doc["text"], f["quote"], f.get("occurrence", 1))
        if pos is None:
            stale.append(f)
        elif block_of(pos) in touched:
            rejudge.append(f)
        elif block_of(pos) in near and f["family"] in NEIGHBOUR_FAMILIES:
            check.append(f)
        else:
            carried.append(f)

    for heading, group in (("Stale (quote no longer resolves — remove or re-quote)", stale),
                           ("Re-judge (in a changed block)", rejudge),
                           ("Check (flow finding beside a changed block)", check)):
        if group:
            print(f"\n{heading}:")
            for f in group:
                print(describe(f))

    fams = Counter(f["family"] for f in carried)
    print(f"\nCarried unchanged: {len(carried)} ({', '.join(f'{k} {v}' for k, v in fams.most_common())}).")
    print("Current patterns: " + "; ".join(p.get("title", "") for p in state["patterns"]))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="Render the review page and save state")
    b.add_argument("source")
    g = b.add_mutually_exclusive_group(required=True)
    g.add_argument("--findings", help="JSON with title, subtitle, patterns, findings")
    g.add_argument("--patch", help="JSON with remove, upsert, and optional patterns/subtitle/title")
    b.add_argument("--out", help="Output HTML path (default: the source's state folder)")
    b.add_argument("--open", action="store_true", help="Open the page with the OS default handler")
    b.set_defaults(func=cmd_build)

    s = sub.add_parser("status", help="Compare the source with the last saved review")
    s.add_argument("source")
    s.set_defaults(func=cmd_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
