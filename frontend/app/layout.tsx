import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AppNav } from "@/shared/components/navigation/AppNav";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Suricata IPS Monitor",
  description: "Dashboard en tiempo real para eventos Suricata",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full lg:flex">
        <AuthProvider>
          <AppNav />
          <div className="min-w-0 flex-1">{children}</div>
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "border border-soc-outline/80 bg-soc-lowest text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
                description: "text-soc-muted",
                success: "border-soc-success/35",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
