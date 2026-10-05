export function POST() {
  return Response.json({ error: "This legacy feature is disabled.", code: "FEATURE_DISABLED" }, { status: 410 });
}
