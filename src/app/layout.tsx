import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Plan agentique",
  description: "Local planning for development agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
