// Teacher profile content for the Personal Support section and its "Read more" dialog. Pure data, returned by one builder, so the
// biography can be edited here without touching markup. The wording is placeholder text supplied by the teacher; qualifications are
// shown exactly as written and are not independently verified.

export type TeacherProfileLayout = {
  name: string;
  qualifications: string;
  experience: readonly [string, string];
  readMoreLabel: string;
  dialog: {
    eyebrow: string;
    subtitle: string;
    closeLabel: string;
    sections: readonly { id: string; heading: string; body: string }[];
  };
};

export function buildTeacherProfileLayout(): TeacherProfileLayout {
  return {
    name: "Peter Meehan-Domokos",
    qualifications: "PGCE · MSc · Qualified Teacher Status",
    experience: ["15+ years teaching secondary maths", "Thousands of students taught"],
    readMoreLabel: "Read more",
    dialog: {
      eyebrow: "TEACHER PROFILE",
      subtitle: "Qualified secondary mathematics teacher",
      closeLabel: "Close teacher profile",
      sections: [
        { id: "qualifications", heading: "Qualifications", body: "PGCE · MSc · Qualified Teacher Status (QTS)" },
        {
          id: "experience",
          heading: "Teaching experience",
          body: "Over 15 years teaching secondary mathematics, with experience helping students develop conceptual understanding and confidence in their mathematical ability.",
        },
        {
          id: "approach",
          heading: "My approach",
          body: "I believe students learn mathematics best when they understand why something works, not simply memorise methods. I use clear explanations, practical examples and opportunities to explore ideas for themselves.",
        },
        {
          id: "references",
          heading: "Qualifications and references",
          body: "Evidence of teaching qualifications and professional references is available on request.",
        },
      ],
    },
  };
}
