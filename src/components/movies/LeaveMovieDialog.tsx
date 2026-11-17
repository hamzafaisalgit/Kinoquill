import { useEffect, useRef } from "react";
import type { Blocker } from "react-router-dom";
import { FilePenLine } from "lucide-react";
export function LeaveMovieDialog({ blocker }: { blocker: Blocker }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="duplicate-dialog"
      aria-labelledby="leave-movie-heading"
      onCancel={(event) => {
        event.preventDefault();
        blocker.reset?.();
      }}
    >
      <FilePenLine size={25} className="accent" />
      <p className="eyebrow">YOUR UNFINISHED CHAPTER</p>
      <h2 id="leave-movie-heading">Keep working on this record?</h2>
      <p>
        You have unsaved changes. Stay to finish your entry, or leave and
        discard those changes. Your saved library is unchanged.
      </p>
      <div className="dialog-actions">
        <button autoFocus className="button" onClick={() => blocker.reset?.()}>
          Stay and keep editing
        </button>
        <button
          className="secondary-button"
          onClick={() => blocker.proceed?.()}
        >
          Discard changes and leave
        </button>
      </div>
    </dialog>
  );
}
