const key = process.env.LOOPS_API_KEY ?? "";
const out = { key_present: Boolean(key) && !String(key).includes("SENSITIVE") };

if (out.key_present) {
  const headers = { Authorization: `Bearer ${key}` };
  const authResponse = await fetch("https://app.loops.so/api/v1/api-key", { headers });
  const auth = await authResponse.json();
  out.auth_status = authResponse.status;
  out.success = auth.success === true;
  out.team = typeof auth.teamName === "string" ? auth.teamName : null;

  const workflowResponse = await fetch("https://app.loops.so/api/v1/workflows", { headers });
  const workflowBody = await workflowResponse.json();
  const rows = Array.isArray(workflowBody) ? workflowBody : [];
  const details = [];
  for (const row of rows) {
    const detailResponse = await fetch(`https://app.loops.so/api/v1/workflows/${row.id}`, { headers });
    const parsed = await detailResponse.json();
    const source = parsed.workflow ?? parsed;
    const actions = Array.isArray(source.actions) ? source.actions : [];
    details.push({
      status: source.status ?? null,
      sends: actions.filter((action) => String(action?.type ?? "").includes("SendEmail")).length,
    });
  }
  out.workflows = details;

  const campaignResponse = await fetch("https://app.loops.so/api/v1/campaigns", { headers });
  const campaignBody = await campaignResponse.json();
  const campaignRows = Array.isArray(campaignBody) ? campaignBody : [];
  out.campaigns = campaignRows.map((row) => row.status ?? null);
}

console.log(`LOOPS_RELEASE_CHECK ${JSON.stringify(out)}`);
