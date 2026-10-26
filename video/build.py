# Builds the SureSend demo video: one segment per scene (card or phone recording + narration + captions),
# then joins them. Usage: python build.py   ->  out/suresend-demo.mp4
import json, pathlib, re, subprocess
import imageio_ffmpeg

HERE = pathlib.Path(__file__).parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
SEG = HERE / "seg"
SEG.mkdir(exist_ok=True)
(HERE / "out").mkdir(exist_ok=True)
FPS = 30
PHONE = {"w": 444, "x": 1225, "y": 63}  # inside the phone frame drawn on the side cards
LEAD, TAIL = 0.35, 0.75  # silence before and after each scene's narration

# scene id -> (background card, raw clips as (name, [(start, end), ...] or None for all), layout).
# Cuts skip waits on PayPal's pages, idle time and a frame with a (masked) password being typed.
SCENES = [
    ("s0-hook", "hook", None, "full"),
    ("s1-problem", "problem", None, "full"),
    ("s2-solution", "solution", None, "full"),
    ("s3-hold", "s3", [("s3-hold", [(0, 11)]), ("s3-hold-b", [(0, 13)])], "phone"),
    ("s4-checkin", "s4", [("s4-checkin", None)], "phone"),
    ("s5-verify", "s5", [("s5-verify", [(0, 19.5), (22.6, 24.0)])], "phone"),
    ("s6-safe", "s6", [("s6-notme", None), ("s6-keptsafe", None)], "phone"),
    ("s7-rent", "s7", [("s7-rent", [(0, 23.5), (39, 52.7)])], "phone"),
    ("s8-proof", None, [("s8-proof", [(9, 17.5), (20, 23), (26, 42)])], "screen"),
    ("s9-close", "close", None, "full"),
]


def run(args, cwd=HERE):
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-3000:])


def duration(path):
    r = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def srt_words(path):
    words = []
    for block in path.read_text(encoding="utf-8").strip().split("\n\n"):
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        a, b = lines[1].split(" --> ")
        t = lambda s: (lambda h, m, rest: int(h) * 3600 + int(m) * 60 + float(rest.replace(",", ".")))(*s.split(":"))
        words.append((t(a), t(b), " ".join(lines[2:])))
    return words


def caption_lines(words, text, max_chars=46):
    """Groups word timings into caption lines, using the script text for punctuation."""
    tokens = text.split()
    out, cur, start = [], [], None
    for i, (s, e, _) in enumerate(words):
        tok = tokens[i] if i < len(tokens) else words[i][2]
        if start is None:
            start = s
        cur.append(tok)
        line = " ".join(cur)
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        # Break at sentence ends (unless the line is still very short), at commas once it's long, or when full.
        if (tok[-1:] in ".?!:" and len(line) >= 16) or (tok[-1:] == "," and len(line) > 24) or len(line) + len(nxt) + 1 > max_chars or i == len(words) - 1:
            out.append([start, e + 0.15, line])
            cur, start = [], None
    # Hold each line until the next one starts when the gap is short, so captions don't flicker.
    for a, b in zip(out, out[1:]):
        if b[0] - a[1] < 0.6:
            a[1] = b[0]
    return [tuple(x) for x in out]


