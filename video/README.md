# Demo video pipeline

How the 2:07 demo video was made (2026-10-26). Everything is free: Microsoft neural voices through `edge-tts`, and the ffmpeg build bundled with `imageio-ffmpeg`.

The finished video and its sources are kept outside git:
- Video: `C:\Users\awais\Videos\SureSend-demo.mp4` (thumbnail `SureSend-thumbnail.png`)
- Sources (recordings, rendered cards, narration audio): `C:\Users\awais\Videos\SureSend-video-source\`
- Devpost gallery images: `C:\Users\awais\Videos\SureSend-gallery\`

## Files

| File | What it is |
|---|---|
| `script.json` | Narration text and voice for each of the ten scenes |
| `tts.py` | Generates `audio/<scene>.mp3` plus word timings (`.words.srt`) for the captions |
| `cards.html` | The title and side cards in SureSend's fonts and colors. Open `cards.html?card=<id>` at 1920x1080 and screenshot each into `cards/<id>.png` (ids: hook, problem, solution, s3 to s7, close) |
| `build.py` | Puts each phone recording into the side card's phone frame, fits it to the narration (speed-up or hold), burns in captions, joins the scenes, and normalizes loudness. Output: `out/suresend-demo-final.mp4` |

`raw/` holds the screen recordings: the live site recorded through Chrome DevTools at 390x844 (2x) for the phone scenes and 1920x1080 for Judge Mode. The cut points that skip PayPal loading time are in `build.py` (`SCENES`).

## Rebuild

```
python -m venv .venv
.venv\Scripts\pip install edge-tts imageio-ffmpeg
copy the folders raw, cards and audio from C:\Users\awais\Videos\SureSend-video-source into this folder
.venv\Scripts\python tts.py      (only if script.json or a voice changed)
.venv\Scripts\python build.py
```

To change the voice, edit `voice` in `script.json` (for example `en-US-AvaNeural` or `en-CA-LiamNeural`), then run `tts.py` and `build.py` again.
