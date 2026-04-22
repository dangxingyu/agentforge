import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentForge — Visual LLM Pipeline Designer",
  description:
    "Design, visualize, and edit LLM agent pipelines with a drag-and-drop canvas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden bg-white text-[#181d26]">
        {children}
      </body>
    </html>
  );
}
