// Google Analytics 4 through the Google tag (GTM-style container id; the GA4 Measurement ID lives inside it).
// Consent Mode v2: in the EEA, UK and Switzerland nothing is stored until the visitor says yes in the consent
// banner; elsewhere analytics runs by default and can be switched off in Privacy → Cookie settings.
// The game frame on a game page (/play?…&embed=1) loads no tag of its own: its events go to the page's tag,
// so a game page view isn't counted twice.

export const GTAG_ID = process.env.NEXT_PUBLIC_GTAG_ID ?? "GTM-WTMRHQQH";
/** only the real site sends data (not `next dev`) */
export const ANALYTICS_ON = process.env.NODE_ENV === "production" && GTAG_ID !== "";

export const CONSENT_KEY = "momoblobs:consent";
export type Consent = "granted" | "denied";

/** EU/EEA countries + UK + Switzerland: consent required before analytics or ad storage */
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
];

/** inline <head> script: consent defaults + the saved choice, then the Google tag */
export const ANALYTICS_HEAD_JS = `(function(){
window.dataLayer=window.dataLayer||[];
if(/[?&]embed=1(&|$)/.test(location.search)&&window.parent!==window){
window.gtag=function(){try{window.parent.gtag&&window.parent.gtag.apply(window.parent,arguments)}catch(e){}};return}
function gtag(){window.dataLayer.push(arguments)}window.gtag=gtag;
var all=function(v){return{ad_storage:v,ad_user_data:v,ad_personalization:v,analytics_storage:v}};
var d=all("denied");d.region=${JSON.stringify(CONSENT_REGIONS)};d.wait_for_update=500;
gtag("consent","default",d);
gtag("consent","default",all("granted"));
var c=null;try{c=localStorage.getItem(${JSON.stringify(CONSENT_KEY)})}catch(e){}
if(c==="granted"||c==="denied")gtag("consent","update",all(c));
gtag("js",new Date());
var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtm.js?id=${GTAG_ID}";
document.head.appendChild(s)})();`;

type Gtag = (...args: unknown[]) => void;
const gtag = (): Gtag | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { gtag?: Gtag }).gtag);

/** send a GA4 event (no-op in dev or before the tag is set up) */
export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  gtag()?.("event", name, params);
}

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch { return null; }
}

export function saveConsent(v: Consent) {
  try { localStorage.setItem(CONSENT_KEY, v); } catch { /* private mode: applies to this visit only */ }
  gtag()?.("consent", "update", { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
  window.dispatchEvent(new Event("momoblobs:consent"));
}

/** visitors whose clock is set to a European time zone see the banner (no server to look up the country) */
export function needsConsentBanner(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    return tz.startsWith("Europe/") || ["Atlantic/Canary", "Atlantic/Madeira", "Atlantic/Azores", "Atlantic/Reykjavik", "Atlantic/Faroe"].includes(tz);
  } catch { return false; }
}

/** opens the cookie banner again (Privacy → Cookie settings) */
export const OPEN_CONSENT_EVENT = "momoblobs:open-consent";
