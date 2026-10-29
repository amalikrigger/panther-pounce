"""Synthesize Panther Pounce sound effects with the Python standard library.

    python tools/make_sounds.py

Writes sound/sound_cackle.wav: a deep villain laugh, "MWAH ha ha haaa",
played when a level is lost, and sound/music_theme.wav: the looping spooky
ragtime background music. Made from scratch here (a buzzing "voice" shaped
into an "m" and an "ah"; square and sawtooth waves for the music), so there
is nothing to credit or download. Deterministic: same files every run.
"""
import math
import os
import random
import struct
import wave

RATE = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sound')

# Formants (frequency Hz, bandwidth Hz, gain) for a deep male voice.
AH = ((730, 90, 1.0), (1090, 110, 0.6), (2440, 160, 0.25))
MM = ((260, 80, 0.3), (1000, 300, 0.05), (2200, 300, 0.02))  # lips closed: hum


class Resonator:
    """Two-pole band-pass filter (one formant). Retunable every sample."""

    def __init__(self):
        self.y1 = self.y2 = 0.0

    def __call__(self, x, freq, bw):
        r = math.exp(-math.pi * bw / RATE)
        b1 = 2 * r * math.cos(2 * math.pi * freq / RATE)
        y = (1 - r) * x + b1 * self.y1 - r * r * self.y2
        self.y2, self.y1 = self.y1, y
        return y


def lerp(a, b, k):
    return a + (b - a) * max(0.0, min(1.0, k))


def syllable(buf, start, dur, pitch, onset, rnd, vibrato=0.0, loud=1.0):
    """One "mwah" or "ha". pitch(k) gives Hz at k = 0..1 through the syllable.
    onset 'm' hums with closed lips, then opens into "ah" (the "w" is the glide).
    onset 'h' starts with a breath."""
    voice = [Resonator() for _ in AH]
    breath = [Resonator() for _ in AH]
    n0, n = int(start * RATE), int(dur * RATE)
    phase = 0.0
    for i in range(n):
        t = i / RATE
        k = i / n
        f0 = pitch(k) * (1 + vibrato * math.sin(2 * math.pi * 6 * t))
        f0 *= 1 + 0.015 * (rnd.random() - 0.5)            # jitter: sounds alive
        phase = (phase + f0 / RATE) % 1.0
        # glottal pulse: rounded push for 60% of the cycle, then closed
        src = (math.sin(math.pi * phase / 0.6) if phase < 0.6 else 0.0) - 0.38
        release = min(1.0, (dur - t) / 0.06)
        if onset == 'm':
            open_ = (t - 0.10) / 0.08                      # m ... w-glide ... ah
            amp = lerp(0.45, 1.0, open_) * min(1.0, t / 0.02)
            forms = [(lerp(mf, af, open_), lerp(mb, ab, open_), lerp(mg, ag, open_))
                     for (mf, mb, mg), (af, ab, ag) in zip(MM, AH)]
            h = 0.0
        else:
            amp = min(1.0, max(0.0, (t - 0.03) / 0.03))   # breath first, then voice
            forms = AH
            h = max(0.0, 1 - t / 0.07) * 0.9 + 0.05
        noise = rnd.uniform(-1, 1)
        out = 0.0
        for v, b, (f, bw, g) in zip(voice, breath, forms):
            out += g * v(src * amp * release, f, bw)
            out += g * b(noise * h * release, f, bw * 3) * 0.5
        j = n0 + i
        if j < len(buf):
            buf[j] += out * loud


