import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "SocialAuto — AI Marketing for E-Commerce",
  description:
    "Automate social media posts for your Shopify store with AI-generated images and captions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
