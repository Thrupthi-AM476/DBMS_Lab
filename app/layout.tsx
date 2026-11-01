import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Help Desk Board — PES1UG24AM476",
  description: "Post and view campus help requests",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
