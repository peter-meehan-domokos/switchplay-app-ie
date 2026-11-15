import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "react-phone-number-input/style.css";
import "./globals.css";
import OnboardingHost from "@/components/onboarding/OnboardingHost";

export const metadata: Metadata = {
  title: {
    default: "SWITCHPLAY — The unofficial way to get there.",
    template: "%s | SWITCHPLAY",
  },
  description: "A clear path, not just another video. Follow the steps of someone who's done it.",
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
