import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrgOS",
  description: "OrgOS role intelligence for redesigning teams in the AI era.",
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
