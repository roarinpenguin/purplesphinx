import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../socket';

type SessionState = {
  roomCode: string;
  phase: 'lobby' | 'question' | 'results';
  currentQuestionId: string | null;
  endsAt: number | null;
  players: { id: string; nickname: string }[];
  scores: { playerId: string; score: number }[];
};

export default function LeaderboardPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const onState = (s: SessionState) => setState(s);
    socket.on('session:state', onState);

    // Join as spectator to receive state updates
    socket.emit('spectator:join', { roomCode }, (ack: any) => {
      if (!ack?.ok) {
        setError(ack?.error || 'Failed to join room');
        return;
      }
      setState(ack.state);
    });

    return () => {
      socket.off('session:state', onState);
    };
  }, [roomCode]);

  const scoresById = useMemo(
    () => new Map((state?.scores || []).map((s) => [s.playerId, s.score])),
    [state]
  );

  const leaderboard = useMemo(() => {
    const players = state?.players || [];
    return [...players]
      .map((p) => ({ ...p, score: scoresById.get(p.id) || 0 }))
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  }, [state, scoresById]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-8">
        <div className="text-center">
          <div className="mx-auto inline-block rounded-2xl p-3" style={{ backgroundColor: '#e8e4df' }}>
            <img src="/logo.png" alt="Purple Sphinx" className="h-28 w-auto" />
          </div>
          <div className="mt-4 text-xl text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto inline-block rounded-2xl p-3" style={{ backgroundColor: '#e8e4df' }}>
            <img src="/logo.png" alt="Purple Sphinx" className="h-24 w-auto" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">Leaderboard</div>
          <div className="mt-1 text-sm text-slate-400">Room: {roomCode}</div>
          <div className="mt-1 text-xs text-slate-500">
            Phase: {state?.phase || 'Connecting...'}
          </div>
        </div>

        <div className="grid gap-3">
          {leaderboard.length === 0 ? (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-6 text-center text-slate-400">
              Waiting for players...
            </div>
          ) : (
            leaderboard.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-all ${
                  idx === 0
                    ? 'border-yellow-500/60 bg-yellow-500/10'
                    : idx === 1
                    ? 'border-slate-400/60 bg-slate-400/10'
                    : idx === 2
                    ? 'border-orange-600/60 bg-orange-600/10'
                    : 'border-slate-700/60 bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                      idx === 0
                        ? 'bg-yellow-500 text-yellow-950'
                        : idx === 1
                        ? 'bg-slate-400 text-slate-900'
                        : idx === 2
                        ? 'bg-orange-600 text-orange-950'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="text-lg font-semibold text-white">{p.nickname}</div>
                </div>
                <div className="text-2xl font-bold text-purple-400">{p.score}</div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          {leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
