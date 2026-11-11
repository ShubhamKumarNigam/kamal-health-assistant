import test from "node:test";
import assert from "node:assert/strict";
import { freshDemo, metrics, getInsights } from "../../packages/demo-data";
import {
  baselineInsight,
  convert,
  emptyConversation,
  reschedule,
  timeline,
} from "../../packages/health-core";
import { detectRedFlags, extract, respond } from "../../packages/ai";
import { encrypt, decrypt } from "../../packages/security";
import { direction, translations } from "../../packages/internationalization";
import { documentsToFHIR, observationToFHIR } from "../../packages/fhir";
import { sparkline } from "../../packages/charts";

test("demo reset produces isolated synthetic records and clears consent", () => {
  const a = freshDemo();
  a.documents[0].title = "Changed";
  a.family[0].consent = true;
  a.messages.push({ role: "user", text: "test" });
  const b = freshDemo();
  assert.notEqual(b.documents[0].title, "Changed");
  assert.equal(b.family[0].consent, false);
  assert.equal(b.contextConsent, false);
  assert.equal(b.messages.length, 0);
});
test("timeline is descending and does not mutate stored order", () => {
  const docs = freshDemo().documents;
  const original = docs.map((d) => d.id);
  const sorted = timeline(docs);
  for (let i = 1; i < sorted.length; i++)
    assert.ok(sorted[i - 1].date >= sorted[i].date);
  assert.deepEqual(
    docs.map((d) => d.id),
    original,
  );
});
test("baseline insight requires three consecutive readings beyond threshold", () => {
  assert.equal(baselineInsight([61, 67, 68, 68], 61), true);
  assert.equal(baselineInsight([68, 61, 68], 61), false);
  assert.equal(baselineInsight([68, 68], 61), false);
  assert.equal(baselineInsight([66, 66, 66], 61), false);
});
test("unit conversion keeps glucose and weight dimensions explicit", () => {
  assert.ok(Math.abs(convert(90, "mg/dL", "mmol/L") - 4.995) < 0.01);
  assert.ok(Math.abs(convert(100, "lb", "kg") - 45.359) < 0.01);
  assert.throws(() => convert(98, "%", "mmol/L"));
});
test("document parser never promotes inferred facts or missing diagnoses", () => {
  const fields = extract(
    "Date: 2026-11-11\nVitamin D: 24 ng/mL\nGlucose: 93 mg/dL\nPossible diabetes?\nAllergy: penicillin",
    "source-1",
  );
  assert.equal(fields.length, 4);
  assert.ok(
    fields.every(
      (f) => f.verification === "unverified" && f.source.includes("source-1"),
    ),
  );
  assert.equal(
    fields.some((f) => f.label === "Explicit diagnosis"),
    false,
  );
  assert.equal(extract("unreadable material", "x").length, 0);
});
test("parser keeps explicit diagnosis distinct and preserves original units", () => {
  const f = extract(
    "Diagnosis: documented condition\nVitamin D: 60 nmol/L",
    "original",
  );
  assert.equal(
    f.find((x) => x.label === "Explicit diagnosis")?.value,
    "documented condition",
  );
  assert.equal(f.find((x) => x.label === "Vitamin D")?.value, "60 nmol/L");
});
for (const input of [
  "chest pain and shortness of breath",
  "sudden weakness on my left side",
  "my throat is swelling",
  "I am thinking of suicide",
  "I took too many pills",
  "I am pregnant and have heavy bleeding",
  "ألم في الصدر وضيق تنفس",
  "سینے میں درد اور سانس میں تکلیف",
])
  test(`urgent routing bypasses follow-ups: ${input}`, () => {
    assert.ok(detectRedFlags(input));
    const result = respond(input);
    assert.equal(result.state.stage, "urgent");
    assert.equal(result.state.questionCount, 0);
    assert.match(result.text, /urgent medical assessment/);
  });
