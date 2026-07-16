"""Trim raw talking-head footage to the actual speech window.

Derives speechStart/speechEnd from the first/last transcript chunk (word-level
timestamps already computed by transcribe.py), applies a small pre/post-roll
padding, cuts the raw video with ffmpeg, and re-times the captions JSON so
chunk timestamps are relative to the trimmed video.
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

PRE_ROLL = 0.20
POST_ROLL = 0.35


def find_ffmpeg():
    return shutil.which("ffmpeg") or "ffmpeg"


def main():
    parser = argparse.ArgumentParser(description="Trim raw footage to the speech window")
    parser.add_argument("--input", required=True, help="Raw video file")
    parser.add_argument("--captions", required=True, help="Captions JSON from transcribe.py")
    parser.add_argument("--output", required=True, help="Trimmed video output path")
    parser.add_argument("--output-captions", required=True, help="Re-timed captions JSON output path")
    parser.add_argument("--pre-roll", type=float, default=PRE_ROLL)
    parser.add_argument("--post-roll", type=float, default=POST_ROLL)
    args = parser.parse_args()

    input_path = Path(args.input)
    captions_path = Path(args.captions)
    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    if not captions_path.exists():
        print(f"Captions not found: {captions_path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(captions_path.read_text(encoding="utf-8"))
    chunks = data.get("chunks", [])
    if not chunks:
        print("No caption chunks found — cannot derive speech bounds.", file=sys.stderr)
        sys.exit(1)

    total_duration = float(data.get("duration") or chunks[-1]["end"])
    speech_start = max(0.0, chunks[0]["start"] - args.pre_roll)
    speech_end = min(total_duration, chunks[-1]["end"] + args.post_roll)
    trimmed_duration = speech_end - speech_start

    print(f"Speech window: {speech_start:.3f}s -> {speech_end:.3f}s (duration {trimmed_duration:.3f}s)")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    ffmpeg = find_ffmpeg()
    cmd = [
        ffmpeg, "-y",
        "-ss", f"{speech_start:.3f}",
        "-i", str(input_path),
        "-t", f"{trimmed_duration:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "14",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(result.returncode)

    retimed_chunks = []
    for chunk in chunks:
        new_start = chunk["start"] - speech_start
        new_end = chunk["end"] - speech_start
        if new_end <= 0 or new_start >= trimmed_duration:
            continue
        retimed_chunks.append({
            **chunk,
            "start": round(max(0.0, new_start), 3),
            "end": round(min(trimmed_duration, new_end), 3),
        })

    out_captions = {
        "format": data.get("format"),
        "source": str(output_path),
        "model": data.get("model"),
        "language": data.get("language"),
        "duration": round(trimmed_duration, 3),
        "chunks": retimed_chunks,
        "speechStart": round(speech_start, 3),
        "speechEnd": round(speech_end, 3),
    }
    out_captions_path = Path(args.output_captions)
    out_captions_path.parent.mkdir(parents=True, exist_ok=True)
    out_captions_path.write_text(json.dumps(out_captions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Captions written: {out_captions_path} ({len(retimed_chunks)} chunks)")


if __name__ == "__main__":
    main()
