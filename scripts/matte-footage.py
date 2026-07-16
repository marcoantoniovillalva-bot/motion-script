"""Real background segmentation + depth blur + color grade for talking-head footage.

Replaces the old create-bokeh-footage.mjs (static elliptical mask) with a real
per-frame alpha matte from RobustVideoMatting (ONNX, CPU), then composites the
sharp subject over a blurred duplicate of the same frame — the same "duplicate
+ remove background + blur behind" technique used manually in CapCut — and
bakes in a fixed color-grade preset in the same ffmpeg pass.

Two passes:
  1. Python + onnxruntime: decode frames at a small proxy resolution, run RVM
     recurrently, upscale the alpha (pha) output back to full resolution, and
     stream it into an ffmpeg encoder to produce a grayscale matte video.
  2. ffmpeg only: split the full-res source into sharp/blurred copies, use the
     matte video as alpha for the sharp copy, overlay it on the blurred copy,
     apply the color grade, mux back the original audio.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    import onnxruntime as ort
except ImportError:
    print("Missing onnxruntime. Install it with: python -m pip install onnxruntime", file=sys.stderr)
    sys.exit(2)

# Preset recalibrated against the user's "regalato" reference frame (2026-07-14, second
# round): cinematic and contrasty but balanced — the first dark pass crushed blacks
# completely and pushed skin too warm/orange. Blacks stay deep but keep shadow detail
# (smaller colorlevels crush, gentler contrast), skin is more neutral (warm colorbalance
# nearly zeroed), neon/mic colors stay intense but controlled (lower saturation pushes).
# Exposure protection for the face lives on the subject layer only (see run_composite),
# as a gamma midtone lift so highlights (forehead, cheeks, teeth) don't blow out.
# Denoise still runs BEFORE the contrast/saturation push (it sits at the top of the
# composite graph so both layers share one pass); vignette last, darkening the background
# edges for subject/background separation. Fixed and reused across videos for a
# consistent brand look.
COLOR_GRADE = (
    "eq=contrast=1.06:saturation=1.06,"
    "colorlevels=rimin=0.003:gimin=0.003:bimin=0.003,"
    "colorbalance=rm=0.03:gm=-0.01:bm=-0.01:rs=0.015:gs=-0.015:bs=-0.01,"
    "vignette=angle=PI/8,"
    # The blurred+darkened background is one big smooth dark gradient — prime real estate
    # for 8-bit banding ("aloni" that shift when the lighting moves). deband smooths the
    # quantization steps, then a whisper of temporal noise dithers the gradients so the
    # banding can't re-form in the encode generations that follow (composite -> render).
    # Keep the noise at alls=4: at this level it's invisible as grain but still dithers.
    "deband=1thr=0.012:2thr=0.012:3thr=0.012:4thr=0.012:range=24:blur=1,"
    "noise=alls=4:allf=t"
)

# Applied to the blurred background layer only: dim it gently (third round: -0.07 still
# read as "too closed" against the reference — shadows must stay readable) and pump the
# neon light colors moderately.
BACKGROUND_GRADE = "eq=brightness=-0.045:saturation=1.20"

# Applied to the sharp subject layer only: gamma lift raises the face/shirt midtones
# without blowing the highlights; selectivecolor warms the skin from yellow-olive toward
# peach/salmon (reference: the "regalato" frame) by pulling cyan out of and pushing
# magenta into the reds/yellows ranges — the navy shirt has no red/yellow content so only
# skin is affected, and background/LEDs/mic live on the other layer entirely; then
# moderate sharpening (subject only, so the blurred background doesn't get its noise
# re-emphasized).
SUBJECT_GRADE = (
    "eq=gamma=1.09,"
    "selectivecolor=reds=-0.12 0.06 -0.04 0:yellows=-0.10 0.15 -0.12 0,"
    "unsharp=5:5:0.5:5:5:0.0"
)


def find_ffmpeg():
    return shutil.which("ffmpeg") or "ffmpeg"


def find_ffprobe():
    return shutil.which("ffprobe") or "ffprobe"


def probe(path):
    ffprobe = find_ffprobe()
    cmd = [
        ffprobe, "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate",
        "-show_entries", "format=duration",
        "-of", "json",
        str(path),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(out.stdout)
    stream = data["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    fps_num, fps_den = stream["r_frame_rate"].split("/")
    fps = float(fps_num) / float(fps_den)
    duration = float(data["format"]["duration"])
    return width, height, fps, duration


def even(n):
    return n if n % 2 == 0 else n + 1


def run_matting(input_path, matte_path, model_path, proxy_width, width, height, fps, stride=2):
    proxy_w = even(proxy_width)
    proxy_h = even(round(proxy_width * height / width))

    sess_options = ort.SessionOptions()
    sess_options.intra_op_num_threads = max(1, (os.cpu_count() or 4))
    session = ort.InferenceSession(str(model_path), sess_options=sess_options, providers=["CPUExecutionProvider"])
    ffmpeg = find_ffmpeg()

    decode_cmd = [
        ffmpeg, "-i", str(input_path),
        "-vf", f"scale={proxy_w}:{proxy_h}",
        "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
    ]
    decode_proc = subprocess.Popen(decode_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    encode_cmd = [
        ffmpeg, "-y",
        "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{width}x{height}", "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p",
        str(matte_path),
    ]
    encode_proc = subprocess.Popen(encode_cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    frame_bytes = proxy_w * proxy_h * 3
    r1 = r2 = r3 = r4 = np.zeros([1, 1, 1, 1], dtype=np.float32)
    downsample_ratio = np.array([1.0], dtype=np.float32)

    frame_idx = 0
    last_alpha_full_bytes = None
    while True:
        raw = decode_proc.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break
        # Only run the (recurrent) model on every `stride`-th frame — this is the expensive
        # step. In-between frames hold the last computed alpha. The subject silhouette barely
        # changes frame-to-frame at 30fps, so this is a fine approximation for a blur mask,
        # and it buys a ~`stride`x speedup on CPU-only inference.
        if frame_idx % stride == 0 or last_alpha_full_bytes is None:
            frame = np.frombuffer(raw, dtype=np.uint8).reshape(proxy_h, proxy_w, 3).astype(np.float32) / 255.0
            src = frame.transpose(2, 0, 1)[None]
            fgr, pha, r1, r2, r3, r4 = session.run(
                None,
                {"src": src, "r1i": r1, "r2i": r2, "r3i": r3, "r4i": r4, "downsample_ratio": downsample_ratio},
            )
            alpha = (pha[0, 0] * 255.0).clip(0, 255).astype(np.uint8)
            alpha_full = np.array(Image.fromarray(alpha).resize((width, height), Image.BILINEAR))
            last_alpha_full_bytes = alpha_full.tobytes()
        encode_proc.stdin.write(last_alpha_full_bytes)
        frame_idx += 1
        if frame_idx % 150 == 0:
            print(f"  matting frame {frame_idx}...")

    decode_proc.stdout.close()
    decode_proc.wait()
    encode_proc.stdin.close()
    encode_proc.wait()
    print(f"Matte written: {matte_path} ({frame_idx} frames)")
    if encode_proc.returncode != 0:
        raise RuntimeError("ffmpeg matte encode failed")


def run_composite(input_path, matte_path, output_path, blur):
    ffmpeg = find_ffmpeg()
    chroma_blur = max(1, blur // 2)
    # The background layer must NOT contain the subject: a plain blur of the whole frame
    # smears the subject's rim light outward past the silhouette, leaving a moving halo
    # around the person. Masked normalized blur instead: alpha = inverted matte, premultiply,
    # blur color and alpha together, unpremultiply — each background pixel becomes the
    # average of only the *background* pixels in its neighborhood, and the subject region
    # gets filled from its surroundings (it's covered by the sharp subject overlay anyway).
    #
    # Mask morphology against the thin edge rim: the upscaled matte edge is a 2-3px band of
    # subject/background-mixed pixels that reads as a color-shifting outline in motion.
    # The subject mask is eroded ~2px (the contaminated rim falls OUTSIDE the subject and
    # gets replaced by clean background fill) and feathered with a slight blur for a soft,
    # natural transition. The background-exclusion mask is dilated ~2px instead, so the
    # fill's source pixels never include the mixed rim either.
    filter_complex = (
        f"[0:v]hqdn3d=3:2:4:3,split=2[sharp][bgsrc];"
        f"[1:v]format=gray,split=2[mraw1][mraw2];"
        f"[mraw1]erosion,erosion,gblur=sigma=1.2[subjmask];"
        f"[mraw2]dilation,dilation,negate[invmask];"
        f"[bgsrc]format=yuva420p[bgsrc4];"
        f"[bgsrc4][invmask]alphamerge,premultiply=inplace=1,"
        f"boxblur=luma_radius={blur}:luma_power=1:chroma_radius={chroma_blur}:chroma_power=1:alpha_radius={blur}:alpha_power=1,"
        f"unpremultiply=inplace=1,format=yuv420p,"
        f"{BACKGROUND_GRADE}[blurred];"
        f"[sharp]{SUBJECT_GRADE}[subject];"
        f"[subject][subjmask]alphamerge[sharpalpha];"
        f"[blurred][sharpalpha]overlay=format=auto[composited];"
        f"[composited]{COLOR_GRADE},format=yuv420p[v]"
    )
    cmd = [
        ffmpeg, "-y",
        "-i", str(input_path),
        "-i", str(matte_path),
        "-filter_complex", filter_complex,
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "13",
        "-b:v", "45M", "-maxrate", "55M", "-bufsize", "90M", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Real segmentation + depth blur + color grade")
    parser.add_argument("--input", required=True, help="Trimmed footage")
    parser.add_argument("--output", required=True, help="Composited output video")
    parser.add_argument("--matte", help="Where to write the intermediate matte video (default: alongside output)")
    parser.add_argument("--model", default="public/models/rvm_mobilenetv3_fp32.onnx")
    # 320/stride-1 (was 224/stride-2): the coarser matte produced a visibly soft, laggy
    # edge — the alpha held across 2 frames made the rim "chase" the subject in motion.
    # ~4x the inference cost, but the edge is the single most quality-critical element.
    parser.add_argument("--proxy-width", type=int, default=320)
    parser.add_argument("--stride", type=int, default=1, help="Run matting inference every Nth frame, hold alpha in between")
    parser.add_argument("--blur", type=int, default=6)
    parser.add_argument("--skip-matting", action="store_true", help="Reuse an existing matte video (skip Stage A)")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    matte_path = Path(args.matte) if args.matte else output_path.with_name(output_path.stem + "-matte.mp4")

    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    model_path = Path(args.model)
    if not args.skip_matting and not model_path.exists():
        print(f"Model not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    width, height, fps, duration = probe(input_path)
    print(f"Input: {width}x{height} @ {fps:.3f}fps, {duration:.2f}s")

    if not args.skip_matting or not matte_path.exists():
        run_matting(input_path, matte_path, model_path, args.proxy_width, width, height, fps, stride=args.stride)
    else:
        print(f"Reusing existing matte: {matte_path}")

    run_composite(input_path, matte_path, output_path, args.blur)
    print(f"Done: {output_path}")


if __name__ == "__main__":
    main()
