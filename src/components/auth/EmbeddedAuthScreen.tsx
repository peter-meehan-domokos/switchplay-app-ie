import SwitchplayBrandLink from "@/components/brand/SwitchplayBrandLink";
import AuthScreen from "./AuthScreen";
import styles from "./EmbeddedAuthScreen.module.css";

export default function EmbeddedAuthScreen() {
  return (
    <div className={styles.embeddedAuthScreen}>
      <div className={styles.brandRow}>
        <SwitchplayBrandLink />
      </div>
      <div className={styles.authArea}>
        <AuthScreen />
      </div>
    </div>
  );
}
