import { useEffect, useMemo, useState } from 'react';
import { adminDeleteQuestion, adminListQuestions, adminUpsertQuestion, adminListQuestionSets, adminCreateQuestionSet, adminDeleteQuestionSet, Question, QuestionOption, QuestionType, QuestionSet } from '../../api';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export default function AdminQuestions({ adminToken }: { adminToken: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [type, setType] = useState<QuestionType>('truefalse');
  const [points, setPoints] = useState<number>(100);
  const [image, setImage] = useState<File | null>(null);
  const [optionsText, setOptionsText] = useState<string>('Option A\nOption B\nOption C');
  const [correctTF, setCorrectTF] = useState<'true' | 'false'>('true');
  const [correctMultiText, setCorrectMultiText] = useState<string>('');
  const [setId, setSetId] = useState<string>('default');
  const [filterSetId, setFilterSetId] = useState<string>('all');
  const [newSetName, setNewSetName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const selected = useMemo(() => questions.find((q) => q.id === selectedId) || null, [questions, selectedId]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Type your question…</p>'
  });

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    if (!editor) return;
    if (!selected) return;
    editor.commands.setContent(selected.promptHtml);
    setType(selected.type);
    setPoints(selected.points || 0);
    setSetId(selected.setId || 'default');

    if (selected.type === 'multi') {
      const opts = (selected.options || []) as QuestionOption[];
      setOptionsText(opts.map((o) => o.label).join('\n'));
      const correct = Array.isArray(selected.correct) ? (selected.correct as any[]).join(',') : '';
      setCorrectMultiText(correct);
    }

    if (selected.type === 'truefalse') {
      setCorrectTF(String(selected.correct) === 'false' ? 'false' : 'true');
    }
  }, [editor, selected]);

  async function reload() {
    try {
      const [qs, sets] = await Promise.all([
        adminListQuestions(adminToken),
        adminListQuestionSets(adminToken)
      ]);
      console.log('[DEBUG] Questions loaded:', qs.map(q => ({ id: q.id, setId: q.setId })));
      console.log('[DEBUG] Sets loaded:', sets.map(s => ({ id: s.id, name: s.name })));
      setQuestions(qs);
      setQuestionSets(sets);
      if (!selectedId && qs[0]) setSelectedId(qs[0].id);
      setStatus(null);
    } catch (e: any) {
      setStatus(e?.message || 'Failed to load');
    }
  }

  const filteredQuestions = useMemo(() => {
    console.log('[DEBUG] Filtering with filterSetId:', filterSetId);
    console.log('[DEBUG] Questions setIds:', questions.map(q => q.setId));
    if (filterSetId === 'all') return questions;
    const filtered = questions.filter(q => (q.setId || 'default') === filterSetId);
    console.log('[DEBUG] Filtered count:', filtered.length);
    return filtered;
  }, [questions, filterSetId]);

  async function createSet() {
    if (!newSetName.trim()) return;
    try {
      await adminCreateQuestionSet(adminToken, newSetName.trim(), '');
      setNewSetName('');
      await reload();
      setStatus('Set created');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to create set');
    }
  }

  async function deleteSet(id: string) {
    if (id === 'default') return;
    try {
      await adminDeleteQuestionSet(adminToken, id);
      if (filterSetId === id) setFilterSetId('all');
      await reload();
      setStatus('Set deleted');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to delete set');
    }
  }

  function newQuestion() {
    setSelectedId(null);
    setType('truefalse');
    setPoints(100);
    setImage(null);
    setOptionsText('Option A\nOption B\nOption C');
    setCorrectTF('true');
    setCorrectMultiText('');
    setSetId(filterSetId === 'all' ? 'default' : filterSetId);
    editor?.commands.setContent('<p>Type your question…</p>');
  }

  async function save() {
    if (!editor) return;

    const promptHtml = editor.getHTML();

    let options: QuestionOption[] | null = null;
    let correct: any = null;

    if (type === 'truefalse') {
      correct = correctTF;
    } else if (type === 'multi') {
      const lines = optionsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      options = lines.map((label, idx) => ({ id: String(idx + 1), label }));

      const wanted = correctMultiText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      correct = wanted;
    } else if (type === 'open') {
      correct = null;
    }

    try {
      const q = await adminUpsertQuestion({
        adminToken,
        id: selectedId || undefined,
        type,
        promptHtml,
        image,
        options,
        correct,
        points,
        setId
      });
      setStatus('Saved');
      await reload();
      setSelectedId(q.id);
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    }
  }

  async function del() {
    if (!selectedId) return;
    try {
      await adminDeleteQuestion(adminToken, selectedId);
      setStatus('Deleted');
      setSelectedId(null);
      await reload();
    } catch (e: any) {
      setStatus(e?.message || 'Failed to delete');
    }
  }

  return (
    <div className="grid gap-6">
      <div className="ps-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Question Sets</div>
            <div className="mt-1 text-sm text-slate-300/80">Organize questions into sets/categories.</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {questionSets.map((qs) => (
            <div key={qs.id} className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-950/30 px-3 py-1.5 text-sm">
              <span>{qs.name}</span>
              <span className="text-xs text-slate-400">({questions.filter(q => (q.setId || 'default') === qs.id).length})</span>
              {qs.id !== 'default' && (
                <button type="button" onClick={() => deleteSet(qs.id)} className="ml-1 text-red-400 hover:text-red-300">×</button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="New set name..."
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              className="w-32 rounded-lg border border-slate-700/60 bg-slate-950/40 px-2 py-1.5 text-sm outline-none"
              onKeyDown={(e) => e.key === 'Enter' && createSet()}
            />
            <button type="button" onClick={createSet} className="rounded-lg border border-slate-700/60 bg-slate-950/30 px-2 py-1.5 text-sm">+</button>
          </div>
        </div>
      </div>

      <div className="ps-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Questions</div>
            <div className="mt-1 text-sm text-slate-300/80">Create / edit / delete questions with rich text + optional image.</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm outline-none"
              value={filterSetId}
              onChange={(e) => setFilterSetId(e.target.value)}
            >
              <option value="all">All Sets</option>
              {questionSets.map((qs) => (
                <option key={qs.id} value={qs.id}>{qs.name}</option>
              ))}
            </select>
            <button className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-2 text-sm" type="button" onClick={reload}>
              Refresh
            </button>
            <button className="ps-btn rounded-xl px-4 py-2 text-sm font-semibold" type="button" onClick={newQuestion}>
              New
            </button>
          </div>
        </div>

        {status ? <div className="mt-4 text-sm text-slate-300/80">{status}</div> : null}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="ps-card rounded-2xl p-4 md:col-span-1">
          <div className="text-sm font-semibold">Library</div>
          <div className="mt-3 grid gap-2">
            {filteredQuestions.length === 0 ? <div className="text-sm text-slate-300/80">No questions yet.</div> : null}
            {filteredQuestions.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedId(q.id)}
                className={`text-left rounded-xl border px-3 py-3 text-sm ${selectedId === q.id ? 'border-slate-200/60 bg-slate-200/10' : 'border-slate-700/60 bg-slate-950/30'}`}
              >
                <div className="text-xs text-slate-400/80">{q.type.toUpperCase()} · {q.points} pts · {questionSets.find(s => s.id === (q.setId || 'default'))?.name || 'Default'}</div>
                <div className="mt-1 font-semibold">{stripHtml(q.promptHtml).slice(0, 60)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="ps-card rounded-2xl p-6 md:col-span-2">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-xs text-slate-300/90">Type</label>
              <select
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
              >
                <option value="truefalse">True / False</option>
                <option value="multi">Multiple choice</option>
                <option value="open">Open text (max 1000 chars)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs text-slate-300/90">Points for correct answer</label>
                <input
                  type="number"
                  min={0}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-slate-300/90">Question Set</label>
                <select
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                  value={setId}
                  onChange={(e) => setSetId(e.target.value)}
                >
                  {questionSets.map((qs) => (
                    <option key={qs.id} value={qs.id}>{qs.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-300/90">Prompt (rich text)</label>
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-3">
                <div className="mb-2 flex flex-wrap gap-2 text-xs">
                  <button className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-2 py-1" type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
                    Bold
                  </button>
                  <button className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-2 py-1" type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                    Italic
                  </button>
                  <button
                    className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-2 py-1"
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  >
                    Bullets
                  </button>
                </div>
                <div className="prose prose-invert max-w-none text-sm">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-slate-300/90">Image (optional)</label>
              <input
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
              {selected?.imagePath ? <div className="text-xs text-slate-400/80">Current: {selected.imagePath}</div> : null}
            </div>

            {type === 'truefalse' ? (
              <div className="grid gap-2">
                <label className="text-xs text-slate-300/90">Correct answer</label>
                <select
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                  value={correctTF}
                  onChange={(e) => setCorrectTF(e.target.value as any)}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            ) : null}

            {type === 'multi' ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <label className="text-xs text-slate-300/90">Options (one per line)</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-300/90">Correct option IDs (comma-separated: 1,2,3…)</label>
                  <input
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-slate-400/60"
                    value={correctMultiText}
                    onChange={(e) => setCorrectMultiText(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            ) : null}

            {type === 'open' ? (
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-4 py-3 text-sm text-slate-300/80">
                Open questions are not auto-scored in this MVP.
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-2">
              <button className="ps-btn rounded-xl px-5 py-3 text-sm font-semibold" type="button" onClick={save}>
                Save
              </button>
              <button
                className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-5 py-3 text-sm"
                type="button"
                onClick={del}
                disabled={!selectedId}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
