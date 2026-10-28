import Link from "next/link";
import styles from "./LibraryTabs.module.css";

export default function LibraryTabs({ active }: { active: "decks" | "info-cards" }) {
  return <nav aria-label="Library sections" className={styles.tabs}>
    <Link href="/library" aria-current={active === "decks" ? "page" : undefined}>Decks</Link>
    <Link href="/library?tab=info-cards" aria-current={active === "info-cards" ? "page" : undefined}>Info Cards</Link>
  </nav>;
}
