import { useState, useEffect } from 'react';
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, type User } from '../../api';

export default function AdminUsers({ adminToken }: { adminToken: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'host' as 'admin' | 'host' });

  useEffect(() => {
    reload();
  }, [adminToken]);

  async function reload() {
    try {
      const data = await adminListUsers(adminToken);
      setUsers(data);
      setStatus(null);
    } catch (e: any) {
      setStatus(e?.message || 'Failed to load users');
    }
  }

  async function handleSave() {
    if (!form.username.trim() || !form.password.trim()) {
      setStatus('Username and password required');
      return;
    }
    try {
      if (editingId) {
        await adminUpdateUser(adminToken, editingId, {
          username: form.username,
          password: form.password,
          role: form.role
        });
      } else {
        await adminCreateUser(adminToken, form.username, form.password, form.role);
      }
      setForm({ username: '', password: '', role: 'host' });
      setEditingId(null);
      await reload();
      setStatus('Saved');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await adminDeleteUser(adminToken, id);
      await reload();
      setStatus('Deleted');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to delete');
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setForm({ username: user.username, password: '', role: user.role });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ username: '', password: '', role: 'host' });
  }

  return (
    <div className="ps-card rounded-2xl p-6">
      <div className="text-xl font-semibold mb-4">User Management</div>
      <div className="text-sm text-slate-300/80 mb-6">
        Create and manage users with Host or Admin roles. Each role has its own password.
      </div>

      {status && (
        <div className={`mb-4 text-sm ${status.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
          {status}
        </div>
      )}

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Username</label>
            <input
              className="ps-input w-full"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <input
              className="ps-input w-full"
              type="password"
              placeholder={editingId ? 'New password (leave empty to keep)' : 'Password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Role</label>
            <select
              className="ps-input w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'host' })}
            >
              <option value="host">Host</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="ps-btn" onClick={handleSave}>
            {editingId ? 'Update User' : 'Create User'}
          </button>
          {editingId && (
            <button className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-700/60 pt-4">
        <div className="text-sm font-medium mb-3">Existing Users</div>
        {users.length === 0 ? (
          <div className="text-sm text-slate-400">No users found</div>
        ) : (
          <div className="grid gap-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{user.username}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    user.role === 'admin' ? 'bg-purple-600/30 text-purple-300' : 'bg-blue-600/30 text-blue-300'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-slate-400 hover:text-white"
                    onClick={() => startEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(user.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
