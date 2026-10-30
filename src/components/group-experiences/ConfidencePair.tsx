export default function ConfidencePair({ group, follower, activeTotal }: { group: number | null; follower: number | null; activeTotal: number }) {
  return <span className="group-confidence-pair">
    <span aria-label={group === null ? "Group confidence not set" : `Group confidence ${group} out of 10`}>{group ?? "—"}<sup aria-hidden="true">G</sup></span>
    {activeTotal > 0 ? <span aria-label={follower === null ? "Follower confidence not set" : `Follower confidence ${follower} out of 10`}>{follower ?? "—"}<sup aria-hidden="true">F</sup></span> : null}
  </span>;
}
