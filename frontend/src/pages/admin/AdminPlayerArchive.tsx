import { useState, useEffect } from 'react';
import { adminListPlayerArchive, adminDeleteArchivedPlayer, type ArchivedPlayer } from '../../api';

export default function AdminPlayerArchive({ adminToken }: { adminToken: string }) {
  const [players, setPlayers] = useState<ArchivedPlayer[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    reload();
  }, [adminToken]);

  async function reload() {
    try {
      const data = await adminListPlayerArchive(adminToken);
      setPlayers(data);
      setStatus(null);
    } catch (e: any) {
      setStatus(e?.message || 'Failed to load player archive');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this player from archive?')) return;
    try {
      await adminDeleteArchivedPlayer(adminToken, id);
      await reload();
      setStatus('Deleted');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to delete');
    }
  }

  const filteredPlayers = players.filter(p => 
    p.nickname.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.roomCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ps-card rounded-2xl p-6">
      <div className="text-xl font-semibold mb-4">Player Archive</div>
      <div className="text-sm text-slate-300/80 mb-6">
        All players who have joined quiz sessions are archived here with their name and email.
      </div>

      {status && (
        <div className={`mb-4 text-sm ${status.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
          {status}
        </div>
      )}

      <div className="mb-4">
        <input
          className="ps-input w-full"
          placeholder="Search by name, email, or room code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="text-sm text-slate-400 mb-3">
        {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} in archive
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="text-sm text-slate-400">No players found</div>
      ) : (
        <div className="grid gap-2 max-h-96 overflow-y-auto">
          {filteredPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{player.nickname}</div>
                <div className="text-xs text-slate-400 truncate">{player.email || 'No email'}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Room: {player.roomCode} • {new Date(player.joinedAt).toLocaleString()}
                </div>
              </div>
              <button
                className="ml-3 text-xs text-red-400 hover:text-red-300 flex-shrink-0"
                onClick={() => handleDelete(player.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
