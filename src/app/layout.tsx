import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
