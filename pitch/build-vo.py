# Lays the VO clips on one track and writes their start times to cues.js for the timeline.
import json, subprocess
ids = [f"s{i}" for i in range(6, 14)]
gap = {"s7": 1.2, "s9": 1.2, "s10": .5, "s11": .6, "s12": .7, "s13": 1.4}
dur = lambda f: float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]))
text = {l.split("\t")[0]: (l.split("\t")[1], l.split("\t")[2].strip()) for l in open("vo/script.tsv") if l.strip()}
t, cues = 1.0, {}
for i in ids:
    t += gap.get(i, .5) if cues else 0
    d = dur(f"vo/{i}.mp3")
    cues[i] = {"at": round(t, 3), "dur": round(d, 3), "who": text[i][0], "text": text[i][1]}
    t += d
total = round(t + 4.0, 2)
inputs = sum((["-i", f"vo/{i}.mp3"] for i in ids), [])
delays = ";".join(f"[{n}]adelay={int(cues[i]['at']*1000)}:all=1[a{n}]" for n, i in enumerate(ids))
mix = "".join(f"[a{n}]" for n in range(len(ids))) + f"amix=inputs={len(ids)}:normalize=0,apad=whole_dur={total}[out]"
subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", f"{delays};{mix}", "-map", "[out]", "-t", str(total), "-ar", "48000", "-b:a", "160k", "vo.mp3"], check=True)
open("cues.js", "w").write(f"window.CUES = {json.dumps(cues, ensure_ascii=False)};\nwindow.TOTAL = {total};\n")
print(total, cues)
