"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscribeMessage } from "@/lib/transcribe";

const TRANSCRIBE_STATUS: Record<TranscribeMessage["status"], string> = {
  loading: "Đang tải model chép lời (chỉ lần đầu)…",
  transcribing: "Đang chép lời trên máy…",
  done: "Đã thêm bản nháp vào ô trả lời. Hãy nghe lại và sửa cho đúng điều bạn nói.",
  error: "Không chép lời được trên trình duyệt này. Bạn vẫn có thể tự gõ vào ô trả lời.",
};

/** Local-only recording: audio is played back and optionally transcribed on this device, never uploaded. */
export function SpeakingRecorder({ language, onTranscript }: { language: string; onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [transcribe, setTranscribe] = useState<TranscribeMessage | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setUnsupported(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm" });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setTranscribe(null);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setUnsupported(true);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribeRecording() {
    if (!blobRef.current) return;
    setTranscribe({ status: "loading", progress: 0 });
    try {
      // Whisper expects 16 kHz mono samples; the browser resamples while decoding.
      const context = new AudioContext({ sampleRate: 16000 });
      const audio = (await context.decodeAudioData(await blobRef.current.arrayBuffer())).getChannelData(0);
      void context.close();
      if (!workerRef.current) workerRef.current = new Worker(new URL("../lib/transcribeWorker.ts", import.meta.url), { type: "module" });
      const worker = workerRef.current;
      worker.onmessage = (event: MessageEvent<TranscribeMessage>) => {
        setTranscribe(event.data);
        if (event.data.status === "done") onTranscript(event.data.text);
      };
      worker.onerror = () => setTranscribe({ status: "error" });
      worker.postMessage({ audio, language }, [audio.buffer]);
    } catch {
      setTranscribe({ status: "error" });
    }
  }

  const transcribing = transcribe?.status === "loading" || transcribe?.status === "transcribing";

  if (unsupported) {
    return (
      <p className="attempt-form__recorder-hint">
        Trình duyệt này chưa cho ghi âm (cần quyền micro qua HTTPS hoặc localhost). Hãy gõ lại điều
        bạn đã nói vào ô trả lời.
      </p>
    );
  }

  return (
    <div className="attempt-form__recorder">
      <div className="attempt-form__recorder-controls">
        {recording ? (
          <button type="button" className="button button--ghost button--sm" onClick={stopRecording}>
            Dừng ghi âm
          </button>
        ) : (
          <button type="button" className="button button--ghost button--sm" onClick={startRecording}>
            {audioUrl ? "Ghi âm lại" : "Ghi âm"}
          </button>
        )}
        {audioUrl && <><audio controls src={audioUrl} /><a href={audioUrl} download="speaking-recording">Tải bản ghi</a></>}
        {audioUrl && !recording && (
          <button type="button" className="button button--ghost button--sm" onClick={transcribeRecording} disabled={transcribing}>
            {transcribing ? "Đang chép lời…" : "Chép lời trên máy"}
          </button>
        )}
      </div>
      <p className="attempt-form__recorder-hint" aria-live="polite">
        {recording && "Đang ghi âm…"}
        {!recording && transcribe && (transcribe.status === "loading" && transcribe.progress
          ? `${TRANSCRIBE_STATUS.loading} ${transcribe.progress}%`
          : TRANSCRIBE_STATUS[transcribe.status])}
      </p>
      <p className="attempt-form__recorder-hint">
        Bản ghi chỉ phát lại trên máy này, không tải lên đâu cả. &ldquo;Chép lời trên máy&rdquo; nhận
        dạng giọng nói ngay trong trình duyệt (lần đầu tải khoảng 100MB, sau đó được lưu sẵn) và chỉ
        tạo bản nháp — hãy sửa lại, vì chữ trong ô trả lời mới là thứ được lưu.
      </p>
    </div>
  );
}
