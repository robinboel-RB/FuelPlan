import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuelPlan Live Coach",
  description: "Live fueling coaching with phone and smartwatch notifications",
  applicationName: "FuelPlan Live Coach",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/fuelplan-icon.svg",
    apple: "/icons/fuelplan-icon.svg"
  },
  appleWebApp: {
    capable: true,
    title: "FuelPlan",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a"
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
