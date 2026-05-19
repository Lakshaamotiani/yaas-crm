import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "YAAS Sales CRM",
  description: "YAAS Sales CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <StoreProvider>
              <TooltipProvider delayDuration={200}>
                {children}
                <Toaster />
              </TooltipProvider>
            </StoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
