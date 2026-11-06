"use client";

import { useEffect, useRef, useState } from "react";
import { createCozyMusic, type CozyMusic } from "@/lib/cozyMusic";
import styles from "./StudyMusic.module.css";
import { parseStudyMusicSettings } from "@/lib/studyMusicSettings";

const moods = [
  { name: "Piano chiều yên", theme: "village", calm: true },
  { name: "Vườn nắng · lofi", theme: "village", calm: false },
  { name: "Dây đàn êm", theme: "farm", calm: true },
] as const;

function preferences() {
  try {
    return parseStudyMusicSettings(localStorage.getItem("study-music-v1"));
  } catch { return parseStudyMusicSettings(null); }
}

export function StudyMusic() {
  const [mood, setMood] = useState(() => preferences().mood);
  const [volume, setVolume] = useState(() => preferences().volume);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const music = useRef<CozyMusic | null>(null);

  useEffect(() => {
    function pause() {
      music.current?.setPlaying(false);
      setPlaying(false);
    }
    function hidden() { if (document.hidden) pause(); }
    document.addEventListener("play", pause, true);
    document.addEventListener("study-voice-start", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("play", pause, true);
      document.removeEventListener("study-voice-start", pause);
      document.removeEventListener("visibilitychange", hidden);
      music.current?.dispose();
      music.current = null;
    };
  }, []);

  function remember(nextMood: number, nextVolume: number) {
    try { localStorage.setItem("study-music-v1", JSON.stringify({ mood: nextMood, volume: nextVolume })); }
    catch { setMessage("Lựa chọn chỉ giữ trong lần mở này vì trình duyệt không cho lưu."); }
  }
  function toggle() {
    if (playing) { music.current?.setPlaying(false); setPlaying(false); return; }
    try {
      if (!music.current) music.current = createCozyMusic(moods[mood].theme, volume, moods[mood].calm);
      if (!music.current) { setMessage("Trình duyệt chưa hỗ trợ âm thanh này."); return; }
      music.current.setPlaying(true);
      setPlaying(true);
      setMessage("Nếu chưa nghe được, kiểm tra âm lượng và chế độ im lặng của thiết bị.");
    } catch { setMessage("Không bật được âm thanh. Bạn vẫn có thể học bình thường."); }
  }

  return <aside className={styles.panel} aria-label="Nhạc nền tùy chọn">
    <div className={styles.row}><strong>Góc nhạc chill</strong><button type="button" aria-pressed={playing} onClick={toggle}>{playing ? "Tắt nhạc" : "Bật nhạc"}</button></div>
    <details><summary>Chọn giai điệu và âm lượng</summary><label>Giai điệu<select value={mood} onChange={e => {
      const next = Number(e.target.value); music.current?.dispose(); music.current = null;
      setPlaying(false); setMood(next); remember(next, volume);
    }}>{moods.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}</select></label>
      <label>Âm lượng · {Math.round(volume * 100)}%<input type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={e => {
        const next = Number(e.target.value) / 100; setVolume(next); music.current?.setVolume(next); remember(mood, next);
      }} /></label>
      <p>Nhạc không lời tổng hợp trên thiết bị, không phải bản thu của nghệ sĩ. Chỉ phát khi bạn bật; tự tắt khi nghe audio, ghi âm hoặc đọc mẫu trong phòng tập. Đổi giai điệu cần bấm bật lại.</p>
      <p role="status">{message}</p>
    </details>
  </aside>;
}
