// Web Worker: on-device Whisper transcription. Audio never leaves the browser; only model files are fetched (then cached).
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { TranscribeMessage, TranscribeRequest } from "./transcribe";

const scope = self as unknown as Worker;
const post = (message: TranscribeMessage) => scope.postMessage(message);
const files = new Map<string, { loaded: number; total: number }>();
let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load() {
  return pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
    dtype: "q8",
    progress_callback: (info) => {
      if (info.status !== "progress") return;
      files.set(info.file, { loaded: info.loaded, total: info.total });
      const sum = [...files.values()].reduce((acc, file) => ({ loaded: acc.loaded + file.loaded, total: acc.total + file.total }), { loaded: 0, total: 0 });
      post({ status: "loading", progress: sum.total ? Math.round((sum.loaded / sum.total) * 100) : 0 });
    },
  }) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
}

scope.onmessage = async (event: MessageEvent<TranscribeRequest>) => {
  try {
    transcriber ??= load();
    const asr = await transcriber;
    post({ status: "transcribing" });
    const output = await asr(event.data.audio, { language: event.data.language, task: "transcribe", chunk_length_s: 30 });
    post({ status: "done", text: (Array.isArray(output) ? output[0] : output).text.trim() });
  } catch {
    transcriber = null;
    files.clear();
    post({ status: "error" });
  }
};
