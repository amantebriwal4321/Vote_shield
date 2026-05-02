import { useEffect, useState } from 'react';
import { fetchIncidents, updateIncident, createSSEConnection } from '../api';
import type { Incident } from '../api';

const URGENCY_COLORS: Record<number, string> = {
  1: 'bg-green-500', 2: 'bg-lime-500', 3: 'bg-yellow-500', 4: 'bg-orange-500', 5: 'bg-red-500',
};

const CATEGORY_ICONS: Record<string, string> = {
  INTIMIDATION: '😠', CASH_FOR_VOTE: '💰', BOOTH_CAPTURE: '🏚️', IMPERSONATION: '🎭', OTHER: '📌',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PriorityQueue() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents().then(data => { setIncidents(data); setLoading(false); }).catch(() => setLoading(false));

    const sse = createSSEConnection((data) => {
      if (data.type === 'NEW_INCIDENT') {
        setIncidents(prev => [data as unknown as Incident, ...prev]);
      }
    });
    return () => sse.close();
  }, []);

  async function handleResolve(ticket: string) {
    await updateIncident(ticket, { status: 'RESOLVED' });
    setIncidents(prev => prev.map(i => i.ticket === ticket ? { ...i, status: 'RESOLVED' } : i));
  }

  async function handleAssign(ticket: string) {
    await updateIncident(ticket, { status: 'ASSIGNED', assignedSquad: 'Squad Alpha' });
    setIncidents(prev => prev.map(i => i.ticket === ticket ? { ...i, status: 'ASSIGNED' } : i));
  }

  const filtered = incidents
    .filter(i => filter === 'ALL' || i.status === filter)
    .sort((a, b) => b.urgency - a.urgency || new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📋 Priority Queue</h1>
          <p className="text-sm text-slate-400 mt-1">Incidents sorted by urgency · {filtered.length} total</p>
        </div>
        <div className="flex gap-2">
          {['ALL', 'OPEN', 'ASSIGNED', 'RESOLVED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                filter === f
                  ? 'bg-shield-600 text-white shadow-lg shadow-shield-600/25'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-shield-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-xs text-slate-400 uppercase tracking-wide p-4">Ticket</th>
                <th className="text-left text-xs text-slate-400 uppercase tracking-wide p-4">Category</th>
                <th className="text-center text-xs text-slate-400 uppercase tracking-wide p-4">Urgency</th>
                <th className="text-left text-xs text-slate-400 uppercase tracking-wide p-4">Constituency</th>
                <th className="text-left text-xs text-slate-400 uppercase tracking-wide p-4">Summary</th>
                <th className="text-left text-xs text-slate-400 uppercase tracking-wide p-4">Time</th>
                <th className="text-center text-xs text-slate-400 uppercase tracking-wide p-4">Status</th>
                <th className="text-center text-xs text-slate-400 uppercase tracking-wide p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc) => (
                <tr
                  key={inc.ticket}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
                    inc.urgency >= 4 ? 'bg-red-950/10' : ''
                  }`}
                >
                  <td className="p-4">
                    <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">{inc.ticket}</span>
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-2 text-sm">
                      <span>{CATEGORY_ICONS[inc.category] ?? '📌'}</span>
                      {inc.category?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-white text-sm font-bold ${URGENCY_COLORS[inc.urgency]}`}>
                      {inc.urgency}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{inc.constituency}</td>
                  <td className="p-4 text-sm text-slate-300 max-w-xs truncate">{inc.summary}</td>
                  <td className="p-4 text-xs text-slate-400">{timeAgo(inc.created_at)}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      inc.status === 'OPEN' ? 'bg-red-500/20 text-red-400' :
                      inc.status === 'ASSIGNED' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>{inc.status}</span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex gap-1 justify-center">
                      {inc.status === 'OPEN' && (
                        <button onClick={() => handleAssign(inc.ticket)} className="px-3 py-1.5 bg-shield-600/30 hover:bg-shield-600 text-shield-300 hover:text-white rounded-lg text-xs font-medium transition-all">
                          Assign
                        </button>
                      )}
                      {inc.status !== 'RESOLVED' && (
                        <button onClick={() => handleResolve(inc.ticket)} className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded-lg text-xs font-medium transition-all">
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
