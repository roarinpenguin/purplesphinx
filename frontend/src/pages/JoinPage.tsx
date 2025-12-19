import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function JoinPage() {
  const nav = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const last = sessionStorage.getItem('ps:lastRoomCode');
    if (last) setRoomCode(last);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    if (!nickname.trim()) return;

    sessionStorage.setItem('ps:player', JSON.stringify({ roomCode: code, nickname: nickname.trim(), email: email.trim() }));
    sessionStorage.setItem('ps:lastRoomCode', code);
    nav('/room');
  }

  return (
    <div className="grid gap-6">
      <div className="ps-card rounded-2xl p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xl font-semibold">Enter a room</div>
            <div className="mt-1 text-sm text-slate-300/80">Use the code given by your host, pick a nickname and join.</div>
          </div>
          <div className="hidden rounded-2xl p-3 md:block" style={{ backgroundColor: '#e8e4df' }}>
            <img src="/logo.png" alt="Purple Sphinx" className="h-28 w-auto" />
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <label className="text-xs text-slate-300/90">Room code</label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm tracking-widest outline-none focus:border-slate-400/60"
              placeholder="ABC123"
              maxLength={12}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-slate-300/90">Nickname</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
              placeholder="PurpleSphinxFan"
              maxLength={40}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-slate-300/90">Email (optional)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
              placeholder="you@company.com"
              maxLength={120}
              type="email"
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400/80">By joining, you agree to be identified by nickname (and optionally email) within this room.</div>
            <button className="ps-btn rounded-xl px-5 py-3 text-sm font-semibold shadow-lg shadow-black/30" type="submit">
              Join
            </button>
          </div>
        </form>
      </div>

      <div className="ps-card rounded-2xl p-5 text-sm text-slate-200/90">
        <div className="font-semibold">Tip</div>
        <div className="mt-1 text-slate-300/80">If you are hosting, open the Host page and create a room code.</div>
      </div>
    </div>
  );
}
