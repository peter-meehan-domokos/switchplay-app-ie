// Two spellings of the brand name. Changing them does NOT change the page titles or descriptions Google and browsers show:
//   - Page title / description wording is typed directly in src/app/sites/puckle/page.tsx (homepage) and
//     src/app/sites/puckle/layout.tsx (other pages). See the comments at the top of those files for which one wins.
//   - SITE_NAME ("Puckle", normal case) is used in running text and in the homepage's Open Graph `og:site_name` (link previews).
//   - SITE_TITLE_NAME ("PUCKLE", all caps) is used only for the on-page brand link's accessible label ("PUCKLE home").
export const SITE_NAME = "Puckle";
export const SITE_TITLE_NAME = "PUCKLE";
/** General contact address (contact page, privacy questions, unsubscribing). */
export const CONTACT_EMAIL = "hello@puckleup.com";
/** Help address shown when something goes wrong. */
export const SUPPORT_EMAIL = "support@puckleup.com";
/** Puckle's only public WhatsApp Business account (Irish number), used for customers in both countries. */
export const WHATSAPP_URL = "https://wa.me/353852076241";
/** Call and text lines. The UK number has a personal WhatsApp account that is deliberately not published. */
export const PHONE_LINES = [
  { country: "Ireland", display: "+353 85 207 6241", e164: "+353852076241" },
  { country: "UK", display: "+44 7547 196642", e164: "+447547196642" },
] as const;

/**
 * THE LINK-PREVIEW IMAGE for every Puckle page (the picture WhatsApp, Facebook, LinkedIn, iMessage and X show when the site is shared).
 * Edit it HERE, once. It is used by src/app/sites/puckle/layout.tsx (all pages) and src/app/sites/puckle/page.tsx (the homepage, which
 * must repeat it because a page's own openGraph/twitter blocks replace the layout's rather than adding to them).
 * 1200x630, made from the hero artwork. The file lives in public/. Social platforms cache previews hard, so when you change the picture
 * save it under a NEW filename (-v2, -v3...) and update `url`. The relative url becomes https://puckleup.com/... via `metadataBase`
 * in layout.tsx.
 */
export const SHARE_IMAGE = {
  url: "/images/sites/puckle/puckle-og-hero-v4.jpg",
  width: 1200,
  height: 630,
  alt: "Three Puckle Cards showing a maths lesson on integration, with a video, an interactive graph, and Learn, Explore and Test yourself steps",
};
