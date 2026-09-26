"use client";

import { useActionState } from "react";
import { SKILLS, type SkillId } from "@/lib/lessonsData";
import { saveLesson, deleteLesson, type LessonFormState } from "@/app/studio/(dashboard)/learning/actions";

export interface EditableLesson {
  id?: string;
  skill: SkillId | "";
  title: string;
  level: string;
  instructions: string;
  material: string;
  exercises: string;
  completionCriteria: string;
}

const initialState: LessonFormState = {};

export function LessonForm({ initial }: { initial: EditableLesson }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: LessonFormState, formData: FormData) => (await saveLesson(formData)) ?? {},
    initialState
  );

  return (
    <form action={formAction} className="studio-form">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <label className="field">
        <span>
          Skill <span className="field__required">*</span>
        </span>
        <select name="skill" defaultValue={initial.skill} required>
          <option value="" disabled>
            Choose a skill
          </option>
          {SKILLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          Title <span className="field__required">*</span>
        </span>
        <input name="title" defaultValue={initial.title} required />
      </label>

      <label className="field">
        <span>
          Target level <span className="field__required">*</span>
        </span>
        <input name="level" defaultValue={initial.level} placeholder="B1+" required />
      </label>

      <label className="field">
        <span>
          Instructions <span className="field__required">*</span>
        </span>
        <textarea name="instructions" defaultValue={initial.instructions} rows={4} required />
      </label>

      <label className="field">
        <span>Source / material</span>
        <textarea name="material" defaultValue={initial.material} rows={3} />
      </label>

      <label className="field">
        <span>Exercise(s)</span>
        <textarea name="exercises" defaultValue={initial.exercises} rows={3} />
      </label>

      <label className="field">
        <span>
          Completion criteria <span className="field__required">*</span>
        </span>
        <textarea
          name="completionCriteria"
          defaultValue={initial.completionCriteria}
          rows={2}
          required
        />
      </label>

      {state?.fieldErrors?.map((err) => (
        <p className="post-editor__error" key={err}>
          {err}
        </p>
      ))}

      <div className="studio-form__actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save lesson" : "Create lesson"}
        </button>
      </div>
    </form>
  );
}

export function DeleteLessonButton({ id }: { id: string }) {
  return (
    <form
      action={deleteLesson.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("Delete this lesson and all its attempts?")) e.preventDefault();
      }}
    >
      <button type="submit" className="button button--ghost button--danger">
        Delete lesson
      </button>
    </form>
  );
}
