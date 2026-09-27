import type { Metadata } from "next";
import { getJourneyCheckpoints } from "@/lib/journeyData";
import {
  createCheckpoint,
  updateCheckpoint,
  setCurrentCheckpoint,
  addEvidence,
  deleteEvidence,
} from "./actions";
import { DeleteCheckpointButton } from "@/components/studio/JourneyDeleteButton";

export const metadata: Metadata = { title: "Mountain journey · Studio" };
export const dynamic = "force-dynamic";

export default async function StudioJourneyPage() {
  const checkpoints = await getJourneyCheckpoints();

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <h1>Mountain journey</h1>
          <p>
            Personal learning goals, not a CEFR assessment. &ldquo;You are here&rdquo; is set by
            hand below — nothing computes it from lesson or attempt counts.
          </p>
        </div>
      </header>

      <ul className="journey-editor">
        {checkpoints.map((cp) => (
          <li key={cp.id} className="journey-editor__item">
            <form action={updateCheckpoint} className="studio-form studio-form--inline">
              <input type="hidden" name="id" value={cp.id} />
              <label className="field field--sm">
                <span>Label</span>
                <input name="label" defaultValue={cp.label} />
              </label>
              <label className="field field--grow">
                <span>Title</span>
                <input name="title" defaultValue={cp.title} />
              </label>
              <label className="field field--toggle field--sm">
                <input type="checkbox" name="optional" defaultChecked={cp.optional} />
                <span>Optional</span>
              </label>
              <button type="submit" className="button button--ghost button--sm">
                Save
              </button>
            </form>

            <div className="journey-editor__row-actions">
              {cp.isCurrent ? (
                <span className="status-pill status-pill--published">You are here</span>
              ) : (
                <form action={setCurrentCheckpoint.bind(null, cp.id)}>
                  <button type="submit" className="button button--ghost button--sm">
                    Set as current
                  </button>
                </form>
              )}
              <DeleteCheckpointButton id={cp.id} />
            </div>

            <div className="journey-editor__evidence">
              <h3>Evidence ({cp.evidence.length})</h3>
              <ul>
                {cp.evidence.map((e) => (
                  <li key={e.id} className="journey-editor__evidence-item">
                    <div>
                      <strong>{e.label}</strong>
                      {e.note && <p>{e.note}</p>}
                    </div>
                    <form action={deleteEvidence.bind(null, e.id)}>
                      <button type="submit" className="button button--ghost button--sm button--danger">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addEvidence} className="studio-form studio-form--inline">
                <input type="hidden" name="checkpointId" value={cp.id} />
                <label className="field field--grow">
                  <span>Add evidence (e.g. a completed lesson, writing sample, recording, or reflection)</span>
                  <input name="label" placeholder="e.g. Attempt on 'Interview: Tell me about yourself'" required />
                </label>
                <label className="field field--grow">
                  <span>Note</span>
                  <input name="note" placeholder="Optional note" />
                </label>
                <button type="submit" className="button button--ghost button--sm">
                  Add
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <form action={createCheckpoint} className="studio-form studio-form--inline journey-editor__new">
        <label className="field field--sm">
          <span>Label</span>
          <input name="label" placeholder="C2" required />
        </label>
        <label className="field field--grow">
          <span>Title</span>
          <input name="title" placeholder="Optional peak — lifelong learning" required />
        </label>
        <label className="field field--toggle field--sm">
          <input type="checkbox" name="optional" />
          <span>Optional</span>
        </label>
        <button type="submit" className="button button--primary button--sm">
          + Add checkpoint
        </button>
      </form>
    </div>
  );
}
