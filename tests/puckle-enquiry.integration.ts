import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

let server: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let handler: { POST: (request: Request) => Promise<Response> };

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = server.getUri();
  process.env.MONGODB_DB = "switchplay_test_puckle_enquiry";
  delete process.env.SWITCHPLAY_DATABASE_MODE;
  client = await new MongoClient(server.getUri()).connect();
  db = client.db("switchplay_test_puckle_enquiry");
  handler = await import("../src/app/api/public/puckle/early-access/route");
});

after(async () => {
  const handlerClient = await (globalThis as typeof globalThis & { mongoClientPromise?: Promise<MongoClient> }).mongoClientPromise;
  await handlerClient?.close();
  await client?.close();
  await server?.stop();
});

const post = (body: unknown, contentType = "application/json") =>
  handler.POST(new Request("http://localhost/api", { method: "POST", headers: { "content-type": contentType }, body: typeof body === "string" ? body : JSON.stringify(body) }));

const enquiries = () => db.collection("puckleTuitionEnquiries");

test("stores each enquirer type with an unambiguous student, contact and preferred method", async () => {
  const cases = [
    { enquirerType: "student-under-18", studentName: "Aoife", contactName: "Mary Murphy", mathsCourse: "junior-cycle", email: "mary@example.com", preferredContactMethod: "email", message: "Junior Cert help" },
    { enquirerType: "student-adult", contactName: "Sam Tester", mathsCourse: "leaving-cert", phone: "+353871234567", preferredContactMethod: "text" },
    { enquirerType: "parent-guardian", contactName: "Pat Parent", studentName: "Jamie", mathsCourse: "a-level", email: "pat@example.com", phone: "+353861234567", preferredContactMethod: "phone" },
  ];
  for (const body of cases) assert.equal((await post(body)).status, 201, JSON.stringify(body));

  const stored = await enquiries().find({}).sort({ createdAt: 1 }).toArray();
  assert.equal(stored.length, 3);
  assert.deepEqual(
    stored.map((doc) => { const { _id: ignoredId, createdAt, ...rest } = doc; void ignoredId; return { ...rest, hasDate: createdAt instanceof Date }; }),
    [
      { enquirerType: "student-under-18", studentName: "Aoife", contactName: "Mary Murphy", contactRelationship: "parent-guardian", mathsCourse: "junior-cycle", email: "mary@example.com", phone: null, preferredContactMethod: "email", message: "Junior Cert help", source: "public-homepage", hasDate: true },
      { enquirerType: "student-adult", studentName: "Sam Tester", contactName: "Sam Tester", contactRelationship: "self", mathsCourse: "leaving-cert", email: null, phone: "+353871234567", preferredContactMethod: "text", message: "", source: "public-homepage", hasDate: true },
      { enquirerType: "parent-guardian", studentName: "Jamie", contactName: "Pat Parent", contactRelationship: "parent-guardian", mathsCourse: "a-level", email: "pat@example.com", phone: "+353861234567", preferredContactMethod: "phone", message: "", source: "public-homepage", hasDate: true },
    ],
  );
});

test("the same contact can submit more than once (for example a parent with two children)", async () => {
  const body = { enquirerType: "parent-guardian", contactName: "Pat Parent", mathsCourse: "gcse", email: "pat@example.com", preferredContactMethod: "email" };
  const before = await enquiries().countDocuments();
  assert.equal((await post({ ...body, studentName: "Jamie" })).status, 201);
  assert.equal((await post({ ...body, studentName: "Alex" })).status, 201);
  assert.equal(await enquiries().countDocuments(), before + 2);
});

test("invalid enquiries return field errors and store nothing", async () => {
  const before = await enquiries().countDocuments();
  const missingContact = await post({ enquirerType: "student-adult", contactName: "Sam", mathsCourse: "gcse", preferredContactMethod: "email" });
  assert.equal(missingContact.status, 400);
  const body = (await missingContact.json()) as { ok: boolean; fieldErrors: Record<string, string> };
  assert.equal(body.ok, false);
  assert.ok(body.fieldErrors.contact);

  assert.equal((await post({ enquirerType: "student-under-18", contactName: "Mary", mathsCourse: "gcse", email: "mary@example.com" })).status, 400);
  assert.equal((await post({ enquirerType: "student-adult", contactName: "Sam", mathsCourse: "gcse", email: "sam@example.com", preferredContactMethod: "text" })).status, 400);
  assert.equal((await post({ enquirerType: "student-adult", contactName: "Sam", email: "sam@example.com", preferredContactMethod: "email" })).status, 400);
  assert.equal((await post({ enquirerType: "student-adult", contactName: "Sam", mathsCourse: "ib-maths", email: "sam@example.com", preferredContactMethod: "email" })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await post("not json")).status, 400);
  assert.equal((await post({}, "text/plain")).status, 415);
  assert.equal(await enquiries().countDocuments(), before);
});

test("a filled honeypot reports success without storing anything", async () => {
  const before = await enquiries().countDocuments();
  const response = await post({ enquirerType: "student-adult", contactName: "Bot", email: "bot@example.com", preferredContactMethod: "email", companyWebsite: "spam.example" });
  assert.equal(response.status, 201);
  assert.equal(await enquiries().countDocuments(), before);
});

test("historical early-access signups are left untouched and do not block enquiries", async () => {
  await db.collection("puckleEarlyAccessSignups").insertOne({ name: "Old Signup", email: "old@example.com", phone: null, goals: "", additionalInformation: "", source: "public-homepage", createdAt: new Date("2025-01-01") });
  const response = await post({ enquirerType: "student-adult", contactName: "Old Signup", mathsCourse: "other", email: "old@example.com", preferredContactMethod: "email" });
  assert.equal(response.status, 201);
  assert.equal(await db.collection("puckleEarlyAccessSignups").countDocuments(), 1);
});
