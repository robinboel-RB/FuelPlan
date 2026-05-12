import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuelPlan MVP",
  description: "Minimal athlete input MVP with five active parameters"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
