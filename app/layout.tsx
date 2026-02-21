import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToasterProvider } from "@/components/providers/toaster-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "BFEAI Dashboard",
    template: "%s | BFEAI Dashboard",
  },
  description: "Your BFEAI hub — account, billing, credits, and apps",
  icons: {
    icon: [
      { url: '/brand/BFE_Icon_TRN.png', type: 'image/png' },
    ],
    apple: '/brand/BFE_Icon_TRN.png',
  },
  openGraph: {
    title: 'BFEAI Dashboard',
    description: 'Your BFEAI hub — account, billing, credits, and apps',
    images: ['/brand/BFE_Logo_TRN_BG.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
          </QueryProvider>
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