def cackle():
    rnd = random.Random(31)
    buf = [0.0] * int(2.9 * RATE)

    # MWAH: rises, then falls - the big villain wind-up
    syllable(buf, 0.0, 0.6,
             lambda k: lerp(120, 165, k / 0.4) if k < 0.4 else lerp(165, 115, (k - 0.4) / 0.6),
             'm', rnd, loud=1.1)
    t = 0.78
    for p in (160, 150, 142):                       # ha ha ha
        syllable(buf, t, 0.19, lambda k, p=p: lerp(p, p * 0.85, k), 'h', rnd)
        t += 0.25
    # haaaa: long, falling, wobbling
    syllable(buf, t, 0.95, lambda k: lerp(150, 88, k), 'h', rnd, vibrato=0.05, loud=1.05)

    # dungeon echo
    out = buf[:]
    for delay, gain in ((0.09, 0.3), (0.17, 0.2), (0.26, 0.12), (0.38, 0.06)):
        d = int(delay * RATE)
        for i in range(d, len(out)):
            out[i] += buf[i - d] * gain
    peak = max(abs(v) for v in out) or 1.0
    fade = int(0.2 * RATE)
    for i in range(fade):
        out[-1 - i] *= i / fade
    return [v / peak * 0.85 for v in out]


# ---------------------------------------------------------------------------
# Background music: a spooky ragtime loop (square-wave lead, sawtooth bass).
# 130 bpm, 4 bars, about 7.4 seconds, and it loops seamlessly.
# ---------------------------------------------------------------------------
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# (note, length in 16th notes)
LEAD = [('E5', 2), ('B4', 2), ('G4', 2), ('E4', 2), ('D#4', 2), ('E4', 2), ('B4', 4),
        ('E5', 2), ('D#5', 2), ('D5', 2), ('C#5', 2), ('C5', 4), ('B4', 4),
        ('A4', 2), ('F#4', 2), ('D4', 2), ('C4', 2), ('B3', 2), ('C4', 2), ('G4', 4),
        ('A4', 2), ('G#4', 2), ('G4', 2), ('F#4', 2), ('F4', 4), ('E4', 4)]
BASS = [('E2', 4), ('E3', 4), ('B2', 4), ('E3', 4), ('A2', 4), ('A3', 4), ('E2', 4), ('E3', 4),
        ('D2', 4), ('D3', 4), ('G2', 4), ('G3', 4), ('B2', 4), ('B3', 4), ('E2', 4), ('E3', 4)]


def note_freq(note):
    """'C4', 'D#4' -> Hz (A4 = 440)."""
    name, octave = note[:-1], int(note[-1])
    midi = (octave + 1) * 12 + NOTE_NAMES.index(name)
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def synth_note(freq, dur, kind):
    """One note with a short attack, a small dip, and a release."""
    n = int(RATE * dur)
    a, d, r = int(0.01 * RATE), int(0.05 * RATE), int(0.05 * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        if kind == 'square':
            s = math.sin(2 * math.pi * freq * t)
            v = (s > 0) - (s < 0)
            v *= 0.6
        else:                                   # sawtooth
            v = 2.0 * (t * freq - math.floor(0.5 + t * freq))
        if n > a + d + r:
            if i < a:
                v *= i / a
            elif i < a + d:
                v *= 1 - 0.2 * (i - a) / d
            elif i >= n - r:
                v *= 0.8 * (n - i) / r
            else:
                v *= 0.8
        out.append(v)
    return out


def ragtime():
    sixteenth = 60.0 / 130 / 4
    buf = [0.0] * int(sum(d for _, d in LEAD) * sixteenth * RATE)
    for part, kind, gain in ((LEAD, 'square', 0.3), (BASS, 'sawtooth', 0.25)):
        pos = 0.0
        for note, steps in part:
            dur = steps * sixteenth
            start = int(pos * RATE)
            for i, v in enumerate(synth_note(note_freq(note), dur, kind)):
                if start + i < len(buf):
                    buf[start + i] += v * gain
            pos += dur
    peak = max(abs(v) for v in buf) or 1.0
    return [v / peak * 0.7 for v in buf]


def save(name, samples):
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(v * 32767)) for v in samples))
    print('  %-18s %.2f s' % (name, len(samples) / RATE))


if __name__ == '__main__':
    save('sound_cackle.wav', cackle())
    save('music_theme.wav', ragtime())
