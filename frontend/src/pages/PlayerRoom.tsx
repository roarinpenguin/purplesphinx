import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { API_URL, Question } from '../api';

type PlayerInfo = { roomCode: string; nickname: string; email: string };

type SessionState = {
  roomCode: string;
  phase: 'lobby' | 'question' | 'results';
  currentQuestionId: string | null;
  endsAt: number | null;
  players: { id: string; nickname: string }[];
  scores: { playerId: string; score: number }[];
};

export default function PlayerRoom() {
  const nav = useNavigate();
  const [player, setPlayer] = useState<{ id: string; nickname: string } | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [question, setQuestion] = useState<Pick<Question, 'id' | 'type' | 'promptHtml' | 'imagePath' | 'options' | 'points'> | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [answerTF, setAnswerTF] = useState<'true' | 'false' | ''>('');
  const [answerOpen, setAnswerOpen] = useState('');
  const [answerMulti, setAnswerMulti] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const countdown = useMemo(() => {
    if (!endsAt) return null;
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  }, [endsAt, now]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem('ps:player');
    if (!raw) {
      nav('/');
      return;
    }

    const info: PlayerInfo = JSON.parse(raw);
    
    // Get or create persistent ID for this player session
    let persistentId = sessionStorage.getItem('ps:persistentId');
    if (!persistentId) {
      // Fallback for browsers without crypto.randomUUID (older iOS, non-HTTPS)
      persistentId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      sessionStorage.setItem('ps:persistentId', persistentId);
    }

    const onState = (s: SessionState) => setState(s);
    const onShow = (payload: any) => {
      setResults(null);
      setQuestion(payload.question);
      setEndsAt(payload.endsAt);
      setAnswerTF('');
      setAnswerOpen('');
      setAnswerMulti({});
      setSubmitted(false); // Reset submitted state for new question
    };
    const onResults = (payload: any) => {
      setResults(payload);
      setEndsAt(null);
    };

    socket.on('session:state', onState);
    socket.on('question:show', onShow);
    socket.on('question:results', onResults);

    // Join with persistentId to prevent duplicates on reconnect
    const doJoin = () => {
      socket.emit('player:join', { 
        roomCode: info.roomCode, 
        nickname: info.nickname, 
        email: info.email,
        persistentId 
      }, (ack: any) => {
        if (!ack?.ok) {
          setError(ack?.error || 'Failed to join');
          return;
        }
        setPlayer(ack.player);
        setState(ack.state);
        // Store the server-assigned player ID
        sessionStorage.setItem('ps:playerId', ack.player.id);
      });
    };
    
    doJoin();
    
    // Rejoin on socket reconnect
    socket.on('connect', doJoin);

    return () => {
      socket.off('session:state', onState);
      socket.off('question:show', onShow);
      socket.off('question:results', onResults);
      socket.off('connect', doJoin);
    };
  }, [nav]);

  const scoreById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of state?.scores || []) m.set(s.playerId, s.score);
    return m;
  }, [state]);

  const leaderboard = useMemo(() => {
    const players = state?.players || [];
    return [...players]
      .map((p) => ({ ...p, score: scoreById.get(p.id) || 0 }))
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  }, [state, scoreById]);

  function submitAnswer() {
    if (!question) return;
    if (submitted || submitting) return;

    let answer: any = null;
    if (question.type === 'truefalse') {
      if (!answerTF) return;
      answer = answerTF;
    } else if (question.type === 'open') {
      if (!answerOpen.trim()) return;
      answer = answerOpen.trim().slice(0, 1000);
    } else if (question.type === 'multi') {
      const picked = Object.entries(answerMulti)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (picked.length === 0) return;
      answer = picked;
    }

    setSubmitting(true);
    socket.emit('player:answer', { answer }, (ack: any) => {
      setSubmitting(false);
      if (!ack?.ok) {
        setError(ack?.error || 'Failed to submit');
      } else {
        setError(null);
        setSubmitted(true);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="ps-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Room {state?.roomCode || '...'}</div>
            <div className="mt-1 text-sm text-slate-300/80">
              Connected to <span className="text-slate-200">{API_URL}</span> as{' '}
              <span className="text-slate-200">{player?.nickname || '...'}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400/80">Phase</div>
            <div className="text-sm font-semibold">{state?.phase || '...'}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="ps-card rounded-2xl border border-red-500/40 p-4 text-sm text-red-100">{error}</div>
      ) : null}

      {state?.phase === 'lobby' ? (
        <div className="ps-card rounded-2xl p-6">
          <div className="text-xl font-semibold">Waiting for the host…</div>
          <div className="mt-2 text-sm text-slate-300/80">When the question starts, you’ll see a countdown and the answer form.</div>
        </div>
      ) : null}

      {state?.phase === 'question' && question ? (
        <div className="ps-card rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm text-slate-300/80">Answer quickly for the best experience.</div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-2 text-sm">
              <span className="text-slate-400/80">Time:</span> <span className="font-semibold">{countdown ?? '—'}s</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="text-lg font-semibold" dangerouslySetInnerHTML={{ __html: question.promptHtml }} />
            {question.imagePath ? <img className="max-h-[320px] w-full rounded-xl object-contain" src={question.imagePath} /> : null}

            {question.type === 'truefalse' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${answerTF === 'true' ? 'border-slate-200/60 bg-slate-200/10' : 'border-slate-700/60 bg-slate-950/30'}`}
                  onClick={() => setAnswerTF('true')}
                  type="button"
                >
                  True
                </button>
                <button
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${answerTF === 'false' ? 'border-slate-200/60 bg-slate-200/10' : 'border-slate-700/60 bg-slate-950/30'}`}
                  onClick={() => setAnswerTF('false')}
                  type="button"
                >
                  False
                </button>
              </div>
            ) : null}

            {question.type === 'open' ? (
              <div className="grid gap-2">
                <textarea
                  className="min-h-[120px] w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                  value={answerOpen}
                  onChange={(e) => setAnswerOpen(e.target.value)}
                  maxLength={1000}
                  placeholder="Type your answer (max 1000 chars)…"
                />
                <div className="text-right text-xs text-slate-400/80">{answerOpen.length}/1000</div>
              </div>
            ) : null}

            {question.type === 'multi' ? (
              <div className="grid gap-2">
                {(question.options || []).map((o) => (
                  <label key={o.id} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={!!answerMulti[o.id]}
                      onChange={(e) => setAnswerMulti((m) => ({ ...m, [o.id]: e.target.checked }))}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400/80">Points: {question.points}</div>
              <button 
                className={`rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                  submitted 
                    ? 'ps-btn brightness-125 saturate-150 cursor-default' 
                    : submitting 
                      ? 'ps-btn opacity-70 cursor-wait'
                      : 'ps-btn'
                }`}
                type="button" 
                onClick={submitAnswer}
                disabled={submitted || submitting}
              >
                {submitted ? '✓ Submitted!' : submitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state?.phase === 'results' ? (
        <div className="grid gap-6">
          <div className="ps-card rounded-2xl p-6">
            <div className="text-xl font-semibold">Results</div>
            <div className="mt-3 text-sm text-slate-300/80">
              {results?.stats?.total != null ? `Total answers: ${results.stats.total}` : 'Waiting for results payload…'}
            </div>

            {results?.stats?.counts ? (
              <div className="mt-4 grid gap-2">
                {Object.entries(results.stats.counts).map(([k, v]: any) => (
                  <div key={k} className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm">
                    <div className="text-slate-200">{k}</div>
                    <div className="font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {results?.stats?.true != null ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm">
                  <div className="text-slate-400/80">True</div>
                  <div className="text-lg font-semibold">{results.stats.true}</div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm">
                  <div className="text-slate-400/80">False</div>
                  <div className="text-lg font-semibold">{results.stats.false}</div>
                </div>
              </div>
            ) : null}

            {results?.stats?.samples ? (
              <div className="mt-4 grid gap-2">
                {(results.stats.samples as string[]).map((s, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm text-slate-200">
                    {s}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ps-card rounded-2xl p-6">
            <div className="text-xl font-semibold">Leaderboard</div>
            <div className="mt-4 grid gap-2">
              {leaderboard.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm">
                  <div>
                    <span className="text-slate-400/80 mr-2">#{idx + 1}</span>
                    <span className="font-semibold text-slate-100">{p.nickname}</span>
                    {p.id === player?.id ? <span className="ml-2 text-xs text-slate-400/80">(you)</span> : null}
                  </div>
                  <div className="font-semibold">{p.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
