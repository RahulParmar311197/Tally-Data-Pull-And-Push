async function getConnectors() {
  const base = process.env.API_URL ?? 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/api/connectors`, {
      cache: 'no-store',
      headers: { 'x-dev-user': process.env.DEV_USER ?? 'dev-user', 'x-dev-organization': process.env.DEV_ORGANIZATION ?? 'dev-organization' },
    });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function Home() {
  const connectors = await getConnectors();
  return <main style={{ maxWidth: 960, margin: '0 auto', padding: 32, fontFamily: 'system-ui' }}>
    <h1>Tally Remote Connect</h1>
    <p>Milestone 1 — secure connector foundation</p>
    <h2>Connectors</h2>
    {connectors.length === 0 ? <p>No connector registered for this organization.</p> : connectors.map((c: any) => <article key={c.deviceId} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <strong>{c.name}</strong>
      <div>Status: {c.revoked ? 'Revoked' : c.connected ? 'Online' : 'Offline'}</div>
      <div>Device: {c.deviceId}</div>
      <div>Last seen: {c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString() : 'Never'}</div>
    </article>)}
  </main>;
}
