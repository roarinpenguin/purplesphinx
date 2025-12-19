// Use relative URLs - Vite proxy forwards to backend
export const API_URL = '';

export type Branding = {
  theme: string;
  bannerPath: string | null;
};

export type QuestionType = 'truefalse' | 'multi' | 'open';

export type QuestionOption = { id: string; label: string };

export type Question = {
  id: string;
  type: QuestionType;
  promptHtml: string;
  imagePath: string | null;
  options: QuestionOption[] | null;
  correct: unknown;
  points: number;
  setId?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuestionSet = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

export async function getBranding(): Promise<Branding> {
  const r = await fetch(`${API_URL}/api/branding`);
  if (!r.ok) throw new Error('Failed to load branding');
  return r.json();
}

export async function adminListQuestions(adminToken: string): Promise<Question[]> {
  const url = `${API_URL}/api/admin/questions`;
  console.log('[PurpleSphinx] Loading questions from', url);
  try {
    const r = await fetch(url, {
      headers: { 'x-admin-token': adminToken }
    });
    console.log('[PurpleSphinx] Questions response:', r.status, r.statusText);
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Failed to load questions: ${r.status} ${text}`);
    }
    return r.json();
  } catch (e: any) {
    console.error('[PurpleSphinx] Questions fetch error:', e);
    throw e;
  }
}

export async function adminDeleteQuestion(adminToken: string, id: string): Promise<void> {
  const r = await fetch(`${API_URL}/api/admin/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to delete');
}

export async function adminUpsertQuestion(params: {
  adminToken: string;
  id?: string;
  type: QuestionType;
  promptHtml: string;
  image?: File | null;
  options?: QuestionOption[] | null;
  correct?: unknown;
  points: number;
  setId?: string;
}): Promise<Question> {
  const fd = new FormData();
  fd.set('type', params.type);
  fd.set('promptHtml', params.promptHtml);
  fd.set('points', String(params.points ?? 0));
  fd.set('setId', params.setId || 'default');
  if (params.image) fd.set('image', params.image);
  if (params.options != null) fd.set('optionsJson', JSON.stringify(params.options));
  if (params.correct != null) fd.set('correctJson', JSON.stringify(params.correct));

  const method = params.id ? 'PUT' : 'POST';
  const url = params.id ? `${API_URL}/api/admin/questions/${encodeURIComponent(params.id)}` : `${API_URL}/api/admin/questions`;
  console.log('[PurpleSphinx] Saving question to', url, 'method:', method);
  try {
    const r = await fetch(url, {
      method,
      body: fd,
      headers: { 'x-admin-token': params.adminToken }
    });
    console.log('[PurpleSphinx] Save response:', r.status, r.statusText);
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Failed to save: ${r.status} ${text}`);
    }
    return r.json();
  } catch (e: any) {
    console.error('[PurpleSphinx] Save fetch error:', e);
    throw e;
  }
}

export async function adminUpdateBranding(params: { adminToken: string; theme: string; banner?: File | null }): Promise<Branding> {
  const fd = new FormData();
  fd.set('theme', params.theme);
  if (params.banner) fd.set('banner', params.banner);

  const r = await fetch(`${API_URL}/api/admin/branding`, {
    method: 'POST',
    body: fd,
    headers: { 'x-admin-token': params.adminToken }
  });
  if (!r.ok) throw new Error('Failed to save branding');
  return r.json();
}

// Question Sets API
export async function adminListQuestionSets(adminToken: string): Promise<QuestionSet[]> {
  const r = await fetch(`${API_URL}/api/admin/question-sets`, {
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to load question sets');
  return r.json();
}

export async function adminCreateQuestionSet(adminToken: string, name: string, description: string): Promise<QuestionSet> {
  const r = await fetch(`${API_URL}/api/admin/question-sets`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  if (!r.ok) throw new Error('Failed to create question set');
  return r.json();
}

export async function adminUpdateQuestionSet(adminToken: string, id: string, name: string, description: string): Promise<QuestionSet> {
  const r = await fetch(`${API_URL}/api/admin/question-sets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  if (!r.ok) throw new Error('Failed to update question set');
  return r.json();
}

export async function adminDeleteQuestionSet(adminToken: string, id: string): Promise<void> {
  const r = await fetch(`${API_URL}/api/admin/question-sets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to delete question set');
}

// Auth API (public - no admin token required)
export type LoginResult = { ok: boolean; role: string; username: string };

export async function login(password: string, role: 'admin' | 'host'): Promise<LoginResult> {
  const r = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, role })
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({ error: 'Invalid credentials' }));
    throw new Error(data.error || 'Invalid credentials');
  }
  return r.json();
}

// User management API
export type User = {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'host';
  createdAt: string;
};

export async function adminListUsers(adminToken: string): Promise<User[]> {
  const r = await fetch(`${API_URL}/api/admin/users`, {
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to load users');
  return r.json();
}

export async function adminCreateUser(adminToken: string, username: string, password: string, role: 'admin' | 'host'): Promise<User> {
  const r = await fetch(`${API_URL}/api/admin/users`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });
  if (!r.ok) throw new Error('Failed to create user');
  return r.json();
}

export async function adminUpdateUser(adminToken: string, id: string, data: { username?: string; password?: string; role?: 'admin' | 'host' }): Promise<User> {
  const r = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('Failed to update user');
  return r.json();
}

export async function adminDeleteUser(adminToken: string, id: string): Promise<void> {
  const r = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to delete user');
}

// Player archive API
export type ArchivedPlayer = {
  id: string;
  persistentId: string;
  nickname: string;
  email: string;
  roomCode: string;
  joinedAt: string;
};

export async function adminListPlayerArchive(adminToken: string): Promise<ArchivedPlayer[]> {
  const r = await fetch(`${API_URL}/api/admin/player-archive`, {
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to load player archive');
  return r.json();
}

export async function adminDeleteArchivedPlayer(adminToken: string, id: string): Promise<void> {
  const r = await fetch(`${API_URL}/api/admin/player-archive/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken }
  });
  if (!r.ok) throw new Error('Failed to delete archived player');
}
