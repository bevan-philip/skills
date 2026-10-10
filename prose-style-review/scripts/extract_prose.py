# /// script
# requires-python = ">=3.10"
# dependencies = ["wenmode>=0.14"]
# ///
"""Parse a markdown file into plain-prose blocks for prose-style-review.

Strips markdown syntax deterministically (via wenmode's mdast parser) so the
text a review quotes from is produced the same way every time. Headings,
paragraphs, list items, blockquotes, and footnote definitions become
reviewable blocks whose plain text is joined into `text`. Formatting survives
as offset ranges into `text` so the review page can render it:

- blocks: ordered list of blocks. Reviewable blocks carry start/end offsets
  into `text`; display-only blocks (code, table, hr) carry `display: true`
  and their own content, and never enter `text`.
- marks: inline formatting ranges {start, end, kind, href?} where kind is
  strong, emphasis, code, delete, or link.
- fnrefs: footnote reference markers {at, label}, zero-width, not in `text`.

Front matter and raw HTML are dropped entirely.
"""

import argparse
import json
import sys
from pathlib import Path

from wenmode import Wenmode
from wenmode.plugins import frontmatter
from wenmode.presets import github

_MARK_KINDS = {"strong": "strong", "emphasis": "emphasis", "delete": "delete", "link": "link"}


class Inline:
    """Accumulates the plain text of one block plus its marks and fnrefs,
    with offsets relative to the start of the block."""

    def __init__(self):
        self.parts = []
        self.length = 0
        self.marks = []
        self.fnrefs = []

    def add(self, s):
        self.parts.append(s)
        self.length += len(s)

    @property
    def text(self):
        return "".join(self.parts)

    def walk(self, nodes):
        for node in nodes or []:
            node_type = node.get("type")
            if node_type == "text":
                self.add(node.get("value", ""))
            elif node_type == "inlineCode":
                start = self.length
                self.add(node.get("value", ""))
                self.marks.append({"start": start, "end": self.length, "kind": "code"})
            elif node_type in _MARK_KINDS:
                start = self.length
                self.walk(node.get("children", []))
                if self.length > start:
                    mark = {"start": start, "end": self.length, "kind": _MARK_KINDS[node_type]}
                    if node_type == "link":
                        mark["href"] = node.get("url", "")
                    self.marks.append(mark)
            elif node_type == "image":
                self.add(node.get("alt") or "")
            elif node_type == "break":
                self.add(" ")
            elif node_type == "footnoteReference":
                self.fnrefs.append({"at": self.length, "label": node.get("label") or node.get("identifier", "")})
            elif node_type == "html":
                continue
            elif node.get("children"):
                self.walk(node["children"])


def inline_of_paragraphs(children):
    """One Inline for a node's immediate paragraph children, joined by a space."""
    inline = Inline()
    first = True
    for child in children or []:
        if child.get("type") != "paragraph":
            continue
        if not first:
            inline.add(" ")
        inline.walk(child.get("children", []))
        first = False
    return inline


def plain(nodes):
    inline = Inline()
    inline.walk(nodes)
    return inline.text


class Extractor:
    def __init__(self):
        self.items = []  # (block dict, Inline or None)
        self.list_counter = 0

    def emit(self, block, inline):
        if inline.text.strip():
            self.items.append((block, inline))

    def walk(self, node, level=0):
        node_type = node.get("type")

        if node_type == "heading":
            inline = Inline()
            inline.walk(node.get("children", []))
            self.emit({"type": "heading", "depth": node.get("depth", 1)}, inline)

        elif node_type == "paragraph":
            inline = Inline()
            inline.walk(node.get("children", []))
            self.emit({"type": "paragraph"}, inline)

        elif node_type == "list":
            self.list_counter += 1
            list_id = self.list_counter
            ordered = bool(node.get("ordered"))
            for item in node.get("children", []) or []:
                children = item.get("children", []) or []
                self.emit(
                    {"type": "list_item", "list": list_id, "ordered": ordered,
                     "number": node.get("start") or 1, "level": level},
                    inline_of_paragraphs(children),
                )
                for child in children:
                    if child.get("type") != "paragraph":
                        self.walk(child, level + 1)

        elif node_type in ("blockquote", "footnoteDefinition"):
            children = node.get("children", []) or []
            if node_type == "blockquote":
                block = {"type": "blockquote"}
            else:
                block = {"type": "footnote", "label": node.get("label") or node.get("identifier", "")}
            self.emit(block, inline_of_paragraphs(children))
            for child in children:
                if child.get("type") != "paragraph":
                    self.walk(child, level)

        elif node_type == "code":
            self.items.append(({"type": "code", "display": True,
                                "lang": node.get("lang") or "", "value": node.get("value", "")}, None))

        elif node_type == "table":
            rows = [[plain(cell.get("children", [])) for cell in row.get("children", [])]
                    for row in node.get("children", [])]
            self.items.append(({"type": "table", "display": True, "rows": rows}, None))

        elif node_type == "thematicBreak":
            self.items.append(({"type": "hr", "display": True}, None))

        # html and definition (link reference defs) are not rendered.


def extract(markdown_source):
    """Return {"text", "blocks", "marks", "fnrefs"} for a markdown string."""
    wen = Wenmode(github(), plugins=[frontmatter])
    tree = wen.parse(markdown_source).to_ast()

    ex = Extractor()
    for child in tree.get("children", []) or []:
        ex.walk(child)

    texts, blocks, marks, fnrefs = [], [], [], []
    offset = 0
    for block, inline in ex.items:
        if inline is None:
            blocks.append(block)
            continue
        if texts:
            offset += 2  # the "\n\n" separator
        start = offset
        texts.append(inline.text)
        offset += len(inline.text)
        blocks.append({**block, "start": start, "end": offset, "text": inline.text})
        marks.extend({**m, "start": m["start"] + start, "end": m["end"] + start} for m in inline.marks)
        fnrefs.extend({**r, "at": r["at"] + start} for r in inline.fnrefs)

    return {"text": "\n\n".join(texts), "blocks": blocks, "marks": marks, "fnrefs": fnrefs}


def extract_plain(source):
    """Treat pasted plain text as paragraphs separated by blank lines."""
    text = source.replace("\r\n", "\n").strip()
    return {"text": text, "blocks": [], "marks": [], "fnrefs": []}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", help="Path to the markdown file")
    parser.add_argument("--out", help="Write JSON here instead of stdout")
    args = parser.parse_args()

    result = extract(Path(args.input).read_text(encoding="utf-8"))
    rendered = json.dumps(result, indent=2, ensure_ascii=False)

    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
        print(args.out)
    else:
        print(rendered)


if __name__ == "__main__":
    main()
