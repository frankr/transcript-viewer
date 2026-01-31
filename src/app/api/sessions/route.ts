import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionFile } from '@/types/session';

const SESSIONS_DIR = path.join(os.homedir(), '.clawdbot/agents/main/sessions');

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function GET() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return NextResponse.json({ sessions: [], error: 'Sessions directory not found' });
    }

    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(filename => {
        const filepath = path.join(SESSIONS_DIR, filename);
        const stats = fs.statSync(filepath);
        return {
          id: filename.replace('.jsonl', ''),
          filename,
          modifiedTime: stats.mtime.toISOString(),
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
        } as SessionFile;
      })
      .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());

    return NextResponse.json({ sessions: files });
  } catch (error) {
    console.error('Error reading sessions:', error);
    return NextResponse.json({ sessions: [], error: String(error) }, { status: 500 });
  }
}
