import { notFound } from "next/navigation";
import FontReview from "./FontReview";

export const metadata = { title: "Maths Renderer · Open-font comparison" };

export default function MathsFontReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FontReview />;
}
