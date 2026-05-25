import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SubscriptionProvider } from "@/components/subscription/SubscriptionContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spear — AI Sales Intelligence",
  description:
    "Spear analyzes every sales call. Scores NEPQ execution. Profiles buyers. Detects objections. Delivers coaching reports. Automatically.",
  icons: {
    icon: "/spear-logo.PNG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-space), system-ui, sans-serif" }}>
        <SubscriptionProvider>{children}</SubscriptionProvider>
      </body>
    </html>
  );
}
