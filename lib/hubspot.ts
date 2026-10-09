import { env } from "./env";

const H = () => ({
  Authorization: `Bearer ${env("HUBSPOT_PRIVATE_APP_TOKEN")}`,
  "Content-Type": "application/json",
});

async function hs(path: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: H(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HubSpot ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

/** Find or create the contact by phone, then create a deal linked to it. */
export async function createDeal(opts: {
  phone: string | null;
  name: string | null;
  dealName: string;
  description: string;
}): Promise<string> {
  let contactId: string | undefined;
  if (opts.phone) {
    const found = await hs("/crm/v3/objects/contacts/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: opts.phone }] }],
      limit: 1,
    });
    contactId = found.results?.[0]?.id;
    if (!contactId) {
      const [first, ...rest] = (opts.name ?? "").split(" ");
      const created = await hs("/crm/v3/objects/contacts", "POST", {
        properties: { phone: opts.phone, firstname: first || "Caller", lastname: rest.join(" ") },
      });
      contactId = created.id;
    }
  }
  const deal = await hs("/crm/v3/objects/deals", "POST", {
    properties: {
      dealname: opts.dealName,
      pipeline: "default",
      dealstage: "appointmentscheduled",
      description: opts.description,
    },
    associations: contactId
      ? [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }]
      : [],
  });
  return deal.id;
}
