# Generates one narration MP3 and one SRT caption file per scene with edge-tts, then prints durations.
import asyncio, json, pathlib, subprocess, sys
import edge_tts, imageio_ffmpeg

HERE = pathlib.Path(__file__).parent
OUT = HERE / "audio"
OUT.mkdir(exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()


def duration(path):
    r = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


async def one(scene, tries=4):
    for attempt in range(tries):
        try:
            comm = edge_tts.Communicate(scene["text"], scene["voice"], rate=scene["rate"], boundary="WordBoundary")
            sub = edge_tts.SubMaker()
            audio = bytearray()
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                    sub.feed(chunk)
            (OUT / f"{scene['id']}.mp3").write_bytes(audio)
            (OUT / f"{scene['id']}.words.srt").write_text(sub.get_srt(), encoding="utf-8")
            return
        except edge_tts.exceptions.NoAudioReceived:
            print(f"{scene['id']}: no audio, retrying ({attempt + 1})")
            await asyncio.sleep(3 * (attempt + 1))
    raise SystemExit(f"{scene['id']}: the voice service gave no audio after {tries} tries")


async def main():
    scenes = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    for s in scenes:
        if not only or s["id"] in only:
            await one(s)
    total = 0.0
    for s in scenes:
        d = duration(OUT / f"{s['id']}.mp3")
        total += d
        print(f"{s['id']:<12} {d:5.1f}s  {len(s['text'].split())} words")
    print(f"total narration {total:.1f}s")


asyncio.run(main())
