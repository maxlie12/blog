"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitAttempt, type SubmitAttemptState } from "@/app/learning/attemptActions";
import type { SkillId } from "@/lib/lessonsData";

const initialState: SubmitAttemptState = {};

const ANSWER_LABEL: Record<SkillId, string> = {
  writing: "Your answer",
  reading: "Your answer",
  listening: "Your answer / notes",
  speaking: "Transcript (what you said)",
};

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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
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
        {audioUrl && <audio controls src={audioUrl} />}
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
  onReset,
}: {
  lessonId: string;
  skill: SkillId;
  onReset: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitAttempt, initialState);

  useEffect(() => {
    if (state.attemptId) router.refresh();
    // Only re-run when a new attempt id shows up — router changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attemptId]);

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
      </div>
    );
  }

  return (
    <form action={formAction} className="studio-form">
      <input type="hidden" name="lessonId" value={lessonId} />

      {skill === "speaking" && <SpeakingRecorder />}

      <label className="field">
        <span>{ANSWER_LABEL[skill]}</span>
        <textarea
          name="response"
          rows={skill === "speaking" ? 3 : 6}
          placeholder={ANSWER_PLACEHOLDER[skill]}
          required
          minLength={3}
        />
      </label>

      {state.error && (
        <p className="post-editor__error" role="alert">
          {state.error}
          {state.error.includes("Sign in") && (
            <>
              {" "}
              <Link href="/studio/login">Sign in →</Link>
            </>
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
export function AttemptSubmitForm({ lessonId, skill }: { lessonId: string; skill: SkillId }) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="attempt-form">
      <AttemptForm
        key={resetKey}
        lessonId={lessonId}
        skill={skill}
        onReset={() => setResetKey((k) => k + 1)}
      />
    </div>
  );
}
