// Keep the previous numeral advance and baseline while painting pending ink.
export default function AggregateValue({ pending, children }: { pending?: boolean; children: import("react").ReactNode }) {
  return pending ? <span className="group-aggregate-pending" role="status" aria-label="Updating Group results"><span aria-hidden="true">{children}</span><span aria-hidden="true">…</span></span> : <>{children}</>;
}
