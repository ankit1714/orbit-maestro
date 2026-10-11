import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/roleContext";

export const metadata: Metadata = {
  title: "AI Scrum Master — Executive Delivery Cockpit",
  description: "Enterprise multi-agent autonomous Scrum Master supporting Standalone Mode, Jira & Confluence Sync, and Google NotebookLM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-950 text-zinc-100 antialiased min-h-screen flex flex-col selection:bg-brand-500/30 selection:text-brand-400">
        <RoleProvider>
          {children}
        </RoleProvider>
      </body>
    </html>
  );
}
