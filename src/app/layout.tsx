import type { Metadata } from "next";
import { Oxanium, Merriweather, Fira_Code } from "next/font/google";
import "../styles/tailwind.css";

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  display: "swap",
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
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
        className={`${oxanium.variable} ${merriweather.variable} ${firaCode.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
