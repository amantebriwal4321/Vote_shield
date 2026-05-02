const API_BASE = import.meta.env.VITE_API_URL || '';

export interface Incident {
  id: string;
  ticket: string;
  category: string;
  urgency: number;
  summary: string;
  required_action: string | null;
  constituency: string | null;
  latitude: string | null;
  longitude: string | null;
  status: string | null;
  assigned_squad: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface MisinfoCheck {
  id: string;
  message_hash: string;
  verdict: string;
  explanation: string | null;
  sources: string[] | null;
  language: string | null;
  response_ms: number | null;
  created_at: string | null;
}

export interface Stats {
  incidents: {
    total: number;
    open: number;
    resolved: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  misinfo: {
    total: number;
    byVerdict: Array<{ verdict: string; count: number }>;
  };
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/incidents`);
  const data = await res.json();
  return data.incidents ?? [];
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/api/dashboard/stats`);
  return await res.json();
}

export async function fetchMisinfo(): Promise<MisinfoCheck[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/misinfo`);
  const data = await res.json();
  return data.checks ?? [];
}

export async function fetchTransparency(): Promise<{
  incidentsByConstituency: Array<{ constituency: string; total: number }>;
  misinfoStats: { total: number; byVerdict: Array<{ verdict: string; count: number }> };
}> {
  const res = await fetch(`${API_BASE}/api/dashboard/transparency`);
  return await res.json();
}

export async function updateIncident(ticket: string, data: { status?: string; assignedSquad?: string }): Promise<Incident> {
  const res = await fetch(`${API_BASE}/api/dashboard/incidents/${ticket}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return result.incident;
}

export function createSSEConnection(onMessage: (data: Record<string, unknown>) => void): EventSource {
  const es = new EventSource(`${API_BASE}/api/dashboard/incidents/stream`);
  es.onmessage = (event) => {
    try { onMessage(JSON.parse(event.data)); } catch { /* ignore */ }
  };
  return es;
}
