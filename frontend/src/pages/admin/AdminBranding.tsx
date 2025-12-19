import { useEffect, useState } from 'react';
import { adminUpdateBranding, getBranding, type Branding, API_URL } from '../../api';

export default function AdminBranding({
  adminToken,
  onSaved
}: {
  adminToken: string;
  onSaved: (b: Branding) => void;
}) {
  const [theme, setTheme] = useState<string>('purple-blue');
  const [banner, setBanner] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getBranding()
      .then((b) => setTheme(b.theme || 'purple-blue'))
      .catch(() => {});
  }, []);

  async function save() {
    try {
      const b = await adminUpdateBranding({ adminToken, theme, banner });
      setStatus('Saved');
      onSaved(b);
    } catch (e: any) {
      const msg = e?.message || String(e) || 'Failed to save';
      setStatus(`${msg} (API: ${API_URL})`);
    }
  }

  return (
    <div className="ps-card rounded-2xl p-6">
      <div className="text-lg font-semibold">Branding</div>
      <div className="mt-1 text-sm text-slate-300/80">Upload a 500×250 banner and choose a theme palette.</div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-xs text-slate-300/90">Theme</label>
          <select
            className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="purple">Purple tones</option>
            <option value="blue">Blue tones</option>
            <option value="grey">Grey tones</option>
            <option value="purple-blue">Purple + blue</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-slate-300/90">Banner (500×250)</label>
          <input
            className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
            type="file"
            accept="image/*"
            onChange={(e) => setBanner(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button className="ps-btn rounded-xl px-5 py-3 text-sm font-semibold" type="button" onClick={save}>
          Save branding
        </button>
        {status ? <div className="text-sm text-slate-300/80">{status}</div> : null}
      </div>
    </div>
  );
}
