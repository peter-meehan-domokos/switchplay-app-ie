/** Join page wording shown only in pre-launch mode, above the existing student and teacher forms. */
export type JoinPrelaunchNotice = Readonly<{ heading: string; text: string; tuition: Readonly<{ lead: string; text: string }> | null }>;
export function joinPrelaunchNotice(choice: string): JoinPrelaunchNotice | null {
  if (choice === "student") return {
    heading: "Join Puckle now",
    text: "New maths content starts arriving in early December. Sign up today to be among the first to use it.",
    tuition: { lead: "Want to get started now?", text: "Maths lessons with Puckle are already available, using our interactive learning platform." },
  };
  if (choice === "teacher") return {
    heading: "Join Puckle as a teacher",
    text: "New maths content starts arriving in early December. Join now to get early access and help shape how Puckle supports maths teaching and learning.",
    tuition: null,
  };
  return null;
}
