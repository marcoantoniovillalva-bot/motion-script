#!/usr/bin/env python3
"""
edit_pipeline.py — end-to-end "video grezzo -> video editato" pipeline for
talking-head footage. Orchestrates: transcribe -> trim intro/outro -> real
background segmentation + depth blur + color grade -> AI editorial zoom plan
-> face tracking -> Remotion render.

Each stage is skipped if its output already exists and is newer than its
inputs (mtime-based cache), so a killed/interrupted run can be resumed by
just running the same command again — the same "resumable batch" approach
used elsewhere in this project for long renders.

Usage:
    python edit_pipeline.py --input "Video da editare di esempio/video grezzo.mp4" --slug esempio
    python edit_pipeline.py --input raw.mp4 --slug my-video --force
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
WORK_ROOT = ROOT / "raw-edits"


def venv_python():
    candidate = ROOT / ".venv" / "Scripts" / "python.exe"
    return str(candidate) if candidate.exists() else sys.executable


def sh(cmd):
    print("  $ " + " ".join(str(c) for c in cmd))
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        print(f"FAILED (exit {result.returncode}): {' '.join(str(c) for c in cmd)}")
        sys.exit(result.returncode)


def stage_done(output_path: Path, *deps: Path) -> bool:
    if not output_path.exists():
        return False
    output_mtime = output_path.stat().st_mtime
    return all(not dep.exists() or dep.stat().st_mtime <= output_mtime for dep in deps)


def main():
    parser = argparse.ArgumentParser(description="Raw talking-head video -> edited video pipeline")
    parser.add_argument("--input", required=True, help="Path to the raw (grezzo) video")
    parser.add_argument("--slug", required=True, help="Working folder name under raw-edits/")
    parser.add_argument("--force", action="store_true", help="Re-run every stage, ignoring cache")
    parser.add_argument("--whisper-model", default="large-v3")
    parser.add_argument("--language", default="it")
    parser.add_argument("--script", help="Optional path to the exact spoken script (.txt) — corrects ASR errors and produces short 2-3 word captions")
    parser.add_argument("--no-ai-captions", action="store_true",
                        help="Skip the contextual AI caption-correction stage (2c). That stage only runs when no --script is given: with the exact script, align-script.py already fixes ASR errors against ground truth.")
    args = parser.parse_args()

    raw = Path(args.input).resolve()
    if not raw.exists():
        print(f"Input non trovato: {raw}", file=sys.stderr)
        sys.exit(1)

    work = WORK_ROOT / args.slug
    work.mkdir(parents=True, exist_ok=True)
    py = venv_python()

    transcript_raw = work / "transcript-raw.json"
    trimmed = work / "trimmed.mp4"
    captions_trimmed = work / "captions-trimmed.json"
    composited = work / "composited.mp4"
    zoom_plan = work / "zoom-plan.json"
    face_track = work / "face-track.json"

    t0 = time.time()

    if args.force or not stage_done(transcript_raw, raw):
        print("[1/6] Trascrizione (faster-whisper)...")
        sh([py, "scripts/transcribe.py", "--input", str(raw), "--output", str(transcript_raw),
            "--model", args.whisper_model, "--language", args.language])
    else:
        print("[1/6] Trascrizione: cache hit")

    if args.force or not stage_done(trimmed, transcript_raw) or not stage_done(captions_trimmed, transcript_raw):
        print("[2/6] Trim intro/outro sul parlato...")
        sh([py, "scripts/trim-footage.py", "--input", str(raw), "--captions", str(transcript_raw),
            "--output", str(trimmed), "--output-captions", str(captions_trimmed)])
    else:
        print("[2/6] Trim: cache hit")

    if args.script:
        script_path = Path(args.script).resolve()
        if args.force or not stage_done(captions_trimmed, script_path, transcript_raw):
            print("[2b/6] Correzione sottotitoli sul copione esatto...")
            sh([py, "scripts/align-script.py", "--transcript", str(transcript_raw), "--script", str(script_path),
                "--existing-captions", str(captions_trimmed), "--output", str(captions_trimmed)])
        else:
            print("[2b/6] Correzione copione: cache hit")
    elif not args.no_ai_captions:
        # No ground-truth script available: let an LLM catch contextual ASR errors
        # ("la gente" vs "l'agente"). The corrections log doubles as the cache marker —
        # correct-captions.mjs always writes it last, after the (possibly updated) captions.
        corrections_log = work / "captions-corrections.json"
        if args.force or not stage_done(corrections_log, captions_trimmed, transcript_raw):
            print("[2c/6] Correzione IA contestuale dei sottotitoli...")
            sh(["node", "scripts/correct-captions.mjs", f"--captions={captions_trimmed}",
                f"--log={corrections_log}"])
        else:
            print("[2c/6] Correzione IA: cache hit")

    if args.force or not stage_done(composited, trimmed):
        print("[3/6] Segmentazione soggetto + blur depth + color grade (può richiedere 20-30 min su CPU)...")
        sh([py, "scripts/matte-footage.py", "--input", str(trimmed), "--output", str(composited)])
    else:
        print("[3/6] Matting: cache hit")

    if args.force or not stage_done(zoom_plan, captions_trimmed):
        print("[4/6] Piano di zoom editoriale (IA)...")
        sh(["node", "scripts/zoom-plan.mjs", f"--captions={captions_trimmed}", f"--output={zoom_plan}"])
    else:
        print("[4/6] Piano di zoom: cache hit")

    if args.force or not stage_done(face_track, trimmed):
        print("[5/6] Face tracking...")
        sh([py, "scripts/face-track.py", "--input", str(trimmed), "--output", str(face_track)])
    else:
        print("[5/6] Face tracking: cache hit")

    print("[6/6] Render finale (Remotion)...")
    sh(["node", "render-edit.mjs", f"--slug={args.slug}"])

    elapsed = time.time() - t0
    print(f"\nCompletato in {elapsed / 60:.1f} min. Output: renders/talking-head/{args.slug}.mp4")


if __name__ == "__main__":
    main()
