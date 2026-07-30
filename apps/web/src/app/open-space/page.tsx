"use client";

import { useEffect } from "react";

import {
  getPublicOpenSpaceHref,
  isLocalEditorHost,
} from "@/lib/open-space-url";
import CommunityPage from "../community/page";

/** Local editor: bounce to the public Open Space home. Public host: gallery. */
export default function OpenSpaceAliasPage() {
  const publicHref = getPublicOpenSpaceHref("/");
  const bounce = Boolean(publicHref && isLocalEditorHost());

  useEffect(() => {
    if (bounce && publicHref) {
      window.location.replace(publicHref);
    }
  }, [bounce, publicHref]);

  if (bounce) {
    return (
      <p className="p-8 text-center text-sm text-muted">
        Opening public Open Space…
      </p>
    );
  }

  return <CommunityPage />;
}
