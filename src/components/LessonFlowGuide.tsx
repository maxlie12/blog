"use client";

import { useEffect, useState } from "react";
import { getLocalCompletionSummary } from "@/lib/localLearningProgress";

const SOURCE_EVENT = "lesson-source-opened";
const RESPONSE_EVENT = "lesson-response-started";

function sourceStorageKey(lessonId: string) {
  return `lesson-source-opened:${lessonId}`;
}

function announceSourceOpened(lessonId: string) {
  try {
    window.sessionStorage.setItem(sourceStorageKey(lessonId), "true");
  } catch {
    // Session state is optional; the lesson remains usable when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent(SOURCE_EVENT, { detail: { lessonId } }));
}

export function announceResponseStarted(lessonId: string) {
  window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: { lessonId } }));
}

export function LessonSourceAction({ lessonId, href, label }: { lessonId: string; href: string; label: string }) {
  return (
    <a
      className="lesson-source-cta"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => announceSourceOpened(lessonId)}
    >
      <span className="lesson-source-cta__badge">BÀI HỌC CHÍNH</span>
      <strong>Mở bài trên {label} <span aria-hidden="true">↗</span></strong>
      <small>Mở tab mới · học ở nguồn rồi quay lại đây để lưu câu trả lời</small>
    </a>
  );
}

export function LessonFlowGuide({
  lessonId,
  language,
  sourceUrl,
}: {
  lessonId: string;
  language: string;
  sourceUrl: string | null;
}) {
  const [step, setStep] = useState(1);
  const [sourceOpened, setSourceOpened] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    function restoreState() {
      const summary = getLocalCompletionSummary(`lesson:${lessonId}`, language);
      setCompleted(summary.completed);
      if (summary.completed) {
        setStep(4);
        return;
      }
      try {
        if (window.sessionStorage.getItem(sourceStorageKey(lessonId)) === "true") {
          setSourceOpened(true);
          setStep(2);
        }
      } catch {
        // Session state is optional.
      }
    }
    function handleSource(event: Event) {
      if ((event as CustomEvent<{ lessonId?: string }>).detail?.lessonId !== lessonId) return;
      setSourceOpened(true);
      setStep(2);
    }
    function handleResponse(event: Event) {
      if ((event as CustomEvent<{ lessonId?: string }>).detail?.lessonId !== lessonId) return;
      setStep(3);
    }
    function handleProgress() {
      const summary = getLocalCompletionSummary(`lesson:${lessonId}`, language);
      setCompleted(summary.completed);
      if (summary.completed) setStep(4);
    }

    restoreState();
    window.addEventListener(SOURCE_EVENT, handleSource);
    window.addEventListener(RESPONSE_EVENT, handleResponse);
    window.addEventListener("learning-progress-changed", handleProgress);
    return () => {
      window.removeEventListener(SOURCE_EVENT, handleSource);
      window.removeEventListener(RESPONSE_EVENT, handleResponse);
      window.removeEventListener("learning-progress-changed", handleProgress);
    };
  }, [language, lessonId]);

  const steps = ["Mục tiêu", "Bài học chính", "Làm & lưu", "Done & ghi nhớ"];

  function goToResponse() {
    announceResponseStarted(lessonId);
    const response = document.getElementById(`${lessonId}-response`);
    response?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => response?.focus({ preventScroll: true }), 250);
  }

  return (
    <>
      <div className="lesson-session-scope" aria-label="Phạm vi phiên học">
        <span>5–10 phút</span><span>1 nguồn</span><span>1 đầu ra</span>
      </div>
      <ol className="lesson-route" aria-label="Luồng học của bài này">
        {steps.map((label, index) => {
          const number = index + 1;
          const state = number < step ? "complete" : number === step ? "current" : "upcoming";
          return (
            <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span>{number}</span>
              <span className="lesson-route__copy"><strong>{label}</strong>{state === "current" && <small>Đang làm</small>}</span>
            </li>
          );
        })}
      </ol>
      {!completed && (
        <div className="lesson-mobile-action" aria-label="Hành động tiếp theo">
          {!sourceOpened && sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={() => announceSourceOpened(lessonId)}>
              Mở bài học <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <button type="button" onClick={goToResponse}>Viết câu trả lời</button>
          )}
        </div>
      )}
    </>
  );
}
