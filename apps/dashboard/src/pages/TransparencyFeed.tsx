import { useEffect, useState } from 'react';
import { fetchTransparency, fetchStats } from '../api';
import type { Stats } from '../api';

const VERDICT_COLORS: Record<string, string> = {
  TRUE: 'bg-green-500', FALSE: 'bg-red-500', MISLEADING: 'bg-yellow-500', UNVERIFIABLE: 'bg-slate-500',
};
const VERDICT_ICONS: Record<string, string> = {
  TRUE: '✅', FALSE: '❌', MISLEADING: '⚠️', UNVERIFIABLE: '🔍',
};

interface TransparencyData {
  incidentsByConstituency: Array<{ constituency: string; total: number }>;
  misinfoStats: { total: number; byVerdict: Array<{ verdict: string; count: number }> };
}

export default function TransparencyFeed() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTransparency(), fetchStats()])
      .then(([t, s]) => { setData(t); setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-shield-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const totalMisinfo = data?.misinfoStats.total ?? 0;

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in overflow-auto">
      {/* Header */}
      <div className="glass-card p-5">
        <h1 className="text-2xl font-bold">📊 Transparency Feed</h1>
        <p className="text-sm text-slate-400 mt-1">Public, anonymised election integrity data · Real-time</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Incidents', value: stats?.incidents.total ?? 0, icon: '🚨', gradient: 'from-red-600/20 to-red-900/10' },
          { label: 'Resolved', value: stats?.incidents.resolved ?? 0, icon: '✅', gradient: 'from-green-600/20 to-green-900/10' },
          { label: 'Pending', value: stats?.incidents.open ?? 0, icon: '⏳', gradient: 'from-yellow-600/20 to-yellow-900/10' },
          { label: 'Misinfo Checked', value: totalMisinfo, icon: '🔍', gradient: 'from-blue-600/20 to-blue-900/10' },
        ].map(s => (
          <div key={s.label} className={`glass-card p-5 bg-gradient-to-br ${s.gradient}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-4xl font-bold mt-2">{s.value}</p>
              </div>
              <span className="text-4xl opacity-50">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* Incidents by Constituency */}
        <div className="glass-card p-5 overflow-auto">
          <h2 className="text-lg font-bold mb-4">🏛️ Incidents by Constituency</h2>
          <div className="space-y-3">
            {(data?.incidentsByConstituency ?? []).map((c) => {
              const maxCount = Math.max(...(data?.incidentsByConstituency ?? []).map(x => x.total), 1);
              const pct = (c.total / maxCount) * 100;
              return (
                <div key={c.constituency} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.constituency ?? 'Unknown'}</span>
                    <span className="text-sm font-bold text-shield-400">{c.total}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-shield-600 to-saffron transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(data?.incidentsByConstituency ?? []).length === 0 && (
              <p className="text-slate-500 text-sm">No data yet. Incidents will appear here as they are reported.</p>
            )}
          </div>
        </div>

        {/* Misinfo Verdicts */}
        <div className="glass-card p-5 overflow-auto">
          <h2 className="text-lg font-bold mb-4">🔍 Misinfo Verdicts Breakdown</h2>
          <div className="space-y-4">
            {(data?.misinfoStats.byVerdict ?? []).map((v) => {
              const pct = totalMisinfo > 0 ? (v.count / totalMisinfo) * 100 : 0;
              return (
                <div key={v.verdict}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {VERDICT_ICONS[v.verdict] ?? '❓'} {v.verdict}
                    </span>
                    <span className="text-sm">
                      <span className="font-bold">{v.count}</span>
                      <span className="text-slate-400 ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${VERDICT_COLORS[v.verdict] ?? 'bg-slate-600'} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(data?.misinfoStats.byVerdict ?? []).length === 0 && (
              <p className="text-slate-500 text-sm">No fact-checks yet. Forward a message to VoteShield to begin.</p>
            )}
          </div>

          {/* Category breakdown */}
          {stats?.incidents.byCategory && stats.incidents.byCategory.length > 0 && (
            <>
              <h2 className="text-lg font-bold mt-8 mb-4">📂 Incident Categories</h2>
              <div className="grid grid-cols-2 gap-2">
                {stats.incidents.byCategory.map((cat) => (
                  <div key={cat.category} className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{cat.count}</p>
                    <p className="text-xs text-slate-400 mt-1">{cat.category?.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="glass-card p-4 text-center">
        <p className="text-xs text-slate-500">
          🔒 All data is anonymised. No personal information is stored or displayed.
          VoteShield is open-source and auditable.
        </p>
      </div>
    </div>
  );
}
