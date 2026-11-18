"use client";
// A renamed game's old page link (an open tab, a bookmark) moves to its new slug instead of showing the 404 page.
// Lives in the 404 page, so it costs no site files.
import { useEffect } from "react";
import { SLUG_ALIASES } from "@/lib/games";

export function RenamedGameRedirect() {
  useEffect(() => {
    const m = window.location.pathname.match(/^\/games\/([^/]+)\/?$/);
    const to = m ? SLUG_ALIASES[decodeURIComponent(m[1])] : undefined;
    if (to) window.location.replace(`/games/${to}${window.location.search}`);
  }, []);
  return null;
}
