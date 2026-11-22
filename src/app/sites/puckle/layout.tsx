import type { Metadata } from "next";
import { SITE_TITLE_NAME } from "./siteInfo";

export const metadata: Metadata = {
  title: {
    default: "Puckle — Unpickle your maths.",
    template: "%s | Puckle",
  },
  description: "Your maths progress, your way. Puckle's student-centred platform combines expert online tuition, video explanations, hands-on visuals and examples from real-life activities such as sport and business.",
};

export default function PuckleSiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
