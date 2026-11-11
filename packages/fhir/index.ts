import type { Observation, HealthDocument } from "../health-core";
const codes: Record<string, string> = {
  heartRate: "8867-4",
  restingHeartRate: "40443-4",
  weight: "29463-7",
  glucose: "2339-0",
  oxygen: "59408-5",
};
export function observationToFHIR(o: Observation) {
  return {
    resourceType: "Observation",
    id: o.id,
    status: "final",
    code: {
      coding: [
        { system: "http://loinc.org", code: codes[o.type], display: o.type },
      ],
    },
    effectiveDateTime: o.timestamp,
    valueQuantity: { value: o.value, unit: o.unit },
    note: [
      {
        text: `Source: ${o.source}. Demonstration; interoperability not certified.`,
      },
    ],
  };
}
export function documentsToFHIR(documents: HealthDocument[]) {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: documents.map((d) => ({
      resource: {
        resourceType: "DocumentReference",
        id: d.id,
        status: "current",
        description: d.title,
        date: `${d.date}T00:00:00Z`,
        content: [
          {
            attachment: {
              contentType: "text/plain",
              title: d.title,
              data:
                typeof btoa === "function"
                  ? btoa(unescape(encodeURIComponent(d.text || d.summary)))
                  : undefined,
            },
          },
        ],
      },
    })),
  };
}
