// Layout pipeline for the "Beyond the Maths" homepage section. Pure and deterministic: the component renders exactly what
// this returns and never patches it. Copy is approved wording; artwork files are the two approved transparent PNGs.

export type ProjectTone = "yard" | "clubs";

export type ProjectPreviewLayout = {
  id: string;
  tone: ProjectTone;
  title: string;
  label: string;
  description: string;
  /** Optional wording for 900px and wider; below that, `description` is shown. */
  wideDescription?: string;
  art: { src: string; width: number; height: number; alt: string };
};

export type BeyondTheMathsLayout = {
  headingId: string;
  eyebrow: string;
  heading: string;
  projects: readonly ProjectPreviewLayout[];
  invitation: { prompt: string; linkLabel: string; href: string };
};

const projects: readonly ProjectPreviewLayout[] = [
  {
    id: "yard",
    tone: "yard",
    title: "Puckle Yard",
    label: "COMING SOON",
    description: "An experimental space where anyone can create and share projects for others to follow.",
    art: {
      src: "/images/sites/puckle/yard-artwork.png",
      width: 1536,
      height: 1024,
      alt: "Three glowing Puckle project cards: a person doing a pull-up at sunset, a chalk sketch of a cone, and a violinist playing",
    },
  },
  {
    id: "clubs",
    tone: "clubs",
    title: "Puckle Clubs",
    label: "COMING SOON",
    description: "Structured player development tailored to age and need, built on shared coaching knowledge.",
    wideDescription: "Player development tailored to age and need, built on shared coaching knowledge.",
    art: {
      src: "/images/sites/puckle/clubs-artwork.png",
      width: 1448,
      height: 1086,
      alt: "A stack of Puckle Clubs cards, the top one a basketball card titled My Defensive Development Plan",
    },
  },
];

export function buildBeyondTheMathsLayout(): BeyondTheMathsLayout {
  return {
    headingId: "beyond-title",
    eyebrow: "BEYOND THE MATHS",
    heading: "There’s more to Puckle.",
    projects,
    invitation: { prompt: "Want to know more or be involved?", linkLabel: "Get in touch.", href: "/contact" },
  };
}
