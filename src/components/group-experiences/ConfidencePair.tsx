import AggregateValue from "./AggregateValue";
export default function ConfidencePair({ group, follower, activeTotal, groupCard = false, pending = false }: { group: number | null; follower: number | null; activeTotal: number; groupCard?: boolean; pending?: boolean }) {
  // Group Card headers keep both slots. Other consumers retain their previous
  // conditional F and typography. Invisible dash ink retains its exact advance;
  // the quiet mark is paint only, never a new fixed-width confidence layout.
  return <span className="group-confidence-pair" data-group-card={groupCard ? "" : undefined}>
    <span className={groupCard && group === null ? "group-confidence-missing" : undefined} aria-label={group === null ? "Group confidence not set" : `Group confidence ${group} out of 10`}>{group ?? "—"}<sup aria-hidden="true">G</sup></span>
    {groupCard || activeTotal > 0 ? <span className={groupCard && follower === null && !pending ? "group-confidence-missing" : undefined} aria-label={pending ? "Updating follower confidence" : follower === null ? "Follower confidence not set" : `Follower confidence ${follower} out of 10`}><AggregateValue pending={pending}>{follower ?? "—"}</AggregateValue><sup aria-hidden="true">F</sup></span> : null}
  </span>;
}
