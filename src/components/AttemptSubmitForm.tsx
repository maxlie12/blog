"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitAttempt, type SubmitAttemptState } from "@/app/learning/attemptActions";
import type { SkillId } from "@/lib/lessonTypes";
import { getDefaultLearningMethod, getLearningMethod, getLearningMethods, type LearningMethodId } from "@/lib/learningMethods";
import { getLocalCompletionSummary, recordLocalCompletion, syncLocalProgress, type LocalCompletionSummary } from "@/lib/localLearningProgress";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import { SpeakingRecorder } from "@/components/SpeakingRecorder";

const initialState: SubmitAttemptState = {};

const ANSWER_PLACEHOLDER: Record<SkillId, string> = {
  writing: "Viết câu trả lời của bạn…",
  reading: "Tóm tắt hoặc trả lời câu hỏi về nguồn…",
  listening: "Viết điều bạn nghe hiểu, hoặc trả lời câu hỏi…",
  speaking: "Gõ lại điều bạn đã nói (hoặc dùng Chép lời trên máy) — chữ ở đây mới được nộp.",
};

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
        <p>✓ Đã nộp bài.</p>
        <div className="attempt-form__success-actions">
          <Link href="/learning" className="button button--primary button--sm">
            Học bài tiếp theo →
          </Link>
          <Link href={`/learning/${lessonId}/attempts/${state.attemptId}`}>
            Xem bài đã nộp →
          </Link>
          <button type="button" className="button button--ghost button--sm" onClick={onReset}>
            Nộp thêm một bài
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
          id={`${lessonId}-response`}
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
              <Link href="/sign-in">Đăng nhập →</Link>
            </>
          )}
          {state.error.includes("liên kết hồ sơ") && (
            <> <Link href="/learning#learner-account">Liên kết hồ sơ →</Link></>
          )}
        </p>
      )}

      <button type="submit" className="button button--primary" disabled={pending}>
        {pending ? "Đang nộp…" : "Nộp bài"}
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
