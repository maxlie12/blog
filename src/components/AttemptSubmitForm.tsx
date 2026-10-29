"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitAttempt, type SubmitAttemptState } from "@/app/learning/attemptActions";
import type { SkillId } from "@/lib/lessonTypes";
import { getDefaultLearningMethod, getLearningMethod, getLearningMethods, type LearningMethodId } from "@/lib/learningMethods";
import { getLocalCompletionSummary, recordLocalCompletion, syncLocalProgress, type LocalCompletionSummary } from "@/lib/localLearningProgress";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import type { TranscribeMessage } from "@/lib/transcribe";

const initialState: SubmitAttemptState = {};

const ANSWER_PLACEHOLDER: Record<SkillId, string> = {
  writing: "Write your response here…",
  reading: "Summarize or answer the question(s) about the material…",
  listening: "Write what you understood, or answer the comprehension question…",
  speaking: "Type out what you said (or a close summary) — this is what actually gets saved.",
};

const TRANSCRIBE_STATUS: Record<TranscribeMessage["status"], string> = {
  loading: "Đang tải model chép lời (chỉ lần đầu)…",
  transcribing: "Đang chép lời trên máy…",
  done: "Đã thêm bản nháp vào ô bên dưới. Hãy nghe lại và sửa cho đúng điều bạn nói.",
  error: "Không chép lời được trên trình duyệt này. Bạn vẫn có thể tự gõ bên dưới.",
};

function SpeakingRecorder({ language, onTranscript }: { language: string; onTranscript: (text: string) => void }) {
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
        Audio recording isn&apos;t available in this browser/context (needs microphone access
        over HTTPS or localhost). Use the transcript field below instead.
      </p>
    );
  }

  return (
    <div className="attempt-form__recorder">
      <div className="attempt-form__recorder-controls">
        {recording ? (
          <button type="button" className="button button--ghost button--sm" onClick={stopRecording}>
            ■ Stop recording
          </button>
        ) : (
          <button type="button" className="button button--ghost button--sm" onClick={startRecording}>
            ● Record
          </button>
        )}
        {audioUrl && <><audio controls src={audioUrl} /><a href={audioUrl} download="speaking-recording">Download recording</a></>}
        {audioUrl && !recording && (
          <button type="button" className="button button--ghost button--sm" onClick={transcribeRecording} disabled={transcribing}>
            {transcribing ? "Đang chép lời…" : "Chép lời trên máy"}
          </button>
        )}
      </div>
      <p className="attempt-form__recorder-hint" aria-live="polite">
        {transcribe && (transcribe.status === "loading" && transcribe.progress
          ? `${TRANSCRIBE_STATUS.loading} ${transcribe.progress}%`
          : TRANSCRIBE_STATUS[transcribe.status])}
      </p>
      <p className="attempt-form__recorder-hint">
        This recording plays back locally, for your own self-check — it is <strong>not</strong>{" "}
        uploaded or saved. &ldquo;Chép lời trên máy&rdquo; runs speech recognition inside this
        browser (first use downloads about 100MB, then it is cached) and only drafts the
        transcript field below; check and edit it, because that transcript is what gets submitted.
      </p>
    </div>
  );
}

