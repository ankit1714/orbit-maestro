import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/roleContext";

export const metadata: Metadata = {
  title: "Orbit Maestro AI — Your Intelligent Scrum Partner",
  description: "Enterprise multi-agent autonomous Scrum Master with Jira & Confluence Sync and Google NotebookLM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#f8f9fa] text-[#202124] antialiased min-h-screen flex flex-col selection:bg-brand-100 selection:text-brand-800">
        <RoleProvider>
          {children}
        </RoleProvider>
      </body>
    </html>
  );
}
