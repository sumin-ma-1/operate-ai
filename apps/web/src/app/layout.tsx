import type { Metadata } from "next";
import "./globals.css";
import { GoogleOAuthProviderWrapper } from "@/components/providers/GoogleOAuthProviderWrapper";

export const metadata: Metadata = {
  title: "Operate AI",
  description: "AI Agent and LLM workflow visual editor",
  icons: {
    icon: "/retro_spaceship_thruster.gif",
    shortcut: "/retro_spaceship_thruster.gif",
    apple: "/retro_spaceship_thruster.gif",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <GoogleOAuthProviderWrapper>{children}</GoogleOAuthProviderWrapper>
      </body>
    </html>
  );
}
