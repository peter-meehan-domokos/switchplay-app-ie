/** Server-only rollout policy. Readers remain compatible when writers stop. */
export function stepMediaWriteProtocol(protocol: string | null | undefined, environment: Record<string, string | undefined> = process.env) {
  return environment.SWITCHPLAY_PLUGGED_IN_VISUALS === "1" && environment.SWITCHPLAY_STEP_MEDIA_WRITES === "1" ? protocol : undefined;
}
export const stepMediaAuthoringEnabled = () => stepMediaWriteProtocol("1") === "1";
