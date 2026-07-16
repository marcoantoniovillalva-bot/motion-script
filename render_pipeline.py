#!/usr/bin/env python3
"""
render_pipeline.py — cached render pipeline for marketizzati-video-renderer

Hashes copione + format + title to skip AI parse when nothing changed.
Saves ~2000 tokens per cached run.

Usage:
    python render_pipeline.py --folder "renders/5. My Video"
    python render_pipeline.py --input scripts/copione.txt --format vertical --title "My Video"
    python render_pipeline.py --batch           # process all renders/ folders
    python render_pipeline.py --batch --force   # re-parse all (ignore cache)
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
PROPS_DIR = ROOT / "props"
RENDERS_DIR = ROOT / "renders"
CACHE_META_KEY = "__pipeline_cache__"
AVG_TOKENS_PER_PARSE = 2200


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:60]


def hash_inputs(copione: str, fmt: str, title: str, image_bytes: bytes | None = None) -> str:
    h = hashlib.sha256()
    h.update(copione.encode())
    h.update(fmt.encode())
    h.update(title.encode())
    if image_bytes:
        h.update(image_bytes)
    return h.hexdigest()[:16]


def load_props(props_path: Path) -> dict | None:
    if not props_path.exists():
        return None
    try:
        data = json.loads(props_path.read_text(encoding="utf-8"))
        return data
    except Exception:
        return None


def is_cache_hit(props_path: Path, current_hash: str) -> bool:
    data = load_props(props_path)
    if not data:
        return False
    meta = data.get(CACHE_META_KEY, {})
    return meta.get("hash") == current_hash


def save_hash_to_props(props_path: Path, input_hash: str) -> None:
    data = load_props(props_path) or {}
    data[CACHE_META_KEY] = {
        "hash": input_hash,
        "cached_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    props_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def run_parse(input_path: Path, fmt: str, title: str, image_path: Path | None) -> int:
    cmd = [
        "node", "parse-script.mjs",
        "--input", str(input_path),
        "--format", fmt,
        "--title", title,
    ]
    if image_path and image_path.exists():
        cmd += ["--image", str(image_path)]
    print(f"  Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=ROOT)
    return result.returncode


def run_render(props_path: Path, output_dir: Path) -> int:
    # Strip the pipeline cache meta before passing to renderer
    data = load_props(props_path)
    if data and CACHE_META_KEY in data:
        clean = {k: v for k, v in data.items() if k != CACHE_META_KEY}
        clean_path = PROPS_DIR / f"_clean_{props_path.name}"
        clean_path.write_text(
            json.dumps(clean, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        props_arg = clean_path
    else:
        props_arg = props_path

    output_dir.mkdir(parents=True, exist_ok=True)
    title = (data or {}).get("title", props_path.stem)
    out_file = output_dir / f"{slugify(title)}.mp4"

    cmd = [
        "node", "render-motion.mjs",
        f"--props={props_arg}",
        f"--output={out_file}",
    ]
    print(f"  Rendering to: {out_file}")
    result = subprocess.run(cmd, cwd=ROOT)

    # Clean up temp file
    if data and CACHE_META_KEY in data and props_arg != props_path:
        try:
            props_arg.unlink()
        except Exception:
            pass

    return result.returncode


def find_image_in_folder(folder: Path) -> Path | None:
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        matches = list(folder.glob(ext))
        if matches:
            return matches[0]
    return None


def process_folder(folder: Path, force: bool = False) -> dict:
    """Process a single render folder. Returns stats dict."""
    folder = folder.resolve()
    name = folder.name

    # Find copione
    copione_path = folder / "copione.txt"
    if not copione_path.exists():
        return {"folder": name, "status": "skip", "reason": "no copione.txt"}

    copione = copione_path.read_text(encoding="utf-8")
    image_path = find_image_in_folder(folder)
    image_bytes = image_path.read_bytes() if image_path else None

    # Detect format from folder name — default horizontal (all Marketizzati content is 16:9)
    fmt = "vertical" if "vertical" in name.lower() or "verticale" in name.lower() else "horizontal"

    # Detect title: strip leading number "5. " prefix
    title_match = re.match(r"^\d+\.\s*(.+)$", name)
    title = title_match.group(1).strip() if title_match else name

    slug = slugify(title)
    props_path = PROPS_DIR / f"{slug}.json"
    input_hash = hash_inputs(copione, fmt, title, image_bytes)

    hit = not force and is_cache_hit(props_path, input_hash)

    if hit:
        print(f"[{name}] Cache HIT — skipping AI parse (saved ~{AVG_TOKENS_PER_PARSE} tokens)")
        tokens_saved = AVG_TOKENS_PER_PARSE
    else:
        reason = "forced" if force else ("props missing" if not props_path.exists() else "content changed")
        print(f"[{name}] Cache MISS ({reason}) — running AI parse...")
        rc = run_parse(copione_path, fmt, title, image_path)
        if rc != 0:
            return {"folder": name, "status": "error", "reason": f"parse failed (exit {rc})"}
        save_hash_to_props(props_path, input_hash)
        tokens_saved = 0

    print(f"[{name}] Rendering...")
    rc = run_render(props_path, folder)
    if rc != 0:
        return {"folder": name, "status": "error", "reason": f"render failed (exit {rc})"}

    return {"folder": name, "status": "ok", "tokens_saved": tokens_saved}


def process_single(input_path: Path, fmt: str, title: str, image_path: Path | None,
                   output_dir: Path, force: bool) -> dict:
    copione = input_path.read_text(encoding="utf-8")
    image_bytes = image_path.read_bytes() if image_path and image_path.exists() else None
    slug = slugify(title)
    props_path = PROPS_DIR / f"{slug}.json"
    input_hash = hash_inputs(copione, fmt, title, image_bytes)

    hit = not force and is_cache_hit(props_path, input_hash)

    if hit:
        print(f"Cache HIT — skipping AI parse (saved ~{AVG_TOKENS_PER_PARSE} tokens)")
        tokens_saved = AVG_TOKENS_PER_PARSE
    else:
        reason = "forced" if force else ("props missing" if not props_path.exists() else "content changed")
        print(f"Cache MISS ({reason}) — running AI parse...")
        rc = run_parse(input_path, fmt, title, image_path)
        if rc != 0:
            return {"status": "error", "reason": f"parse failed (exit {rc})"}
        save_hash_to_props(props_path, input_hash)
        tokens_saved = 0

    print("Rendering...")
    rc = run_render(props_path, output_dir)
    if rc != 0:
        return {"status": "error", "reason": f"render failed (exit {rc})"}

    return {"status": "ok", "tokens_saved": tokens_saved}


def main():
    parser = argparse.ArgumentParser(description="Cached render pipeline")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--folder", help="Render folder path (auto-detects copione.txt + image)")
    group.add_argument("--batch", action="store_true", help="Process all numbered folders in renders/")
    group.add_argument("--input", help="Copione .txt file path")
    parser.add_argument("--format", choices=["vertical", "horizontal"], default="vertical")
    parser.add_argument("--title", help="Video title (required with --input)")
    parser.add_argument("--image", help="Optional image path (with --input)")
    parser.add_argument("--output", help="Output directory (default: same as --input folder)")
    parser.add_argument("--force", action="store_true", help="Ignore cache, always re-parse")
    args = parser.parse_args()

    PROPS_DIR.mkdir(exist_ok=True)

    total_saved = 0

    if args.batch:
        if not RENDERS_DIR.exists():
            print(f"ERROR: renders/ directory not found at {RENDERS_DIR}")
            sys.exit(1)
        folders = sorted(
            [f for f in RENDERS_DIR.iterdir() if f.is_dir() and re.match(r"^\d+", f.name)],
            key=lambda f: int(re.match(r"^(\d+)", f.name).group(1))
        )
        if not folders:
            print("No numbered folders found in renders/")
            sys.exit(0)

        print(f"Batch processing {len(folders)} folders...\n")
        results = []
        for folder in folders:
            r = process_folder(folder, force=args.force)
            results.append(r)
            total_saved += r.get("tokens_saved", 0)
            print()

        print("=" * 50)
        print("BATCH SUMMARY")
        print("=" * 50)
        for r in results:
            status_icon = "✓" if r["status"] == "ok" else ("⚡" if r["status"] == "skip" else "✗")
            saved = f" (+{r['tokens_saved']} tokens saved)" if r.get("tokens_saved") else ""
            reason = f" — {r['reason']}" if r.get("reason") and r["status"] != "ok" else ""
            print(f"  {status_icon} {r['folder']}{saved}{reason}")
        print(f"\nTotal tokens saved this run: ~{total_saved:,}")
        if total_saved > 0:
            cost_per_1k = 0.003
            saved_usd = (total_saved / 1000) * cost_per_1k
            print(f"Estimated cost saved: ~${saved_usd:.4f}")

    elif args.folder:
        folder = Path(args.folder)
        if not folder.is_absolute():
            folder = ROOT / folder
        r = process_folder(folder, force=args.force)
        total_saved = r.get("tokens_saved", 0)
        if r["status"] == "error":
            print(f"\nERROR: {r['reason']}")
            sys.exit(1)
        if r["status"] == "skip":
            print(f"Skipped: {r['reason']}")
        if total_saved:
            print(f"\n~{total_saved} tokens saved (cache hit)")

    elif args.input:
        if not args.title:
            print("ERROR: --title is required when using --input")
            sys.exit(1)
        input_path = Path(args.input)
        image_path = Path(args.image) if args.image else None
        output_dir = Path(args.output) if args.output else input_path.parent
        r = process_single(
            input_path, args.format, args.title, image_path, output_dir, args.force
        )
        total_saved = r.get("tokens_saved", 0)
        if r["status"] == "error":
            print(f"\nERROR: {r['reason']}")
            sys.exit(1)
        if total_saved:
            print(f"\n~{total_saved} tokens saved (cache hit)")

    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
