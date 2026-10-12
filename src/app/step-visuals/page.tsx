import type { Metadata } from "next";
import StepVisualsLab from "./lab/StepVisualsLab";

export const metadata: Metadata = {
  title: "Step visuals lab",
  robots: { index: false, follow: false },
};

export default function StepVisualsPage() {
  return <StepVisualsLab />;
}
