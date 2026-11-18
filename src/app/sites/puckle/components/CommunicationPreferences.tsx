"use client";

import type { Answer } from "../lib/communicationPreferences";
import type { ChannelsView, PreferenceField, PreferenceRowView, PreferencesLayout } from "../lib/communicationPreferencesLayout";
import styles from "./CommunicationPreferences.module.css";

type Props = Readonly<{
  idPrefix: string; layout: PreferencesLayout;
  onAnswer: (field: PreferenceField, value: Answer) => void;
  onChannel: (channel: "email" | "sms", checked: boolean) => void;
}>;

/** Compact Yes | No rows plus the conditional delivery box. Renders the layout only; nothing is preselected. */
export default function CommunicationPreferences({ idPrefix, layout, onAnswer, onChannel }: Props) {
  const renderRow = (row: PreferenceRowView) => {
    const base = `${idPrefix}-${row.field}`;
    return (
      <div className={styles.row} key={row.field}>
        <div className={styles.head}>
          <span className={styles.title} id={`${base}-title`}>{row.title}</span>
          <div aria-labelledby={`${base}-title`} aria-describedby={`${base}-text${row.error ? ` ${base}-error` : ""}`} className={styles.segmented} role="radiogroup">
            {(["yes", "no"] as const).map(value => (
              <label className={styles.option} key={value}>
                {/* The shared focus-first-invalid behaviour looks for aria-invalid, and the error is announced through the group description. */}
                {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
                <input aria-invalid={row.error ? "true" : "false"} checked={row.value === value} name={base} onChange={() => onAnswer(row.field, value)} type="radio" value={value} />
                <span>{value === "yes" ? "Yes" : "No"}</span>
              </label>
            ))}
          </div>
        </div>
        <p className={styles.text} id={`${base}-text`}>{row.text}</p>
        {row.error ? <p className={styles.error} id={`${base}-error`}>{row.error}</p> : null}
      </div>
    );
  };
  const renderChannels = (channels: ChannelsView) => channels.visible ? (
    <fieldset className={styles.channels}>
      <legend>{channels.label}</legend>
      <div className={styles.channelOptions}>
        {channels.emailOffered ? (
          <label className={styles.check}>
            <input aria-describedby={channels.error ? `${idPrefix}-channels-error` : undefined} aria-invalid={channels.error ? "true" : "false"} checked={channels.email} onChange={event => onChannel("email", event.target.checked)} type="checkbox" />
            <span>Email</span>
          </label>
        ) : null}
        <label className={styles.check}>
          <input aria-describedby={channels.error ? `${idPrefix}-channels-error` : undefined} aria-invalid={channels.error ? "true" : "false"} checked={channels.sms} onChange={event => onChannel("sms", event.target.checked)} type="checkbox" />
          <span>Text message</span>
        </label>
      </div>
      {channels.error ? <p className={styles.error} id={`${idPrefix}-channels-error`}>{channels.error}</p> : null}
    </fieldset>
  ) : null;

  // Settings: the update preferences sit together under Puckle Updates, with personal contact visibly separate.
  if (layout.groups) {
    return (
      <section aria-label={layout.heading} className={styles.section} data-preferences={idPrefix}>
        {layout.groups.map(group => (
          <div aria-labelledby={`${idPrefix}-${group.id}-group`} className={group.id === "updates" ? styles.group : `${styles.group} ${styles.separate}`} data-group={group.id} key={group.id} role="group">
            <h3 className={styles.groupTitle} id={`${idPrefix}-${group.id}-group`}>{group.title}</h3>
            {group.text ? <p className={styles.groupText}>{group.text}</p> : null}
            <div className={group.id === "updates" ? styles.nested : undefined}>{group.rows.map(renderRow)}</div>
            {group.channels ? renderChannels(group.channels) : null}
          </div>
        ))}
      </section>
    );
  }
  return (
    <section aria-labelledby={`${idPrefix}-prefs-title`} className={styles.section} data-preferences={idPrefix}>
      <h2 id={`${idPrefix}-prefs-title`}>{layout.heading}</h2>
      {layout.rows.map(renderRow)}
      {renderChannels(layout.channels)}
    </section>
  );
}
