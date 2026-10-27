import { CardArchitectureError } from "../cards/domain";
import type { InfoMathsMeasurement } from "../../components/info-cards/infoCardMaths";
import type { InfoDraft } from "./model";

export type InfoMathsValidator = (content: InfoDraft, seriesTitle: string) => Promise<InfoMathsMeasurement>;
export type InfoMathsFailure = "authentication" | "browser-startup" | "host" | "timeout" | "fonts" | "renderer" | "busy";
export class InfoMathsError extends CardArchitectureError {
  constructor(readonly measurement?: InfoMathsMeasurement, readonly failure?: InfoMathsFailure) {
    super(measurement?.result.status === "invalid-input" ? "INFO_MATHS_INVALID" : measurement?.result.status === "ready" ? "INFO_MATHS_OVERFLOW" : "INFO_MATHS_UNAVAILABLE");
  }
}

export type InfoRenderingCapture = {
  measurement: InfoMathsMeasurement;
  screenshot: { dataUrl: string; width: number; height: number } | null;
  screenshotError?: string;
};
export type InfoRenderingDiagnostic = InfoRenderingCapture & { revision: number };
export type InfoRenderingChecker = (content: InfoDraft, seriesTitle: string) => Promise<InfoRenderingCapture>;
