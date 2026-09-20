# /// script
# requires-python = ">=3.10"
# dependencies = ["wenmode>=0.14"]
# ///
"""Parse a markdown file into plain-prose blocks for prose-style-review.

Strips markdown syntax deterministically (via wenmode's mdast parser) so the
text a review quotes from is produced the same way every time. Code blocks,
tables, front matter, and raw HTML are dropped entirely; links and images are
reduced to their visible text; headings, paragraphs, list items, blockquotes,
and footnote definitions survive as reviewable prose blocks.
"""

import argparse
import json
import sys
from pathlib import Path

from wenmode import Wenmode
from wenmode.plugins import frontmatter
from wenmode.presets import github

# Inline node types that carry no visible text of their own once flattened.
_DROPPED_INLINE_TYPES = {"html", "footnoteReference"}

# Inline node types whose children should be flattened with no added text.
_TRANSPARENT_INLINE_TYPES = {"strong", "emphasis", "delete", "link"}


def flatten_inline(nodes):
    """Turn a list of mdast inline nodes into plain text."""
    parts = []
    for node in nodes or []:
        node_type = node.get("type")
        if node_type == "text":
            parts.append(node.get("value", ""))
        elif node_type == "inlineCode":
            parts.append(node.get("value", ""))
        elif node_type in _TRANSPARENT_INLINE_TYPES:
            parts.append(flatten_inline(node.get("children", [])))
        elif node_type == "image":
            parts.append(node.get("alt") or "")
        elif node_type == "break":
            parts.append(" ")
        elif node_type in _DROPPED_INLINE_TYPES:
            continue
        elif node.get("children"):
            parts.append(flatten_inline(node["children"]))
    return "".join(parts)


def flatten_direct_paragraphs(children):
    """Join the text of a node's immediate paragraph children only (one level)."""
    paragraphs = [c for c in children or [] if c.get("type") == "paragraph"]
    return " ".join(flatten_inline(p.get("children", [])) for p in paragraphs)


def walk_block(node, blocks):
    """Depth-first walk emitting one block per heading/paragraph/list_item/
    blockquote/footnote.

    List items, blockquotes, and footnote definitions are flattened one level
    (their own direct paragraph text becomes the block), but a nested list or
    blockquote inside them is still walked to produce its own separate blocks.
    """
    node_type = node.get("type")

    if node_type == "heading":
        text = flatten_inline(node.get("children", []))
        if text.strip():
            blocks.append({"type": "heading", "depth": node.get("depth", 1), "text": text})

    elif node_type == "paragraph":
        text = flatten_inline(node.get("children", []))
        if text.strip():
            blocks.append({"type": "paragraph", "text": text})

    elif node_type == "list":
        for item in node.get("children", []) or []:
            walk_block(item, blocks)

    elif node_type == "listItem":
        text = flatten_direct_paragraphs(node.get("children", []))
        if text.strip():
            blocks.append({"type": "list_item", "text": text})
        for child in node.get("children", []) or []:
            if child.get("type") != "paragraph":
                walk_block(child, blocks)

    elif node_type == "blockquote":
        text = flatten_direct_paragraphs(node.get("children", []))
        if text.strip():
            blocks.append({"type": "blockquote", "text": text})
        for child in node.get("children", []) or []:
            if child.get("type") != "paragraph":
                walk_block(child, blocks)

    elif node_type == "footnoteDefinition":
        text = flatten_direct_paragraphs(node.get("children", []))
        if text.strip():
            blocks.append({"type": "footnote", "text": text})
        for child in node.get("children", []) or []:
            if child.get("type") != "paragraph":
                walk_block(child, blocks)

    # code, table, thematicBreak, html, and definition (link reference defs)
    # are not reviewable prose — excluded, not recursed into.


def extract_blocks(markdown_source):
    wen = Wenmode(github(), plugins=[frontmatter])
    tree = wen.parse(markdown_source).to_ast()

    blocks = []
    for child in tree.get("children", []) or []:
        walk_block(child, blocks)
    return blocks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Path to the markdown file")
    parser.add_argument("--out", help="Write JSON here instead of stdout")
    args = parser.parse_args()

    source = Path(args.input).read_text(encoding="utf-8")
    blocks = extract_blocks(source)
    text = "\n\n".join(b["text"] for b in blocks if b["text"].strip())

    result = {"blocks": blocks, "text": text}
    rendered = json.dumps(result, indent=2, ensure_ascii=False)

    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
        print(args.out)
    else:
        print(rendered)


if __name__ == "__main__":
    main()
