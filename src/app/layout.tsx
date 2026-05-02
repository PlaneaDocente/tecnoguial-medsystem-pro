import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import GlobalClientEffects from "@/components/GlobalClientEffects";
import PWARegister from "@/components/PWARegister";
import { AuthProvider } from "@/hooks/useAuth";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TecnoGuiAl MedSystem Pro",
    template: "%s | MedSystem Pro",
  },
  description: "Sistema profesional de gestión médica para doctores, psicólogos y clínicas",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png", sizes: "512x512" },
    ],
    shortcut: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MedSystem",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
        media: "(device-width: 768px) and (device-height: 1024px)",
      },
    ],
  },
  applicationName: "MedSystem",
  authors: [{ name: "TecnoGuiAl" }],
  creator: "TecnoGuiAl MedSystem",
  metadataBase: new URL("https://tecnoguial-medsystem-pro.vercel.app"),
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://tecnoguial-medsystem-pro.vercel.app",
    siteName: "TecnoGuiAl MedSystem Pro",
    title: "TecnoGuiAl MedSystem Pro",
    description: "Sistema profesional de gestión médica para doctores, psicólogos y clínicas",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "TecnoGuiAl MedSystem Pro",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0066CC" },
    { media: "(prefers-color-scheme: dark)", color: "#0A2540" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <meta name="application-name" content="MedSystem" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MedSystem" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0066CC" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <meta name="msapplication-config" content="none" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="mask-icon" href="/icons/icon-192x192.png" color="#0066CC" />
      </head>
      <body className="antialiased font-sans">
        <AuthProvider>
          <Toaster position="top-right" richColors closeButton />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            {children}
            <GlobalClientEffects />
          </ThemeProvider>
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}