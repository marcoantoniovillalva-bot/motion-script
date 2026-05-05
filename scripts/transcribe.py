import argparse
import json
import re
import sys
from pathlib import Path


def clean_word(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


IMPORTANT_WORDS = {
    "ai",
    "ia",
    "clienti",
    "cliente",
    "vendite",
    "vendita",
    "business",
    "automazione",
    "automatizzare",
    "automatico",
    "tempo",
    "soldi",
    "costi",
    "errore",
    "errori",
    "lead",
    "crm",
    "marketing",
    "whatsapp",
    "profitto",
    "fatturato",
}


MEDIUM_WORDS = {
    "puoi",
    "fare",
    "come",
    "perche",
    "perché",
    "senza",
    "con",
    "oggi",
    "strumenti",
    "sistema",
    "processo",
    "messaggio",
}


def normalize_token(value: str) -> str:
    value = clean_word(value).lower()
    value = re.sub(r"[^\wàèéìòù]+", "", value, flags=re.UNICODE)
    return value


def caption_style(words):
    tokens = [normalize_token(w) for w in words if normalize_token(w)]
    important = [w for w in words if normalize_token(w) in IMPORTANT_WORDS]
    if important:
        return "high", important[-1]
    if any(token in MEDIUM_WORDS for token in tokens):
        return "medium", ""
    return "low", ""


def chunk_words(words, max_words=4, max_duration=1.55):
    chunks = []
    current = []

    def flush():
        nonlocal current
        if not current:
            return
        text = " ".join(w["word"] for w in current).strip()
        if text:
            importance, highlight = caption_style([w["word"] for w in current])
            chunks.append(
                {
                    "start": round(float(current[0]["start"]), 3),
                    "end": round(float(current[-1]["end"]), 3),
                    "text": text,
                    "highlight": clean_word(highlight),
                    "importance": importance,
                }
            )
        current = []

    for word in words:
        if not word.get("word"):
            continue
        if current:
            duration = float(word["end"]) - float(current[0]["start"])
            if len(current) >= max_words or duration > max_duration:
                flush()
        current.append(word)
    flush()
    return chunks


def chunk_segment_text(text, start, end, max_words=4):
    words = [clean_word(w) for w in re.split(r"\s+", text or "") if clean_word(w)]
    if not words:
        return []
    duration = max(float(end) - float(start), 0.8)
    groups = [words[i : i + max_words] for i in range(0, len(words), max_words)]
    step = duration / len(groups)
    chunks = []
    for index, group in enumerate(groups):
        importance, highlight = caption_style(group)
        chunk_start = float(start) + step * index
        chunk_end = float(start) + step * (index + 1)
        chunks.append(
            {
                "start": round(chunk_start, 3),
                "end": round(chunk_end, 3),
                "text": " ".join(group),
                "highlight": highlight,
                "importance": importance,
            }
        )
    return chunks


def main():
    parser = argparse.ArgumentParser(description="Generate Remotion captions with faster-whisper.")
    parser.add_argument("--input", required=True, help="Input video/audio file")
    parser.add_argument("--output", required=True, help="Output captions JSON")
    parser.add_argument("--model", default="small", help="Whisper model: tiny, base, small, medium")
    parser.add_argument("--language", default="it", help="Language code, default it")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "Missing faster-whisper. Install it with:\n"
            "  python -m pip install faster-whisper\n\n"
            "If Python 3.14 fails, install Python 3.11 and run this command with Python 3.11.",
            file=sys.stderr,
        )
        sys.exit(2)

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(input_path),
        language=args.language,
        word_timestamps=True,
        vad_filter=False,
    )

    chunks = []
    raw_segments = []
    for segment in segments:
        raw_segments.append(
            {
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": clean_word(segment.text),
            }
        )
        if segment.words:
            words = [
                {
                    "start": float(word.start),
                    "end": float(word.end),
                    "word": clean_word(word.word),
                }
                for word in segment.words
                if clean_word(word.word)
            ]
            chunks.extend(chunk_words(words))
        else:
            chunks.extend(chunk_segment_text(segment.text, segment.start, segment.end))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "format": "marketizzati-captions-v1",
        "source": str(input_path),
        "model": args.model,
        "language": getattr(info, "language", args.language),
        "duration": getattr(info, "duration", None),
        "chunks": chunks,
        "segments": raw_segments,
    }
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Captions written: {output_path}")
    print(f"Chunks: {len(chunks)}")


if __name__ == "__main__":
    main()
