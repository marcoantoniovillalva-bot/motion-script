"""Lightweight face tracking for zoom centering and chin-anchored captions.

Uses OpenCV's bundled YuNet face detector (tiny ONNX model, no torch/mediapipe
needed) sampled at a modest rate and held/interpolated between samples. Output
is a sparse, resolution-independent (0-1 normalized) track that the Remotion
composition interpolates between: face center (to center zoom on the face
instead of the frame) and an estimated chin Y (to anchor captions under the
chin instead of a fixed screen position).
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np


def find_ffmpeg():
    return shutil.which("ffmpeg") or "ffmpeg"


def find_ffprobe():
    return shutil.which("ffprobe") or "ffprobe"


def probe(path):
    ffprobe = find_ffprobe()
    cmd = [
        ffprobe, "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-show_entries", "format=duration",
        "-of", "json",
        str(path),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(out.stdout)
    stream = data["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    duration = float(data["format"]["duration"])
    return width, height, duration


def even(n):
    return n if n % 2 == 0 else n + 1


def main():
    parser = argparse.ArgumentParser(description="Face-track a talking-head video for zoom centering + chin anchor")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="public/models/face_detection_yunet_2023mar.onnx")
    parser.add_argument("--sample-fps", type=float, default=6.0)
    parser.add_argument("--detect-width", type=int, default=480)
    args = parser.parse_args()

    input_path = Path(args.input)
    model_path = Path(args.model)
    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    if not model_path.exists():
        print(f"Model not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    width, height, duration = probe(input_path)
    detect_w = even(args.detect_width)
    detect_h = even(round(args.detect_width * height / width))

    detector = cv2.FaceDetectorYN.create(
        str(model_path), "", (detect_w, detect_h),
        score_threshold=0.75, nms_threshold=0.3, top_k=1,
    )

    ffmpeg = find_ffmpeg()
    decode_cmd = [
        ffmpeg, "-i", str(input_path),
        "-vf", f"fps={args.sample_fps},scale={detect_w}:{detect_h}",
        "-pix_fmt", "bgr24", "-f", "rawvideo", "-",
    ]
    proc = subprocess.Popen(decode_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    frame_bytes = detect_w * detect_h * 3

    samples = []
    idx = 0
    while True:
        raw = proc.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break
        frame = np.frombuffer(raw, dtype=np.uint8).reshape(detect_h, detect_w, 3)
        t = idx / args.sample_fps
        _, faces = detector.detect(frame)
        if faces is not None and len(faces) > 0:
            f = faces[0]
            x, y, w, h = f[0], f[1], f[2], f[3]
            eye_y = (f[5] + f[7]) / 2.0
            mouth_y = (f[11] + f[13]) / 2.0
            chin_y = mouth_y + (mouth_y - eye_y) * 1.15
            samples.append({
                "t": round(t, 3),
                "cx": round(float((x + w / 2) / detect_w), 4),
                "cy": round(float((y + h / 2) / detect_h), 4),
                "faceW": round(float(w / detect_w), 4),
                "faceH": round(float(h / detect_h), 4),
                "chinY": round(float(min(1.0, max(0.0, chin_y / detect_h))), 4),
            })
        else:
            samples.append({"t": round(t, 3), "cx": None, "cy": None, "faceW": None, "faceH": None, "chinY": None})
        idx += 1
        if idx % 60 == 0:
            print(f"  face-track sample {idx}...")

    proc.stdout.close()
    proc.wait()

    # Forward-fill, then back-fill, any samples where no face was detected.
    last_good = None
    for s in samples:
        if s["cx"] is None and last_good is not None:
            s.update({k: last_good[k] for k in ("cx", "cy", "faceW", "faceH", "chinY")})
        elif s["cx"] is not None:
            last_good = s
    first_good = next((s for s in samples if s["cx"] is not None), None)
    if first_good:
        for s in samples:
            if s["cx"] is None:
                s.update({k: first_good[k] for k in ("cx", "cy", "faceW", "faceH", "chinY")})

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"duration": round(duration, 3), "sampleFps": args.sample_fps, "samples": samples}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Face track written: {output_path} ({len(samples)} samples)")


if __name__ == "__main__":
    main()
