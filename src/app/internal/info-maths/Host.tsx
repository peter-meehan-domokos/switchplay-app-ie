"use client";
import { useEffect, useState } from "react";
import InfoCardFace from "@/components/info-cards/InfoCardFace";
import type { InfoCardFaceContent } from "@/components/info-cards/InfoCardFace";
import type { InfoMathsMeasurement } from "@/components/info-cards/infoCardMaths";
declare global { interface Window { infoMaths?: { mount(content: InfoCardFaceContent): void; current: InfoMathsMeasurement | null } } }
export default function Host() {
  const [content, setContent] = useState<InfoCardFaceContent | null>(null);
  useEffect(() => {
    window.infoMaths = { mount: next => { window.infoMaths!.current = null; setContent(next); }, current: null };
    return () => { delete window.infoMaths; };
  }, []);
  return <div style={{ width: 240, margin: 32 }}>{content && <InfoCardFace card={content}
    onMathsResult={result => { window.infoMaths!.current = result; }} />}</div>;
}
