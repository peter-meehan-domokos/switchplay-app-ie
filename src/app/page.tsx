import PublicLayout from "@/components/public-site/PublicLayout";
import styles from "./HomePage.module.css";

export default function Home() {
  return (
    <PublicLayout>
      <div className={styles.intro}>
        <h1 className={styles.title}>Switchplay</h1>
        <p className={styles.placeholder}>Temporary homepage</p>
      </div>
    </PublicLayout>
  );
}
