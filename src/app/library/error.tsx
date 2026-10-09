"use client";
export default function LibraryError({ reset }: { reset: () => void }) {
  return <main className="app-shell"><p role="alert">Library could not be loaded. Please retry.</p><button type="button" onClick={reset}>Retry</button></main>;
}
