import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Space",
  description: "Browse and share Operate AI community workflows",
};

export default function CommunityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
