import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DATA = {
  branding: {
    theme: 'purple-blue',
    bannerPath: null
  },
  users: [
    { id: 'admin_default', username: 'admin', password: 'admin123', role: 'admin', createdAt: new Date().toISOString() },
    { id: 'host_default', username: 'host', password: 'host123', role: 'host', createdAt: new Date().toISOString() }
  ],
  playerArchive: [],
  questionSets: [
    { id: 'default', name: 'Default', description: 'Default question set', createdAt: new Date().toISOString() }
  ],
  questions: [
    {
      id: 'seed_truefalse_1',
      type: 'truefalse',
      promptHtml: '<p><strong>True or False:</strong> Purple Sphinx is a quiz and voting platform.</p>',
      imagePath: null,
      options: null,
      correct: 'true',
      points: 100,
      setId: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'seed_multi_1',
      type: 'multi',
      promptHtml: '<p>Select the <em>purple/blue</em> tones:</p>',
      imagePath: null,
      options: [
        { id: '1', label: 'Purple' },
        { id: '2', label: 'Blue' },
        { id: '3', label: 'Grey' }
      ],
      correct: ['1', '2'],
      points: 200,
      setId: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

export function getDataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

function dataFilePath() {
  return path.join(getDataDir(), 'db.json');
}

export async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.mkdir(path.join(getDataDir(), 'uploads'), { recursive: true });
}

export async function readDb() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(dataFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    await writeDb(DEFAULT_DATA);
    return structuredClone(DEFAULT_DATA);
  }
}

export async function writeDb(db) {
  await ensureDataDir();
  await fs.writeFile(dataFilePath(), JSON.stringify(db, null, 2), 'utf8');
}
