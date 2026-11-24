// The bucket's own list of what it holds: _meta/uploaded.json, key → "<git blob hash>:<size>" (older lists: md5).
// Read over the public address (no login needed), so builds anywhere — GitHub Actions included — can use it.
import { ASSET_BASE } from "./config.mjs";

export const REMOTE_LIST = "_meta/uploaded.json";

/** the list, or null when it can't be read (offline, not there yet) */
export async function readRemoteList() {
  try {
    const r = await fetch(`${ASSET_BASE}/${REMOTE_LIST}?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch { /* offline or not there yet */ }
  return null;
}
