import { CardArchitectureError } from "../cards/domain";
import type { InfoMathsMeasurement } from "../../components/info-cards/infoCardMaths";
import type { InfoDraft } from "./model";

export type InfoMathsValidator = (content: InfoDraft, seriesTitle: string) => Promise<InfoMathsMeasurement>;
export class InfoMathsError extends CardArchitectureError {
  constructor(readonly measurement?: InfoMathsMeasurement) {
    super(measurement?.result.status === "invalid-input" ? "INFO_MATHS_INVALID" : measurement?.result.status === "ready" ? "INFO_MATHS_OVERFLOW" : "INFO_MATHS_UNAVAILABLE");
  }
}
