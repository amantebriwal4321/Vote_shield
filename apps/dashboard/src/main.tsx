import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import IncidentMap from './pages/IncidentMap';
import PriorityQueue from './pages/PriorityQueue';
import TransparencyFeed from './pages/TransparencyFeed';
import './index.css';

import WhatsAppSimulator from './components/WhatsAppSimulator';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav className="w-64 glass-card m-3 mr-0 p-6 flex flex-col gap-2 shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold gradient-text">🛡️ VoteShield</h1>
          <p className="text-xs text-slate-400 mt-1">Flying Squad Dashboard</p>
        </div>

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-shield-600/30 text-shield-300 border border-shield-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <span className="text-lg">🗺️</span>
          Incident Map
        </NavLink>

        <NavLink
          to="/queue"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-shield-600/30 text-shield-300 border border-shield-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <span className="text-lg">📋</span>
          Priority Queue
        </NavLink>

        <NavLink
          to="/transparency"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-shield-600/30 text-shield-300 border border-shield-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <span className="text-lg">📊</span>
          Transparency Feed
        </NavLink>

        <div className="mt-auto pt-6 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Online
          </div>
          <p className="text-[10px] text-slate-600 mt-2">© 2026 VoteShield · Open Source</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-3 overflow-auto">
        {children}
      </main>

      <WhatsAppSimulator />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<IncidentMap />} />
          <Route path="/queue" element={<PriorityQueue />} />
          <Route path="/transparency" element={<TransparencyFeed />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
