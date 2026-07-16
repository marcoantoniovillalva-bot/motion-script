"""Correct whisper transcription errors against the real spoken script.

Whisper occasionally mis-hears words. Since we usually already have the exact
script the person read from, this aligns whisper's word-level timestamps
against the ground-truth text (sequence matching), keeps whisper's timing but
swaps in the script's correct spelling, drops words whisper hallucinated that
aren't in the script, and interpolates timestamps for words the script has
but whisper missed entirely. It then re-chunks into short 2-3 word captions
(matching the reference style) and writes directly in the captions-trimmed.json
shape, reusing the speechStart/speechEnd already established by trim-footage.py.
"""

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from transcribe import IMPORTANT_WORDS, MEDIUM_WORDS, clean_word  # noqa: E402


def normalize_token(value: str) -> str:
    value = clean_word(value).lower()
    value = re.sub(r"[^\wàèéìòù]+", "", value, flags=re.UNICODE)
    return value


def tokenize_script(text: str):
    raw_words = re.findall(r"\S+", text)
    return [w for w in raw_words if normalize_token(w)]


def align(whisper_words, script_words):
    """Returns a list of {start, end, word} using script spelling + whisper timing."""
    w_norm = [normalize_token(w["word"]) for w in whisper_words]
    s_norm = [normalize_token(w) for w in script_words]

    matcher = SequenceMatcher(None, w_norm, s_norm, autojunk=False)
    corrected = []

    def interpolate_gap(start_time, end_time, count):
        span = max(end_time - start_time, 0.05)
        step = span / count
        return [(start_time + step * i, start_time + step * (i + 1)) for i in range(count)]

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                w = whisper_words[i1 + k]
                corrected.append({"start": w["start"], "end": w["end"], "word": script_words[j1 + k]})
        elif tag == "replace":
            # Same time span from whisper, but the script's word count for this stretch —
            # prorate evenly across whichever is longer.
            span_start = whisper_words[i1]["start"] if i1 < len(whisper_words) else corrected[-1]["end"] if corrected else 0.0
            span_end = whisper_words[i2 - 1]["end"] if i2 - 1 < len(whisper_words) else span_start + 0.4
            count = j2 - j1
            if count > 0:
                for (start, end), word in zip(interpolate_gap(span_start, span_end, count), script_words[j1:j2]):
                    corrected.append({"start": round(start, 3), "end": round(end, 3), "word": word})
        elif tag == "insert":
            # Script has words whisper never heard — interpolate into the surrounding gap.
            prev_end = corrected[-1]["end"] if corrected else (whisper_words[0]["start"] if whisper_words else 0.0)
            next_start = whisper_words[i1]["start"] if i1 < len(whisper_words) else prev_end + 0.4 * (j2 - j1)
            count = j2 - j1
            for (start, end), word in zip(interpolate_gap(prev_end, next_start, count), script_words[j1:j2]):
                corrected.append({"start": round(start, 3), "end": round(end, 3), "word": word})
        # "delete": whisper heard words not in the script (hallucination/filler) — drop them.

    return corrected


def chunk_score(words):
    """Weighted count of dictionary keyword hits in a chunk — used to pick which whole
    chunks become the orange keyword style (not which single word, the whole chunk)."""
    score = 0
    for w in words:
        token = normalize_token(w)
        if token in IMPORTANT_WORDS:
            score += 3
        elif token in MEDIUM_WORDS:
            score += 1
    return score


def chunk_corrected(words, max_words=2, max_duration=1.0, window=5, keywords_per_window=2):
    """Groups words into short chunks (reference style: 1-3 words each), then marks whole
    chunks — not individual words — as the orange "keyword" style. Selection happens in a
    sliding window so keyword chunks land reasonably evenly spaced (~keywords_per_window out
    of every `window` chunks) instead of clustering or being scattered too far apart."""
    chunks = []
    current = []

    def flush():
        nonlocal current
        if not current:
            return
        text = " ".join(w["word"] for w in current).strip()
        if text:
            chunks.append({
                "start": round(float(current[0]["start"]), 3),
                "end": round(float(current[-1]["end"]), 3),
                "text": text,
                "_score": chunk_score([w["word"] for w in current]),
            })
        current = []

    for word in words:
        if current:
            duration = float(word["end"]) - float(current[0]["start"])
            if len(current) >= max_words or duration > max_duration:
                flush()
        current.append(word)
        if re.search(r"[.!?:]$", word["word"]):
            flush()
    flush()

    # Second pass: pick the top-scoring chunks per rolling window as the whole-chunk
    # keyword/orange style. A chunk can only be chosen once, even though windows overlap.
    chosen = set()
    for start_idx in range(0, len(chunks), window):
        group = list(enumerate(chunks[start_idx:start_idx + window]))
        ranked = sorted(group, key=lambda item: (-item[1]["_score"], item[0]))
        picked = 0
        for local_idx, chunk in ranked:
            if chunk["_score"] <= 0:
                break
            chosen.add(start_idx + local_idx)
            picked += 1
            if picked >= keywords_per_window:
                break

    for i, chunk in enumerate(chunks):
        is_keyword = i in chosen
        chunk["highlight"] = clean_word(chunk["text"]) if is_keyword else ""
        chunk["importance"] = "high" if is_keyword else "low"
        del chunk["_score"]

    return chunks


def main():
    parser = argparse.ArgumentParser(description="Correct transcript against ground-truth script")
    parser.add_argument("--transcript", required=True, help="transcript-raw.json (must contain 'words')")
    parser.add_argument("--script", required=True, help="Plain text file with the exact spoken script")
    parser.add_argument("--existing-captions", required=True, help="captions-trimmed.json to read speechStart/speechEnd from")
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-words", type=int, default=2)
    parser.add_argument("--max-duration", type=float, default=1.0)
    args = parser.parse_args()

    transcript = json.loads(Path(args.transcript).read_text(encoding="utf-8"))
    whisper_words = transcript.get("words")
    if not whisper_words:
        print("Il transcript non contiene 'words' — rigenera con la versione aggiornata di transcribe.py.", file=sys.stderr)
        sys.exit(1)

    script_text = Path(args.script).read_text(encoding="utf-8")
    script_words = tokenize_script(script_text)

    existing = json.loads(Path(args.existing_captions).read_text(encoding="utf-8"))
    speech_start = float(existing["speechStart"])
    speech_end = float(existing["speechEnd"])
    trimmed_duration = speech_end - speech_start

    corrected = align(whisper_words, script_words)
    # Keep only words inside the established speech window, retimed relative to it.
    retimed = []
    for w in corrected:
        start = w["start"] - speech_start
        end = w["end"] - speech_start
        if end <= 0 or start >= trimmed_duration:
            continue
        retimed.append({
            "start": round(max(0.0, start), 3),
            "end": round(min(trimmed_duration, end), 3),
            "word": w["word"],
        })

    chunks = chunk_corrected(retimed, max_words=args.max_words, max_duration=args.max_duration)

    output = {
        "format": existing.get("format"),
        "source": existing.get("source"),
        "model": existing.get("model"),
        "language": existing.get("language"),
        "duration": round(trimmed_duration, 3),
        "chunks": chunks,
        "speechStart": round(speech_start, 3),
        "speechEnd": round(speech_end, 3),
    }
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Captions corrette scritte: {args.output} ({len(chunks)} chunk, {len(script_words)} parole nel copione, {len(whisper_words)} parole whisper)")


if __name__ == "__main__":
    main()