test("urgent state remains escalated across subsequent messages", () => {
  const first = respond("medication overdose");
  const next = respond("What should I do?", first.state);
  assert.equal(next.state.stage, "urgent");
  assert.equal(next.state.questionCount, 0);
});
test("conversation stops asking after three focused follow-ups", () => {
  let state = emptyConversation();
  let last = "";
  for (const message of [
    "I feel tired",
    "Three days, gradual",
    "Some impact",
    "Questions about my report",
  ]) {
    const result = respond(message, state);
    state = result.state;
    last = result.text;
  }
  assert.equal(state.questionCount, 3);
  assert.equal(state.stage, "summary");
  assert.match(last, /I cannot determine the cause/);
  assert.equal(state.duration, "Three days, gradual");
  assert.equal(state.severity, "Some impact");
});
test("medication requests cannot elicit dose changes", () => {
  assert.match(
    respond("Should I change my dose?").text,
    /cannot prescribe or change/,
  );
});
test("language switch preserves conversation context and RTL intent", () => {
  const first = respond("Tired for three days");
  const next = respond("It affects work", first.state, "ar");
  assert.equal(next.state.chiefConcern, first.state.chiefConcern);
  assert.match(next.text, /أنشطتك/);
  assert.equal(direction("ar"), "rtl");
  assert.equal(direction("ur"), "rtl");
  assert.equal(direction("en"), "ltr");
  for (const l of ["en", "ar", "ur"] as const)
    assert.deepEqual(
      Object.keys(translations[l]),
      Object.keys(translations.en),
    );
});
test("encrypted persistence authenticates ciphertext and refuses wrong key", async () => {
  const data = freshDemo();
  const a = await encrypt(data, "demonstration-passphrase");
  const b = await encrypt(data, "demonstration-passphrase");
  assert.notDeepEqual(a.iv, b.iv);
  assert.ok(!JSON.stringify(a).includes("Vitamin"));
  assert.deepEqual(await decrypt(a, "demonstration-passphrase"), data);
  await assert.rejects(() => decrypt(a, "wrong-passphrase"));
  a.ciphertext[3] ^= 1;
  await assert.rejects(() => decrypt(a, "demonstration-passphrase"));
  await assert.rejects(() => encrypt(data, "short"));
});
test("reminder snooze crosses month boundaries without marking completed", () => {
  const r = freshDemo().reminders[0];
  const next = reschedule({ ...r, date: "2026-12-31", complete: true }, 1);
  assert.equal(next.date, "2027-01-01");
  assert.equal(next.complete, false);
});
test("chart paths are finite and include every input reading", () => {
  for (const metric of metrics) {
    for (const values of [metric.values, metric.month]) {
      const points = sparkline(values);
      assert.equal(points.split(" ").length, values.length);
      assert.ok(!/NaN|Infinity/.test(points));
    }
  }
  assert.equal(sparkline([]), "");
  assert.ok(!/NaN/.test(sparkline([7])));
});
test("FHIR export preserves document identifiers and observation units", () => {
  const docs = freshDemo().documents;
  const bundle = documentsToFHIR(docs);
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.entry.length, docs.length);
  assert.deepEqual(
    bundle.entry.map((x) => x.resource.id),
    docs.map((x) => x.id),
  );
  const obs = observationToFHIR({
    id: "x",
    type: "heartRate",
    value: 72,
    unit: "bpm",
    timestamp: "2026-11-11T08:00:00Z",
    source: "demo",
    sourceDevice: "demo",
    confidence: 1,
  });
  assert.equal(obs.code.coding[0].code, "8867-4");
  assert.equal(obs.valueQuantity.value, 72);
});
test("insights follow newly imported reports rather than stale seeded dates", () => {
  const store = freshDemo();
  store.documents.unshift({
    ...store.documents[0],
    id: "new",
    title: "November result",
    date: "2026-11-11",
  });
  const current = getInsights(store);
  assert.match(current[1].reason, /November result/);
  assert.match(current[1].source, /\[new\]/);
});
