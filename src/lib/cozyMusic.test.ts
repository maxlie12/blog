import assert from "node:assert/strict";
import test from "node:test";
import { MUSIC_DEFAULTS, parseMusicSettings, sectionMelody } from "./cozyMusic.ts";

test("music settings fall back to on at 60% and clamp the volume", () => {
  assert.deepEqual(parseMusicSettings(null), MUSIC_DEFAULTS);
  assert.deepEqual(parseMusicSettings("not json"), MUSIC_DEFAULTS);
  assert.deepEqual(parseMusicSettings('{"on":false,"volume":3}'), { on: false, volume: 1 });
  assert.deepEqual(parseMusicSettings('{"on":"yes","volume":-1}'), { on: true, volume: 0 });
});

test("the melody stays in its bar and lands on chord notes on strong beats", () => {
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59]];
  for (let seed = 1; seed < 40; seed += 1) {
    const bars = sectionMelody("village", chords, seed);
    assert.equal(bars.length, 4);
    bars.forEach((notes, bar) => {
      const classes = new Set(chords[bar].map((midi) => midi % 12));
      for (const note of notes) {
        assert.ok(note.step >= 0 && note.step + note.steps <= 16, `seed ${seed} bar ${bar}: ${JSON.stringify(note)}`);
        assert.ok(note.midi >= 65 && note.midi <= 81);
        if (note.step % 8 === 0) assert.ok(classes.has(note.midi % 12), `seed ${seed} bar ${bar}: ${note.midi} is not in the chord`);
      }
    });
  }
});
