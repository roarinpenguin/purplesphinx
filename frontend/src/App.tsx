import { Route, Routes, Navigate, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import { getBranding, login } from './api';
import JoinPage from './pages/JoinPage';
import PlayerRoom from './pages/PlayerRoom';
import AdminDashboard from './pages/admin/AdminDashboard';
import HostRoom from './pages/HostRoom';
import LeaderboardPage from './pages/LeaderboardPage';

function PrivilegedAccessDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState<'host' | 'admin' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogin() {
    if (!showModal || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(password, showModal);
      setShowModal(null);
      setPassword('');
      setOpen(false);
      navigate(showModal === 'admin' ? '/admin' : '/host');
    } catch (e: any) {
      setError(e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          className="ps-link flex items-center gap-1"
          onClick={() => setOpen(!open)}
        >
          Privileged Access
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-36 rounded-lg border border-slate-700 bg-slate-900 shadow-lg z-50">
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-800 rounded-t-lg"
              onClick={() => { setShowModal('host'); setOpen(false); setError(''); setPassword(''); }}
            >
              Host
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-800 rounded-b-lg"
              onClick={() => { setShowModal('admin'); setOpen(false); setError(''); setPassword(''); }}
            >
              Admin
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">
              {showModal === 'admin' ? 'Admin' : 'Host'} Login
            </h2>
            <input
              type="password"
              className="ps-input w-full mb-3"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
            <div className="flex gap-2">
              <button
                className="ps-btn flex-1"
                onClick={handleLogin}
                disabled={loading || !password.trim()}
              >
                {loading ? 'Checking...' : 'Login'}
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800"
                onClick={() => setShowModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [theme, setTheme] = useState<string>('purple-blue');
  const [bannerPath, setBannerPath] = useState<string | null>(null);

  useEffect(() => {
    getBranding()
      .then((b) => {
        setTheme(b.theme || 'purple-blue');
        setBannerPath(b.bannerPath || null);
      })
      .catch(() => {
        setTheme('purple-blue');
        setBannerPath(null);
      });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const headerStyle = useMemo(() => {
    if (!bannerPath) return undefined;
    return {
      backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.35), rgba(2,6,23,0.92)), url(${bannerPath})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    } as const;
  }, [bannerPath]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800/60" style={headerStyle}>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-bold tracking-tight">Purple Sphinx</div>
              <div className="text-base text-slate-300/80">Quiz game and voting platform</div>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <Link className="ps-link" to="/">Play</Link>
              <PrivilegedAccessDropdown />
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/room" element={<PlayerRoom />} />
          <Route path="/host" element={<HostRoom />} />
          <Route path="/leaderboard/:roomCode" element={<LeaderboardPage />} />
          <Route path="/admin/*" element={<AdminDashboard onBrandingChanged={(b) => { setTheme(b.theme); setBannerPath(b.bannerPath); }} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-slate-400/80 text-center">
        Crafted with <span className="text-purple-400">♡</span> by the RoarinPenguin
      </footer>
    </div>
  );
}
