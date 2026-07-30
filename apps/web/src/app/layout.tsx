import type { Metadata } from "next";
import "./globals.css";
import { GoogleOAuthProviderWrapper } from "@/components/providers/GoogleOAuthProviderWrapper";
import { isPublicOpenSpaceSite } from "@/lib/open-space-url";

const isOpenSpace = isPublicOpenSpaceSite();

const openSpaceDescription =
  "Community workflows for Operate AI. Browse shared graphs, open a private copy in your local editor, or star pieces to reuse.";

export const metadata: Metadata = isOpenSpace
  ? {
      title: {
        default: "Open Space",
        template: "%s - Open Space",
      },
      description: openSpaceDescription,
      openGraph: {
        title: "Open Space",
        description: openSpaceDescription,
        type: "website",
        siteName: "Open Space",
      },
      twitter: {
        card: "summary",
        title: "Open Space",
        description: openSpaceDescription,
      },
    }
  : {
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
    <html lang={isOpenSpace ? "en" : "ko"}>
      <body>
        <GoogleOAuthProviderWrapper>{children}</GoogleOAuthProviderWrapper>
      </body>
    </html>
  );
}
