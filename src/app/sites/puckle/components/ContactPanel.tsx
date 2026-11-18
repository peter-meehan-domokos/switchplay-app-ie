import { buildContactPanelLayout } from "../lib/contactPanelLayout";
import buttonStyles from "./PublicButton.module.css";
import styles from "./ContactPanel.module.css";

/** Compact contact details above the contact form. Renders the layout only. */
export default function ContactPanel() {
  const layout = buildContactPanelLayout();
  return (
    <div className={styles.panel}>
      {layout.groups.map((group) => (
        <section aria-labelledby={group.id} className={styles.group} key={group.id}>
          <h2 id={group.id}>{group.title}</h2>
          <p>{group.text}</p>
          <a className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.whatsapp}`} href={group.whatsapp.href}>{group.whatsapp.label}</a>
          <a className={styles.link} href={group.email.href}>{group.email.address}</a>
        </section>
      ))}
      <section aria-labelledby={layout.phone.id} className={styles.group}>
        <h2 id={layout.phone.id}>{layout.phone.title}</h2>
        <p>{layout.phone.text}</p>
        <ul className={styles.lines}>
          {layout.phone.rows.map((row) => (
            <li className={styles.line} key={row.country}>
              <span className={styles.country}>{row.country}</span>
              <a className={styles.link} href={row.callHref}>{row.display}</a>
              <span className={styles.actions}>
                <a aria-label={row.callLabel} className={styles.action} href={row.callHref}>Call</a>
                <a aria-label={row.textLabel} className={styles.action} href={row.textHref}>Text</a>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
