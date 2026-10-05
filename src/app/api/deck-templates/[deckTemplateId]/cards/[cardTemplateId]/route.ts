// Fixed response before authentication/lookups: this is no longer a mutation boundary.
export async function PATCH() {
  return Response.json({ code: "CARD_MUTATION_ROUTE_RETIRED", error: "Use /api/card-templates/{cardTemplateId}." }, { status: 410 });
}
