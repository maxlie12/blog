"use client";

import { useActionState, useState } from "react";
import { addAttempt, updateAttempt, deleteAttempt, type AttemptFormState } from "@/app/studio/(dashboard)/learning/actions";

export interface AttemptView {
  id: string;
  date: string;
  response: string | null;
  feedback: string | null;
  reviewStatus: string;
}

const initialState: AttemptFormState = {};
const today = () => new Date().toISOString().slice(0, 10);

export function AttemptsPanel({ lessonId, attempts }: { lessonId: string; attempts: AttemptView[] }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: AttemptFormState, formData: FormData) => (await addAttempt(formData)) ?? {},
    initialState
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="attempts-panel">
      <h2>Attempts</h2>
      <p className="attempts-panel__hint">
        Record each attempt separately from the lesson definition, so history can be reviewed
        and corrected without losing what the lesson asks for.
      </p>

      <form action={formAction} className="studio-form attempts-panel__form">
        <input type="hidden" name="lessonId" value={lessonId} />
        <div className="attempts-panel__form-row">
          <label className="field">
            <span>Date</span>
            <input type="date" name="date" defaultValue={today()} required />
          </label>
          <label className="field">
            <span>Review status</span>
            <select name="reviewStatus" defaultValue="pending">
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Response / notes</span>
          <textarea name="response" rows={3} placeholder="What did you produce, or how did the session go?" />
        </label>
        <label className="field">
          <span>Feedback</span>
          <textarea name="feedback" rows={2} placeholder="Self-feedback or notes for next time." />
        </label>
        {state?.fieldErrors?.map((err) => (
          <p className="post-editor__error" key={err}>
            {err}
          </p>
        ))}
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? "Adding…" : "Add attempt"}
        </button>
      </form>

      {attempts.length === 0 ? (
        <p className="empty-state">No attempts recorded yet.</p>
      ) : (
        <ul className="attempts-panel__list">
          {attempts.map((attempt) =>
            editingId === attempt.id ? (
              <li key={attempt.id}>
                <form
                  action={async (fd) => {
                    await updateAttempt(fd);
                    setEditingId(null);
                  }}
                  className="studio-form"
                >
                  <input type="hidden" name="id" value={attempt.id} />
                  <input type="hidden" name="lessonId" value={lessonId} />
                  <div className="attempts-panel__form-row">
                    <label className="field">
                      <span>Date</span>
                      <input type="date" name="date" defaultValue={attempt.date} required />
                    </label>
                    <label className="field">
                      <span>Review status</span>
                      <select name="reviewStatus" defaultValue={attempt.reviewStatus}>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="needs-revision">Needs revision</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Response / notes</span>
                    <textarea name="response" rows={3} defaultValue={attempt.response ?? ""} />
                  </label>
                  <label className="field">
                    <span>Feedback</span>
                    <textarea name="feedback" rows={2} defaultValue={attempt.feedback ?? ""} />
                  </label>
                  <div className="studio-form__actions">
                    <button type="submit" className="button button--primary">
                      Save correction
                    </button>
                    <button type="button" className="button button--ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={attempt.id} className="attempts-panel__item">
                <div className="attempts-panel__item-meta">
                  <span>{attempt.date}</span>
                  <span className={`status-pill status-pill--${attempt.reviewStatus}`}>
                    {attempt.reviewStatus}
                  </span>
                </div>
                {attempt.response && <p>{attempt.response}</p>}
                {attempt.feedback && <p className="attempts-panel__feedback">{attempt.feedback}</p>}
                <div className="attempts-panel__item-actions">
                  <button type="button" className="button button--ghost button--sm" onClick={() => setEditingId(attempt.id)}>
                    Correct
                  </button>
                  <form action={deleteAttempt.bind(null, attempt.id, lessonId)}>
                    <button type="submit" className="button button--ghost button--sm button--danger">
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
