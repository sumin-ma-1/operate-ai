import type { Metadata } from "next";
import "./globals.css";
import { GoogleOAuthProviderWrapper } from "@/components/providers/GoogleOAuthProviderWrapper";

export const metadata: Metadata = {
  title: {
    default: "Operate AI",
    template: "%s - Operate AI",
  },
  description: "AI Agent and LLM workflow visual editor",
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
