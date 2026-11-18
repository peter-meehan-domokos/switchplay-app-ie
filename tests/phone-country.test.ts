import assert from "node:assert/strict";
import test from "node:test";
import { parseVisitorCountry, resolveInitialPhoneCountry, visitorCountryFromHeaders } from "../src/lib/phoneCountries";
import { GET } from "../src/app/api/public/puckle/visitor-country/route";

test("the Vercel IP country is used when it is valid, in any case", () => {
  assert.equal(resolveInitialPhoneCountry({ visitorCountry: "GB", locales: ["en-US"] }), "GB");
  assert.equal(resolveInitialPhoneCountry({ visitorCountry: " de ", locales: ["en-US"] }), "DE");
});
test("browser language is used when there is no valid IP country", () => {
  for (const bad of [null, undefined, "", "XX", "USA", "1", "<script>"]) assert.equal(resolveInitialPhoneCountry({ visitorCountry: bad, locales: ["fr-FR"] }), "FR");
});
test("Ireland is the final fallback", () => {
  assert.equal(resolveInitialPhoneCountry({ visitorCountry: null, locales: [] }), "IE");
  assert.equal(resolveInitialPhoneCountry({ visitorCountry: null, locales: ["en", "not a locale"] }), "IE");
});
test("only supported two-letter countries are accepted", () => {
  assert.equal(parseVisitorCountry("ie"), "IE");
  assert.equal(parseVisitorCountry("ZZ"), null);
  assert.equal(visitorCountryFromHeaders(new Headers({ "x-vercel-ip-country": "US" })), "US");
  assert.equal(visitorCountryFromHeaders(new Headers()), null);
});
test("the visitor-country route reports the header, or null, and is never cached", async () => {
  const withHeader = await GET(new Request("http://localhost/x", { headers: { "x-vercel-ip-country": "GB" } }));
  assert.deepEqual(await withHeader.json(), { country: "GB" });
  assert.match(withHeader.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await (await GET(new Request("http://localhost/x"))).json(), { country: null });
});
