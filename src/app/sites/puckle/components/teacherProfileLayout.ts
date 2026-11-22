// Teacher profile content for the Personal Support section and its "Read more" dialog. Pure data, returned by one builder, so the
// biography can be edited here without touching markup. The dialog wording is the teacher's finalised text and must not be altered;
// qualifications and testimonials are shown exactly as supplied and are not independently verified.

/** A run of text inside a paragraph; `strong` runs are rendered bold. */
export type ProfileRun = { text: string; strong?: boolean };

export type ProfileBlock =
  | { kind: "paragraph"; id: string; runs: readonly ProfileRun[] }
  | { kind: "quote"; id: string; text: string; name: string; role: string }
  | { kind: "note"; id: string; text: string };

export type TeacherProfileLayout = {
  name: string;
  qualifications: string;
  experience: readonly string[];
  readMoreLabel: string;
  dialog: {
    eyebrow: string;
    /** The two primary credentials; shown on one line with a dot when wide, stacked without it when narrow. */
    headline: readonly [string, string];
    /** The four qualifications, each an unbreakable unit; the component decides where lines and dots fall. */
    credentials: readonly [string, string, string, string];
    closeLabel: string;
    blocks: readonly ProfileBlock[];
  };
};

export function buildTeacherProfileLayout(): TeacherProfileLayout {
  return {
    name: "Peter Meehan-Domokos",
    qualifications: "PGCE · MSc · Qualified Teacher Status",
    experience: ["15+ years teaching secondary maths"],
    readMoreLabel: "Read more",
    dialog: {
      eyebrow: "TEACHER PROFILE",
      headline: ["Qualified secondary maths teacher", "15+ years’ experience"],
      credentials: ["BSc Mathematics", "MSc Learning Technologies", "PGCE Secondary Mathematics", "Qualified Teacher Status (QTS)"],
      closeLabel: "Close teacher profile",
      blocks: [
        {
          kind: "paragraph",
          id: "understanding",
          runs: [{ text: "I help students move from memorising rules to understanding why they work, building the confidence to think mathematically about problems." }],
        },
        { kind: "paragraph", id: "relevance", runs: [{ text: "I also make maths relevant through real-world connections that students care about." }] },
        {
          kind: "paragraph",
          id: "switchplay",
          runs: [
            { text: "One example is " },
            { text: "Switchplay", strong: true },
            { text: ", which I founded and delivered in secondary schools and football academies. Students' progress in maths was transformed as they learnt how to use data science to improve their performance in sport." },
          ],
        },
        {
          kind: "quote",
          id: "verga",
          text: "“Peter is an outstanding teacher … He has helped to significantly raise standards in Mathematics within the Academy … through his project, Switchplay.”",
          name: "Clare Verga",
          role: "Principal, City of London Academy Islington",
        },
        { kind: "paragraph", id: "galway", runs: [{ text: "In Galway, I ran a data science workshop for Transition Year students." }] },
        {
          kind: "quote",
          id: "comer",
          text: "“He has an ability to translate complex concepts into an accessible and memorable learning experience.”",
          name: "Yvonne Comer",
          role: "Senior Innovation Catalyst, PorterShed, Galway",
        },
        {
          kind: "paragraph",
          id: "curricula",
          runs: [{ text: "With a strong understanding of both Irish and UK maths curricula, I help students strengthen their foundations and confidence, while stretching those ready for the most challenging exam questions." }],
        },
        { kind: "note", id: "references", text: "Teaching qualifications and professional references are available on request." },
      ],
    },
  };
}
