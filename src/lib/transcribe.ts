// Messages between the speaking recorder and src/lib/transcribeWorker.ts.
export type TranscribeRequest = { audio: Float32Array; language: string };
export type TranscribeMessage =
  | { status: "loading"; progress: number }
  | { status: "transcribing" }
  | { status: "done"; text: string }
  | { status: "error" };
