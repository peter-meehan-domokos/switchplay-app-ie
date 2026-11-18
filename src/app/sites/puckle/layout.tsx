import type { Metadata } from "next";
import { SITE_TITLE_NAME } from "./siteInfo";

export const metadata: Metadata = {
  title: {
    default: `${SITE_TITLE_NAME} — The unofficial way to get there.`,
    template: `%s | ${SITE_TITLE_NAME}`,
  },
  description: "A clear path, not just another video. Follow the steps of someone who's done it.",
};

export default function PuckleSiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
