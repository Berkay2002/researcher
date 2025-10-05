import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/tailwind.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Research Assistant - AI-Powered Research with Citations",
  description:
    "Transform broad questions into grounded, cited reports. Multi-agent research system with human-in-the-loop planning powered by LangGraph and AI.",
  keywords: [
    "research",
    "AI assistant",
    "citations",
    "LangGraph",
    "multi-agent",
    "fact-checking",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
