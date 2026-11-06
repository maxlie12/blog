import assert from "node:assert/strict";
import test from "node:test";
import { parseStudyMusicSettings } from "./studyMusicSettings.ts";

test("study music validates optional preferences without restoring autoplay", () => {
  assert.deepEqual(parseStudyMusicSettings("broken"), { mood: 0, volume: .2 });
  assert.deepEqual(parseStudyMusicSettings(null), { mood: 0, volume: .2 });
  assert.deepEqual(parseStudyMusicSettings('{"mood":2,"volume":5,"on":true}'), { mood: 2, volume: 1 });
  assert.deepEqual(parseStudyMusicSettings('{"mood":-1,"volume":-3}'), { mood: 0, volume: 0 });
});
