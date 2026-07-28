import type { MouseEvent, PointerEvent } from "react";
import type { StepDescriptionSpan } from "@/components/decks/types";

type StepDescriptionTextProps = {
  content?: StepDescriptionSpan[];
  fallback: string | null;
  linksEnabled?: boolean;
};

function stopLinkPropagation(event: MouseEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>) {
  event.stopPropagation();
}

export default function StepDescriptionText({ content, fallback, linksEnabled = true }: StepDescriptionTextProps) {
  if (!content || content.length === 0) {
    return fallback;
  }

  return (
    <>
      {content.map((span, index) => {
        if (span.type === "text") {
          return span.text;
        }

        return linksEnabled ? (
          <a
            className="step-description-link"
            href={span.url}
            key={`${span.url}:${index}`}
            onClick={stopLinkPropagation}
            onPointerDown={stopLinkPropagation}
            rel="noopener noreferrer"
            target="_blank"
          >
            {span.text}
          </a>
        ) : (
          <span className="step-description-link" key={`${span.url}:${index}`}>
            {span.text}
          </span>
        );
      })}
    </>
  );
}
