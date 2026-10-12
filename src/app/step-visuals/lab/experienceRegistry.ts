export type ExperienceId = "card-1-interactive" | "card-1-sparklines";

export type LabExperience = Readonly<{
  id: ExperienceId;
  label: string;
}>;

export type LabCard = Readonly<{
  id: string;
  label: string;
  experiences: readonly LabExperience[];
}>;

export const labCards: readonly LabCard[] = [
  {
    id: "card-1",
    label: "Card 1 — Roots and Factors",
    experiences: [
      { id: "card-1-interactive", label: "Interactive visualisation" },
      { id: "card-1-sparklines", label: "Sparkline preview" },
    ],
  },
];

export const initialExperienceId: ExperienceId = "card-1-interactive";

export const findExperience = (id: ExperienceId | null) =>
  labCards.flatMap((card) => card.experiences).find((experience) => experience.id === id);
