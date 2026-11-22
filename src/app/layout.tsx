import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "react-phone-number-input/style.css";
import "./globals.css";
import OnboardingHost from "@/components/onboarding/OnboardingHost";

export const metadata: Metadata = {
  title: {
    default: "Puckle — Unpickle your maths.",
    template: "%s | Puckle",
  },
  description: "Your maths progress, your way. Puckle's student-centred platform combines expert online tuition, video explanations, hands-on visuals and examples from real-life activities such as sport and business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <OnboardingHost />
        <Analytics />
      </body>
    </html>
  );
}