def ass_time(t):
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def write_ass(path, lines, layout):
    # Phone scenes: captions under the text column on the left. Others: centered at the bottom.
    if layout == "phone":
        align, ml, mr, mv = 1, 160, 1920 - 160 - 960, 64
    else:
        align, ml, mr, mv = 2, 200, 200, 56
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Segoe UI Semibold,40,&H00F3F8FA,&H00F3F8FA,&H1A161414,&H1A161414,0,0,0,0,100,100,0,0,3,14,0,{align},{ml},{mr},{mv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = "".join(f"Dialogue: 0,{ass_time(s)},{ass_time(e)},Cap,,0,0,0,,{t}\n" for s, e, t in lines)
    path.write_text(head + body, encoding="utf-8")


def build_scene(sid, card, clips, layout, text):
    audio = HERE / "audio" / f"{sid}.mp3"
    dur = LEAD + duration(audio) + TAIL
    lines = [(s + LEAD, e + LEAD, t) for s, e, t in caption_lines(srt_words(HERE / "audio" / f"{sid}.words.srt"), text)]
    ass = SEG / f"{sid}.ass"
    write_ass(ass, lines, layout)
    out = SEG / f"{sid}.mp4"
    a_in = ["-i", str(audio)]
    a_filter = f"[{{a}}:a]adelay={int(LEAD * 1000)}|{int(LEAD * 1000)},apad,atrim=0:{dur:.3f},aformat=sample_rates=48000:channel_layouts=stereo[a]"
    subs = f"subtitles=seg/{sid}.ass"

    if layout == "full":
        args = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", f"cards/{card}.png", *a_in,
                "-filter_complex", f"[0:v]format=yuv420p,{subs}[v];{a_filter.format(a=1)}"]
    else:
        # Cut each kept piece at a steady frame rate, join them, then fit the result to the narration.
        joined = SEG / f"{sid}-joined.mp4"
        size = "scale=444:-2" if layout == "phone" else "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xfaf8f3"
        pieces = []
        for name, segs in clips:
            for k, (a, b) in enumerate(segs or [(0, None)]):
                piece = SEG / f"{sid}-{name}-{k}.mp4"
                cut = ["-ss", f"{a}"] + (["-to", f"{b}"] if b is not None else [])
                run(["-i", f"raw/{name}.mp4", *cut, "-vf", f"fps={FPS},{size},setsar=1", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", str(piece)])
                pieces.append(piece)
        inputs = sum((["-i", str(p)] for p in pieces), [])
        chain = "".join(f"[{i}:v]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0[v]"
        run([*inputs, "-filter_complex", chain, "-map", "[v]", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", str(joined)])
        c = duration(joined)
        speed = max(1.0, min(c / dur, 6.0))
        fit = f"setpts=PTS/{speed:.4f},fps={FPS},tpad=stop_mode=clone:stop_duration={dur:.3f},trim=0:{dur:.3f}"
        if layout == "phone":
            v = f"[0:v]format=yuv420p[bg];[1:v]{fit}[ph];[bg][ph]overlay={PHONE['x']}:{PHONE['y']}:shortest=1,{subs}[v]"
            args = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", f"cards/{card}.png", "-i", str(joined), *a_in,
                    "-filter_complex", f"{v};{a_filter.format(a=2)}"]
        else:
            args = ["-i", str(joined), *a_in, "-filter_complex", f"[0:v]{fit},{subs}[v];{a_filter.format(a=1)}"]
        print(f"  {sid}: clip {c:.1f}s -> {dur:.1f}s (speed x{speed:.2f})")
    run([*args, "-map", "[v]", "-map", "[a]", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-t", f"{dur:.3f}", str(out)])
    return dur


def main():
    script = {s["id"]: s for s in json.loads((HERE / "script.json").read_text(encoding="utf-8"))}
    total = 0.0
    for sid, card, clips, layout in SCENES:
        total += build_scene(sid, card, clips, layout, script[sid]["text"])
    (SEG / "list.txt").write_text("".join(f"file '{sid}.mp4'\n" for sid, *_ in SCENES), encoding="utf-8")
    run(["-f", "concat", "-safe", "0", "-i", "seg/list.txt", "-c", "copy", "-movflags", "+faststart", "out/suresend-demo.mp4"])
    # YouTube-level loudness for the narration; the video stream is copied untouched.
    run(["-i", "out/suresend-demo.mp4", "-c:v", "copy", "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
         "-movflags", "+faststart", "out/suresend-demo-final.mp4"])
    print(f"video: out/suresend-demo-final.mp4, {duration(HERE / 'out' / 'suresend-demo-final.mp4'):.1f}s (scenes sum {total:.1f}s)")


main()
