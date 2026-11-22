import type { Metadata } from "next";
import { SHARE_IMAGE } from "./siteInfo";

// ======================================================================================================================================
// PUCKLE SITE-WIDE DEFAULT METADATA - used by Puckle pages that do NOT set their own title/description (it is the fallback, not the winner).
//
// !! THE HOMEPAGE ("/") IS NOT CONTROLLED HERE. src/app/sites/puckle/page.tsx sets its own title, description, Open Graph and Twitter
// !! metadata, which OVERRIDES this file. To change what puckleup.com shows on the homepage, edit src/app/sites/puckle/page.tsx.
//
// Priority, lowest to highest:  src/app/layout.tsx (root fallback)  <  THIS FILE  <  each page's own `metadata` (e.g. page.tsx).
//
// What this file does control:
//   - `title.template`: the "%s | Puckle" suffix added to subpage titles, e.g. "Privacy Policy | Puckle", "Contact and support | Puckle".
//     (Subpages such as contact, privacy and join set only their own short title and rely on this template.)
//   - `title.default` and `description`: used only by a Puckle page with no title/description of its own.
//   - `openGraph` / `twitter` (link-preview picture): used by every Puckle page except the homepage, which sets its own in page.tsx.
// If you change the wording here, also update the homepage in page.tsx so they stay consistent.
// ======================================================================================================================================
export const metadata: Metadata = {
  // Base address that turns relative URLs in Puckle metadata (such as the homepage link-preview image in page.tsx) into full
  // https://puckleup.com/... addresses, which social platforms require. Change it only if the live domain changes.
  metadataBase: new URL("https://puckleup.com"),
  title: {
    default: "Puckle — Unpickle your maths.",
    template: "%s | Puckle",
  },
  // Link-preview picture for EVERY Puckle page that does not set its own openGraph/twitter (contact, privacy, join...). The homepage sets
  // its own in page.tsx, which replaces these rather than adding to them, so it repeats the same image. The image itself is defined once,
  // in ./siteInfo.ts (SHARE_IMAGE): change it there.
  openGraph: { images: [SHARE_IMAGE], siteName: "Puckle", type: "website" },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE.url] },
  description: "Your maths progress, your way. Puckle's student-centred platform combines expert online tuition, video explanations, hands-on visuals and examples from real-life activities such as sport and business.",
};

export default function PuckleSiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
