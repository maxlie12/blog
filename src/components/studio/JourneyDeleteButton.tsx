"use client";

import { deleteCheckpoint } from "@/app/studio/(dashboard)/journey/actions";

export function DeleteCheckpointButton({ id }: { id: string }) {
  return (
    <form action={deleteCheckpoint.bind(null, id)}>
      <button
        type="submit"
        className="button button--ghost button--sm button--danger"
        onClick={(e) => {
          if (!confirm("Delete this checkpoint and its evidence?")) e.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
