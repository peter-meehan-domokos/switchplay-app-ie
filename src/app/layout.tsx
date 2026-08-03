import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "react-phone-number-input/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Switchplay — Learn from people like you",
    template: "%s | Switchplay",
  },
  description: "Follow real paths from people who have been where you are and have achieved what you want to achieve.",
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
