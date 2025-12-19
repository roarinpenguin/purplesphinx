import { useEffect, useMemo, useState } from 'react';
import { socket } from '../socket';
import { adminListQuestions, adminListQuestionSets, API_URL, Question, QuestionSet } from '../api';

type SessionState = {
  roomCode: string;
  phase: 'lobby' | 'question' | 'results';
  currentQuestionId: string | null;
  endsAt: number | null;
  players: { id: string; nickname: string }[];
  scores: { playerId: string; score: number }[];
};

export default function HostRoom() {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('ps:adminToken') || 'changeme-admin-token');
  const [roomCode, setRoomCode] = useState<string | null>(() => sessionStorage.getItem('ps:hostRoomCode'));
  const [state, setState] = useState<SessionState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [filterSetId, setFilterSetId] = useState<string>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [durationSec, setDurationSec] = useState<number>(20);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onState = (s: SessionState) => setState(s);
    socket.on('session:state', onState);

    // Try to rejoin existing room on mount/reconnect
    const savedRoomCode = sessionStorage.getItem('ps:hostRoomCode');
    if (savedRoomCode) {
      socket.emit('host:rejoinRoom', { roomCode: savedRoomCode }, (ack: any) => {
        if (ack?.ok) {
          setRoomCode(ack.roomCode);
          setState(ack.state);
          setError(null);
        } else {
          // Room no longer exists, clear saved code
          sessionStorage.removeItem('ps:hostRoomCode');
          setRoomCode(null);
        }
      });
    }

    // Also rejoin on socket reconnect
    const onConnect = () => {
      const code = sessionStorage.getItem('ps:hostRoomCode');
      if (code) {
        socket.emit('host:rejoinRoom', { roomCode: code }, (ack: any) => {
          if (ack?.ok) {
            setState(ack.state);
          }
        });
      }
    };
    socket.on('connect', onConnect);

    return () => {
      socket.off('session:state', onState);
      socket.off('connect', onConnect);
    };
  }, []);

  async function loadQuestions() {
    try {
      localStorage.setItem('ps:adminToken', adminToken);
      const [qs, sets] = await Promise.all([
        adminListQuestions(adminToken),
        adminListQuestionSets(adminToken)
      ]);
      setQuestions(qs);
      setQuestionSets(sets);
      if (!selectedQuestionId && qs[0]) setSelectedQuestionId(qs[0].id);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load questions');
    }
  }

  const filteredQuestions = useMemo(() => {
    if (filterSetId === 'all') return questions;
    return questions.filter(q => (q.setId || 'default') === filterSetId);
  }, [questions, filterSetId]);

  function openLeaderboard() {
    const url = `${window.location.origin}/leaderboard/${roomCode}`;
    window.open(url, 'leaderboard', 'width=600,height=800');
  }

  async function createRoom() {
    socket.emit('host:createRoom', (ack: any) => {
      if (!ack?.ok) {
        setError(ack?.error || 'Failed to create room');
        return;
      }
      setRoomCode(ack.roomCode);
      setState(ack.state);
      setError(null);
      // Save room code so host can rejoin after navigation
      sessionStorage.setItem('ps:hostRoomCode', ack.roomCode);
    });
  }

  function closeRoom() {
    sessionStorage.removeItem('ps:hostRoomCode');
    setRoomCode(null);
    setState(null);
  }

  async function startQuestion() {
    if (!roomCode) return;
    if (!selectedQuestionId) return;
    socket.emit('host:startQuestion', { roomCode, questionId: selectedQuestionId, durationSec }, (ack: any) => {
      if (!ack?.ok) setError(ack?.error || 'Failed to start');
      else setError(null);
    });
  }

  async function finishQuestion() {
    if (!roomCode) return;
    socket.emit('host:finishQuestion', { roomCode }, (ack: any) => {
      if (!ack?.ok) setError(ack?.error || 'Failed');
      else setError(null);
    });
  }

  const playersCount = state?.players?.length || 0;
  const scoresById = useMemo(() => new Map((state?.scores || []).map((s) => [s.playerId, s.score])), [state]);
  const leaderboard = useMemo(() => {
    const players = state?.players || [];
    return [...players]
      .map((p) => ({ ...p, score: scoresById.get(p.id) || 0 }))
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  }, [state, scoresById]);

  return (
    <div className="grid gap-6">
      <div className="ps-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">Host console</div>
            <div className="mt-1 text-sm text-slate-300/80">Create a room, start questions, show results and leaderboard.</div>
          </div>
          <div className="text-right text-xs text-slate-400/80">
            Backend: <span className="text-slate-200">{API_URL}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-300/90">Admin token (used to fetch questions)</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <button className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm" type="button" onClick={loadQuestions}>
              Load questions
            </button>
            <button className="ps-btn rounded-xl px-4 py-3 text-sm font-semibold" type="button" onClick={createRoom}>
              Create room
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

        {roomCode ? (
          <div className="mt-5 rounded-2xl border border-slate-700/60 bg-slate-950/30 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400/80">Room code</div>
                <div className="mt-1 text-3xl font-semibold tracking-widest">{roomCode}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-400/80">Players</div>
                  <div className="mt-1 text-lg font-semibold">{playersCount}</div>
                </div>
                <button 
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20"
                  onClick={closeRoom}
                  type="button"
                >
                  Close Room
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="ps-card rounded-2xl p-6">
          <div className="text-lg font-semibold">Ask a question</div>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-2">
                <label className="text-xs text-slate-300/90">Question</label>
                <select
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {filteredQuestions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.type.toUpperCase()} · {stripHtml(q.promptHtml).slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-slate-300/90">Filter by Set</label>
                <select
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                  value={filterSetId}
                  onChange={(e) => setFilterSetId(e.target.value)}
                >
                  <option value="all">All Sets</option>
                  {questionSets.map((qs) => (
                    <option key={qs.id} value={qs.id}>{qs.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-300/90">Countdown (seconds)</label>
              <input
                type="number"
                min={5}
                max={120}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button className="ps-btn rounded-xl px-5 py-3 text-sm font-semibold" type="button" onClick={startQuestion}>
                Start
              </button>
              <button className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-5 py-3 text-sm" type="button" onClick={finishQuestion}>
                Finish now
              </button>
              <div className="ml-auto text-xs text-slate-400/80">Phase: {state?.phase || '—'}</div>
            </div>
          </div>
        </div>

        <div className="ps-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Leaderboard</div>
            {roomCode && (
              <button
                className="rounded-lg border border-slate-700/60 bg-slate-950/30 px-3 py-1.5 text-xs hover:bg-slate-800/40"
                type="button"
                onClick={openLeaderboard}
              >
                Open in Window
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {leaderboard.length === 0 ? (
              <div className="text-sm text-slate-300/80">No players yet.</div>
            ) : (
              leaderboard.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm">
                  <div>
                    <span className="mr-2 text-slate-400/80">#{idx + 1}</span>
                    <span className="font-semibold">{p.nickname}</span>
                  </div>
                  <div className="font-semibold">{p.score}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
