"use client";

// Test reference only, separate from Host. Uses the real presentation component
// to obtain the consumer budget; no Info Card capacity/business logic is used.
import InfoCardFace from "@/components/info-cards/InfoCardFace";

export default function Reference() {
  return <main>{[false, true].map(media => <div key={String(media)} data-proof-reference={media ? "media" : "plain"} style={{ width: 240 }}>
    <InfoCardFace card={{ title: "Title", seriesTitle: "Series", seriesCreatorUsername: "reference",
      body: "", ...(media ? { mediaKind: "image" as const } : {}) }} />
  </div>)}</main>;
}
