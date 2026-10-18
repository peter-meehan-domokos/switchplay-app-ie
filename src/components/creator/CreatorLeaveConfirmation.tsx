"use client";

export default function CreatorLeaveConfirmation({ onCancel, onLeave, onPublishAndLeave }: {
  onCancel: () => void;
  onLeave: () => void;
  onPublishAndLeave: () => void;
}) {
  return <div className="creator-modal-backdrop">
    <div className="creator-modal creator-leave-modal" role="dialog" aria-modal="true" aria-label="Leave Creator confirmation"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); onCancel(); }
        if (event.key === "Tab") {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
          const first = buttons[0], last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <p>You have unpublished changes. Your drafts are saved.</p>
      <div className="creator-modal-actions">
        <button className="creator-modal-secondary" type="button" autoFocus onClick={onCancel}>Cancel</button>
        <button className="creator-modal-secondary" type="button" onClick={onLeave}>Leave without publishing</button>
        <button className="creator-modal-primary" type="button" onClick={onPublishAndLeave}>Publish and leave</button>
      </div>
    </div>
  </div>;
}