function AttemptForm({
  lessonId,
  skill,
  language,
  onReset,
}: {
  lessonId: string;
  skill: SkillId;
  language: string;
  onReset: () => void;
}) {
  const router = useRouter();
  const learner = useLearnerProfile();
  const [state, formAction, pending] = useActionState(submitAttempt, initialState);
  const methods = getLearningMethods(skill);
  const [methodId, setMethodId] = useState<LearningMethodId>(getDefaultLearningMethod(skill));
  const method = getLearningMethod(methodId);
  const [minutes, setMinutes] = useState(5);
  const [completion, setCompletion] = useState<LocalCompletionSummary | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const responseRef = useRef<HTMLTextAreaElement>(null);
  const completionId = "lesson:" + lessonId;

  useEffect(() => {
    if (!state.attemptId) return;
    router.refresh();
    // A submitted output is the Done criterion, so "Bắt đầu học" moves on; review status stays pending.
    finishLesson();
    // Only re-run when a new attempt id shows up — router changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attemptId]);

  useEffect(() => {
    queueMicrotask(() => setCompletion(getLocalCompletionSummary(completionId, language)));
  }, [completionId, language]);

  function appendTranscript(text: string) {
    const field = responseRef.current;
    if (!field || !text) return;
    // Append so a transcript the learner already typed is never overwritten.
    field.value = field.value.trim() ? `${field.value.trimEnd()}
${text}` : text;
    field.focus();
  }

  function finishLesson() {
    try {
      const result = recordLocalCompletion({ id: completionId, lessonId, language, skill, minutes });
      setCompletion(result);
      setCompletionMessage(result.newlyCompleted ? "Đã ghi Done; đang đồng bộ…" : "Bài này đã được ghi Done trước đó.");
      if (result.newlyCompleted) void syncLocalProgress()
        .then(() => setCompletionMessage("Đã ghi Done, streak và đồng bộ với máy chủ."))
        .catch(() => setCompletionMessage("Đã ghi trên thiết bị; có thể đồng bộ lại khi có mạng."));
    } catch {
      setCompletionMessage("Không ghi được Done trên thiết bị. Bài nộp vẫn được giữ riêng.");
    }
  }

  if (state.attemptId) {
    return (
      <div className="attempt-form__success" role="status">
        <p>✓ Attempt submitted.</p>
        <div className="attempt-form__success-actions">
          <Link href="/learning" className="button button--primary button--sm">
            Học bài tiếp theo →
          </Link>
          <Link href={`/learning/${lessonId}/attempts/${state.attemptId}`}>
            View your submitted attempt →
          </Link>
          <button type="button" className="button button--ghost button--sm" onClick={onReset}>
            Submit another attempt
          </button>
        </div>
        <div className="lesson-completion" data-complete={completion?.completed ? "true" : "false"}>
          <p className="lesson-completion__label">{completion?.completed ? "ĐÃ GHI NHẬN" : "GHI THÓI QUEN"}</p>
          <button type="button" className="button lesson-completion__button" disabled={Boolean(completion?.completed)} onClick={finishLesson}>
            {completion?.completed ? "Đã hoàn thành · streak đã ghi" : "Đã học · ghi Done & streak"}
          </button>
          <p className="lesson-completion__note">Bài nộp đang chờ review; Done chỉ ghi nhận thói quen và không tự tăng cấp độ.</p>
          {completionMessage && <p className="lesson-completion__note">{completionMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="studio-form">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="learnerProfileId" value={learner.id} />

      <fieldset className="learning-methods">
        <legend>Hôm nay bạn muốn học theo cách nào?</legend>
        <p>Phương pháp chỉ hướng dẫn cách làm; bài bạn nhập bên dưới mới là nội dung được nộp.</p>
        <div className="learning-methods__grid">
          {methods.map((item) => <label key={item.id} className="learning-method" data-selected={methodId === item.id ? "true" : "false"}>
            <input type="radio" name="practiceMethod" value={item.id} checked={methodId === item.id} onChange={() => setMethodId(item.id)} />
            <span><strong>{item.label}</strong><small>{item.minutes}</small><span>{item.summary}</span></span>
          </label>)}
        </div>
      </fieldset>
      <div className="learning-method-action" aria-live="polite"><strong>Làm như sau:</strong> {method.action}</div>

      {skill === "speaking" && <SpeakingRecorder language={language} onTranscript={appendTranscript} />}

      <label className="field">
        <span>{method.outputLabel}</span>
        <textarea
          ref={responseRef}
          name="response"
          rows={skill === "speaking" ? 3 : 6}
          placeholder={ANSWER_PLACEHOLDER[skill]}
          required
          minLength={3}
        />
      </label>

      <label className="field">
        <span>Thời gian thực tế (phút)</span>
        <input type="number" name="practiceMinutes" min={1} max={60} required value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      </label>

      {state.error && (
        <p className="post-editor__error" role="alert">
          {state.error}
          {state.error.includes("Sign in") && (
            <>
              {" "}
              <Link href="/sign-in">Sign in →</Link>
            </>
          )}
          {state.error.includes("liên kết hồ sơ") && (
            <> <Link href="/learning#learner-account">Liên kết hồ sơ →</Link></>
          )}
        </p>
      )}

      <button type="submit" className="button button--primary" disabled={pending}>
        {pending ? "Submitting…" : "Submit attempt"}
      </button>
    </form>
  );
}

/** Wraps AttemptForm with a reset key so "submit another attempt" gets a fresh
 * useActionState instance (and a fresh, empty textarea) rather than reusing the success state. */
export function AttemptSubmitForm({ lessonId, skill, language }: { lessonId: string; skill: SkillId; language: string }) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="attempt-form">
      <AttemptForm
        key={resetKey}
        lessonId={lessonId}
        skill={skill}
        language={language}
        onReset={() => setResetKey((k) => k + 1)}
      />
    </div>
  );
}
