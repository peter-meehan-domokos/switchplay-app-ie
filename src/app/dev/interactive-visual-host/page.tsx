import { notFound } from "next/navigation";

export default async function InteractiveVisualHostReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { default: HostReview } = await import("./HostReview");
  return <HostReview />;
}
