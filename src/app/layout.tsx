import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "react-phone-number-input/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Puckle — People like you. Showing you how.",
    template: "%s | Puckle",
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
        <Analytics />
      </body>
    </html>
  );
}
