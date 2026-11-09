import Link from "next/link";

import { SUPPORT_EMAIL } from "../siteInfo";

type SupportErrorMessageProps = {
  className?: string;
  id?: string;
  role?: "alert" | "status";
};

export default function SupportErrorMessage({ className, id, role = "alert" }: SupportErrorMessageProps) {
  return (
    <p className={className} id={id} role={role}>
      Something went wrong.
      <br />
      If the problem continues, please visit our <Link href="/contact">Contact page</Link> or email{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
    </p>
  );
}
