'use client';

import { useEffect, useState } from 'react';

type Connector = { deviceId: string; name: string; revoked: boolean; connected: boolean; lastSeenAt: string | null };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const headers = {
  'content-type': 'application/json',
  'x-dev-user': process.env.NEXT_PUBLIC_DEV_USER ?? 'dev-user',
  'x-dev-organization': process.env.NEXT_PUBLIC_DEV_ORGANIZATION ?? 'dev-organization',
};

export default function Home() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await fetch(`${apiBase}/api/connectors`, { cache: 'no-store', headers });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as Connector[];
      setConnectors(data);
      if (!selected && data[0]) setSelected(data[0].deviceId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load connectors'); }
  }

  useEffect(() => { void load(); }, []);

  async function read(operation: 'current_company' | 'trial_balance') {
    if (!selected) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${apiBase}/api/connectors/${encodeURIComponent(selected)}/read`, {
        method: 'POST', headers, body: JSON.stringify({ operation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API ${res.status}`);
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Read failed'); }
    finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 960, margin: '0 auto', padding: 32, fontFamily: 'system-ui' }}>
    <h1>Tally Remote Connect</h1>
    <p>Secure TallyPrime read-only dashboard</p>
    <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 20 }}>
      <h2>Connector</h2>
      <select value={selected} onChange={e => setSelected(e.target.value)} disabled={!connectors.length} style={{ padding: 10, minWidth: 280 }}>
        {!connectors.length && <option>No connectors</option>}
        {connectors.map(c => <option key={c.deviceId} value={c.deviceId}>{c.name} — {c.connected ? 'Online' : 'Offline'}{c.revoked ? ' — Revoked' : ''}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button disabled={busy || !selected} onClick={() => void read('current_company')}>Read current company</button>
        <button disabled={busy || !selected} onClick={() => void read('trial_balance')}>Read trial balance</button>
        <button disabled={busy} onClick={() => void load()}>Refresh</button>
      </div>
    </section>
    {error && <p role="alert" style={{ marginTop: 16 }}>Error: {error}</p>}
    {result !== null && <section style={{ marginTop: 20 }}><h2>Result</h2><pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', background: '#f6f6f6', padding: 16, borderRadius: 8 }}>{JSON.stringify(result, null, 2)}</pre></section>}
    <h2>Connectors</h2>
    {connectors.length === 0 ? <p>No connector registered for this organization.</p> : connectors.map(c => <article key={c.deviceId} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <strong>{c.name}</strong>
      <div>Status: {c.revoked ? 'Revoked' : c.connected ? 'Online' : 'Offline'}</div>
      <div>Device: {c.deviceId}</div>
      <div>Last seen: {c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString() : 'Never'}</div>
    </article>)}
  </main>;
}
