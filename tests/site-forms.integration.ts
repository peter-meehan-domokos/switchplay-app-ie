import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

const SITES = ["strat17", "puckle", "switchplay"] as const;
const FORMS = [
  { route: "contact", suffix: "ContactSupportSubmissions", legacy: "contactSupportSubmissions", body: { name: "Sam Tester", email: "sam@example.com", purpose: "General enquiry", message: "Hello there" } },
  { route: "early-access", suffix: "EarlyAccessSignups", legacy: "earlyAccessSignups", puckleSuffix: "TuitionEnquiries", puckleBody: { enquirerType: "student-adult", contactName: "Sam Tester", mathsCourse: "gcse", email: "sam@example.com", preferredContactMethod: "email", message: "" }, body: { name: "Sam Tester", email: "sam@example.com", goals: "Learn something", additionalInformation: "" } },
  { route: "creator-interest", suffix: "CreatorInterestSubmissions", legacy: "creatorInterestSubmissions", body: { name: "Sam Tester", email: "sam@example.com", age: 30, location: "Dublin", creatorIdea: "A path about running", additionalInformation: "" } },
] as const;

let server: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = server.getUri();
  process.env.MONGODB_DB = "switchplay_test_site_forms";
  delete process.env.SWITCHPLAY_DATABASE_MODE;
  client = await new MongoClient(server.getUri()).connect();
  db = client.db("switchplay_test_site_forms");
});

after(async () => {
  const handlerClient = await (globalThis as typeof globalThis & { mongoClientPromise?: Promise<MongoClient> }).mongoClientPromise;
  await handlerClient?.close();
  await client?.close();
  await server?.stop();
});

type Handler = { POST: (request: Request) => Promise<Response> };

const post = (handler: Handler, body: unknown) =>
  handler.POST(new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

test("each website's form handlers store only in that website's own collections", async () => {
  for (const site of SITES) {
    for (const form of FORMS) {
      const handler = (await import(`../src/app/api/public/${site}/${form.route}/route`)) as Handler;
      const isPuckleEnquiry = site === "puckle" && form.route === "early-access";
      const response = await post(handler, isPuckleEnquiry ? (form as typeof FORMS[1]).puckleBody : form.body);
      assert.equal(response.status, 201, `${site}/${form.route}: ${await response.clone().text()}`);

      const expectedCollection = `${site}${isPuckleEnquiry ? (form as typeof FORMS[1]).puckleSuffix : form.suffix}`;
      assert.equal(await db.collection(expectedCollection).countDocuments(), 1, expectedCollection);
    }
  }

  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).toSorted();
  const expected = SITES.flatMap((site) =>
    FORMS.map((form) => `${site}${site === "puckle" && form.route === "early-access" ? (form as typeof FORMS[1]).puckleSuffix : form.suffix}`),
  ).toSorted();
  assert.deepEqual(names, expected);
  for (const form of FORMS) assert.equal(await db.collection(form.legacy).countDocuments(), 0, `legacy ${form.legacy} must stay untouched`);
});

test("invalid submissions are rejected without writing anywhere", async () => {
  const before = (await db.listCollections({}, { nameOnly: true }).toArray()).length;
  for (const site of SITES) {
    for (const form of FORMS) {
      const handler = (await import(`../src/app/api/public/${site}/${form.route}/route`)) as Handler;
      assert.equal((await post(handler, {})).status, 400, `${site}/${form.route}`);
    }
  }
  assert.equal((await db.listCollections({}, { nameOnly: true }).toArray()).length, before);
});

test("the original public handlers still write to the legacy collections (left in place)", async () => {
  for (const form of FORMS) {
    // In production these collections already exist; the untouched original early-access handler expects that.
    await db.createCollection(form.legacy);
    const handler = (await import(`../src/app/api/public/${form.route}/route`)) as Handler;
    assert.equal((await post(handler, form.body)).status, 201, form.route);
    assert.equal(await db.collection(form.legacy).countDocuments(), 1, form.legacy);
  }
});
