async function getConnectors() {
  const base = process.env.API_URL ?? 'http://127.0.0.1:4000';
  try { const res = await fetch(`${base}/api/connectors`, { cache: 'no-store' }); return res.ok ? res.json() : []; } catch { return []; }
}
export default async function Home() {
  const connectors = await getConnectors();
  return <main style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
    <h1>Tally Remote Connect</h1>
    <p>Milestone 1 — local connector foundation</p>
    <h2>Connectors</h2>
    {connectors.length === 0 ? <p>No connector currently online.</p> : connectors.map((c: any) => <article key={c.deviceId} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 12 }}><strong>{c.name}</strong><div>Status: {c.status}</div><div>Device: {c.deviceId}</div><div>Company: {c.company ?? 'Not detected'}</div></article>)}
  </main>;
}
