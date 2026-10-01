import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { AppearanceProvider } from "@/components/theme/appearance-provider";
import { Toaster } from "@/components/ui/sonner";
import {
  APPEARANCE_COOKIE_NAME,
  APPEARANCE_INLINE_SCRIPT,
  parseAppearance,
} from "@/lib/appearance";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Memex",
    template: "%s · Memex",
  },
  description:
    "A keyboard-first developer knowledge hub for snippets, prompts, commands, notes, links, and files.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appUrl,
    siteName: "Memex",
    title: "Memex",
    description:
      "A keyboard-first developer knowledge hub for snippets, prompts, commands, notes, links, and files.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memex",
    description:
      "A keyboard-first developer knowledge hub for snippets, prompts, commands, notes, links, and files.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const appearance = parseAppearance(
    cookieStore.get(APPEARANCE_COOKIE_NAME)?.value,
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-svh antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: APPEARANCE_INLINE_SCRIPT }}
        />
      </head>
      <body className="relative flex min-h-svh flex-col">
        <AppearanceProvider initialAppearance={appearance}>
          <SkipToContent />
          {children}
          <Toaster />
        </AppearanceProvider>
      </body>
    </html>
  );
}
