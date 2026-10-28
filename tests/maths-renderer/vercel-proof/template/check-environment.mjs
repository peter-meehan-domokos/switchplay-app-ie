// Never allow this actual proof to build in a Production-classified deployment.
// A separately approved inert bootstrap, if any, must use different source.
if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "preview") {
  throw new Error("MATHS_PROOF_REQUIRES_PREVIEW: refusing a non-Preview Vercel build.");
}
