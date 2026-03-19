import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const rootDir = path.resolve(process.cwd());
const configSource = fs.readFileSync(path.join(rootDir, "supabase-config.js"), "utf8");
const configContext = { window: {}, globalThis: null };
configContext.globalThis = configContext;
vm.createContext(configContext);
vm.runInContext(configSource, configContext, { filename: "supabase-config.js" });

const config = configContext.window.SUPABASE_CONFIG;

if (!config?.url || !config?.publishableKey) {
  throw new Error("Missing SUPABASE_CONFIG.url or SUPABASE_CONFIG.publishableKey.");
}

const headers = {
  apikey: config.publishableKey,
  Authorization: `Bearer ${config.publishableKey}`,
  "Content-Type": "application/json"
};

const shouldWrite = process.argv.includes("--write");
const testEmail =
  process.argv.find((argument) => argument.startsWith("--email="))?.slice("--email=".length) ||
  `codex-smoke-${Date.now()}@example.com`;

async function readGuestGroups() {
  const response = await fetch(
    `${config.url}/rest/v1/guest_groups?select=name,slug&order=sort_order.asc,name.asc`,
    { headers }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`guest_groups request failed: ${response.status} ${JSON.stringify(data)}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("guest_groups returned no rows.");
  }

  console.log("guest_groups OK");
  console.log(JSON.stringify(data, null, 2));

  const hasDefault = data.some((group) => String(group.slug || "").trim() === "default");
  if (!hasDefault) {
    throw new Error("guest_groups is missing the default slug.");
  }
}

async function writeSmokeRegistration() {
  const payload = {
    p_name: "Smoke",
    p_surname: "Tester",
    p_email: testEmail,
    p_guests_count: 1,
    p_notes: "Smoke test insert from scripts/smoke-supabase-rsvp.mjs",
    p_group_slug: "default",
    p_new_group_name: null
  };

  const response = await fetch(`${config.url}/rest/v1/rpc/register_guest`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`register_guest failed: ${response.status} ${JSON.stringify(data)}`);
  }

  console.log("register_guest OK");
  console.log(JSON.stringify(data, null, 2));
}

await readGuestGroups();

if (shouldWrite) {
  await writeSmokeRegistration();
} else {
  console.log("Write test skipped. Run with --write to test a real RSVP insert.");
}
