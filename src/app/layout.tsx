import type { Metadata } from "next";
import "../styles/tailwind.css";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Chat",
  description: "Agent Chat UX by LangChain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <NuqsAdapter>{children}</NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
