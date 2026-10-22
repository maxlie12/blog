"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitAttempt, type SubmitAttemptState } from "@/app/learning/attemptActions";
import type { SkillId } from "@/lib/lessonTypes";
import { getDefaultLearningMethod, getLearningMethod, getLearningMethods, type LearningMethodId } from "@/lib/learningMethods";
import { getLocalCompletionSummary, recordLocalCompletion, syncLocalProgress, type LocalCompletionSummary } from "@/lib/localLearningProgress";
import { useLearnerProfile } from "@/lib/useLearnerProfile";

const initialState: SubmitAttemptState = {};

const ANSWER_PLACEHOLDER: Record<SkillId, string> = {
  writing: "Write your response here…",
  reading: "Summarize or answer the question(s) about the material…",
  listening: "Write what you understood, or answer the comprehension question…",
  speaking: "Type out what you said (or a close summary) — this is what actually gets saved.",
};

function SpeakingRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        setAudioUrl(URL.createObjectURL(blob));
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
      </div>
      <p className="attempt-form__recorder-hint">
        This recording plays back locally, for your own self-check — it is <strong>not</strong>{" "}
        uploaded or saved (no audio storage is set up yet). Type what you said in the transcript
        field below; that transcript is what actually gets submitted.
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
  const completionId = "lesson:" + lessonId;

  useEffect(() => {
    if (state.attemptId) router.refresh();
    // Only re-run when a new attempt id shows up — router changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attemptId]);

  useEffect(() => {
    queueMicrotask(() => setCompletion(getLocalCompletionSummary(completionId, language)));
  }, [completionId, language]);

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

      {skill === "speaking" && <SpeakingRecorder />}

      <label className="field">
        <span>{method.outputLabel}</span>
        <textarea
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
