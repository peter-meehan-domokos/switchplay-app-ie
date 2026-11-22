import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "react-phone-number-input/style.css";
import "./globals.css";
import OnboardingHost from "@/components/onboarding/OnboardingHost";

// ======================================================================================================================================
// ROOT FALLBACK METADATA for the whole app - the LOWEST priority. It only shows on routes that have no site layout or page metadata of
// their own (for example /login, /library, /step-visuals).
//
// !! This does NOT control puckleup.com. Puckle overrides it twice:
// !!   - src/app/sites/puckle/layout.tsx  (Puckle default for its subpages)
// !!   - src/app/sites/puckle/page.tsx    (the Puckle homepage "/", the one visitors and Google see first)
// !! Switchplay and Strat17 likewise override it in their own src/app/sites/<site>/layout.tsx and page.tsx.
// To change Puckle's title/description, edit those two Puckle files, not this one.
//
// (The wording below is currently Puckle's, so any route that falls back to it will present itself as Puckle.)
// ======================================================================================================================================
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
