import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { fetchIncidents, createSSEConnection, updateIncident } from '../api';
import type { Incident } from '../api';

const URGENCY_COLORS: Record<number, string> = {
  1: '#22c55e', 2: '#84cc16', 3: '#eab308', 4: '#f97316', 5: '#ef4444',
};

const URGENCY_LABELS: Record<number, string> = {
  1: 'Low', 2: 'Minor', 3: 'Moderate', 4: 'High', 5: 'Critical',
};

export default function IncidentMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [stats, setStats] = useState({ total: 0, open: 0, critical: 0 });

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [22.5, 78.9],
      zoom: 5,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Load incidents
  useEffect(() => {
    fetchIncidents().then(data => {
      setIncidents(data);
      updateStats(data);
    }).catch(() => {});

    const sse = createSSEConnection((data) => {
      if (data.type === 'NEW_INCIDENT') {
        setIncidents(prev => {
          const updated = [data as unknown as Incident, ...prev];
          updateStats(updated);
          return updated;
        });
      }
    });

    return () => sse.close();
  }, []);

  // Update markers
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    for (const inc of incidents) {
      if (!inc.latitude || !inc.longitude) continue;
      const lat = parseFloat(inc.latitude);
      const lng = parseFloat(inc.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const color = URGENCY_COLORS[inc.urgency] ?? '#eab308';
      const icon = L.divIcon({
        html: `<div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 0 12px ${color}80;
          ${inc.urgency >= 4 ? 'animation: urgencyPulse 2s infinite;' : ''}
        "></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lng], { icon });
      marker.on('click', () => setSelected(inc));
      markersRef.current!.addLayer(marker);
    }
  }, [incidents]);

  function updateStats(data: Incident[]) {
    setStats({
      total: data.length,
      open: data.filter(i => i.status === 'OPEN').length,
      critical: data.filter(i => i.urgency >= 4).length,
    });
  }

  async function handleAssign(ticket: string) {
    await updateIncident(ticket, { status: 'ASSIGNED', assignedSquad: 'Squad Alpha' });
    setIncidents(prev => prev.map(i => i.ticket === ticket ? { ...i, status: 'ASSIGNED', assigned_squad: 'Squad Alpha' } : i));
    setSelected(null);
  }

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">
      {/* Stats bar */}
      <div className="flex gap-3">
        {[
          { label: 'Total Incidents', value: stats.total, icon: '📋', color: 'from-blue-600/20 to-blue-800/20 border-blue-500/30' },
          { label: 'Open', value: stats.open, icon: '🔴', color: 'from-red-600/20 to-red-800/20 border-red-500/30' },
          { label: 'Critical (4-5)', value: stats.critical, icon: '🚨', color: 'from-orange-600/20 to-orange-800/20 border-orange-500/30' },
        ].map((stat) => (
          <div key={stat.label} className={`glass-card flex-1 p-4 bg-gradient-to-br ${stat.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Map + detail panel */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div ref={mapRef} className="flex-1 rounded-2xl overflow-hidden border border-slate-700/50" style={{ minHeight: '400px' }} />

        {/* Detail panel */}
        {selected && (
          <div className="w-80 glass-card p-5 animate-slide-up overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Incident Details</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded">{selected.ticket}</span>
                <span
                  className="px-2 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: URGENCY_COLORS[selected.urgency] }}
                >
                  {URGENCY_LABELS[selected.urgency]} ({selected.urgency}/5)
                </span>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase">Category</p>
                <p className="font-medium">{selected.category?.replace(/_/g, ' ')}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase">Constituency</p>
                <p className="font-medium">{selected.constituency}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase">Summary</p>
                <p className="text-sm text-slate-300">{selected.summary}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase">Required Action</p>
                <p className="text-sm text-saffron font-medium">{selected.required_action}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase">Status</p>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  selected.status === 'OPEN' ? 'bg-red-500/20 text-red-400' :
                  selected.status === 'ASSIGNED' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>{selected.status}</span>
              </div>

              {selected.status === 'OPEN' && (
                <button
                  onClick={() => handleAssign(selected.ticket)}
                  className="w-full mt-4 bg-gradient-to-r from-shield-600 to-shield-700 hover:from-shield-500 hover:to-shield-600 text-white py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-shield-600/25"
                >
                  ⚡ Assign to My Squad
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
