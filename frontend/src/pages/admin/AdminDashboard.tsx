import { Route, Routes, Navigate, Link } from 'react-router-dom';
import { useState } from 'react';
import AdminQuestions from './AdminQuestions';
import AdminBranding from './AdminBranding';
import AdminUsers from './AdminUsers';
import AdminPlayerArchive from './AdminPlayerArchive';
import type { Branding } from '../../api';

export default function AdminDashboard({
  onBrandingChanged
}: {
  onBrandingChanged: (b: Branding) => void;
}) {
  // Always use the default token - can be changed in the UI
  const [adminToken, setAdminToken] = useState(() => {
    const stored = localStorage.getItem('ps:adminToken');
    // Reset to default if empty or different from expected
    if (!stored || stored.trim() === '') {
      localStorage.setItem('ps:adminToken', 'changeme-admin-token');
      return 'changeme-admin-token';
    }
    return stored;
  });

  function persistToken(v: string) {
    setAdminToken(v);
    localStorage.setItem('ps:adminToken', v);
  }

  return (
    <div className="grid gap-6">
      <div className="ps-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">Admin Dashboard</div>
            <div className="mt-1 text-sm text-slate-300/80">Manage branding, questions, users, and player archive.</div>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <label className="text-xs text-slate-300/90">Admin token</label>
          <input
            className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
            value={adminToken}
            onChange={(e) => persistToken(e.target.value)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
          <Link className="ps-link" to="branding">Branding</Link>
          <Link className="ps-link" to="questions">Questions</Link>
          <Link className="ps-link" to="users">Users</Link>
          <Link className="ps-link" to="players">Player Archive</Link>
        </div>
      </div>

      <Routes>
        <Route path="" element={<Navigate to="branding" replace />} />
        <Route path="branding" element={<AdminBranding adminToken={adminToken} onSaved={onBrandingChanged} />} />
        <Route path="questions" element={<AdminQuestions adminToken={adminToken} />} />
        <Route path="users" element={<AdminUsers adminToken={adminToken} />} />
        <Route path="players" element={<AdminPlayerArchive adminToken={adminToken} />} />
      </Routes>
    </div>
  );
}
