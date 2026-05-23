import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuelPlan Live Coach",
  description: "Live fueling coaching with phone and smartwatch notifications",
  applicationName: "FuelPlan Live Coach",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/fuelplan-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/fuelplan-icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/icons/fuelplan-icon-192.png"
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
