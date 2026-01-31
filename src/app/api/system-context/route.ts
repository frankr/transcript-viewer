import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface SystemContextFile {
  name: string;
  filename: string;
  path: string;
  exists: boolean;
  content: string | null;
  size: number;
  sizeFormatted: string;
}

const WORKSPACE_DIR = path.join(os.homedir(), 'clawd');

const CONTEXT_FILES = [
  { name: 'AGENTS.md', filename: 'AGENTS.md' },
  { name: 'SOUL.md', filename: 'SOUL.md' },
  { name: 'USER.md', filename: 'USER.md' },
  { name: 'TOOLS.md', filename: 'TOOLS.md' },
  { name: 'MEMORY.md', filename: 'MEMORY.md' },
  { name: 'HEARTBEAT.md', filename: 'HEARTBEAT.md' },
  { name: 'IDENTITY.md', filename: 'IDENTITY.md' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function GET() {
  try {
    const files: SystemContextFile[] = CONTEXT_FILES.map(({ name, filename }) => {
      const filepath = path.join(WORKSPACE_DIR, filename);
      
      if (!fs.existsSync(filepath)) {
        return {
          name,
          filename,
          path: filepath,
          exists: false,
          content: null,
          size: 0,
          sizeFormatted: '0 B',
        };
      }

      try {
        const stats = fs.statSync(filepath);
        const content = fs.readFileSync(filepath, 'utf-8');
        
        return {
          name,
          filename,
          path: filepath,
          exists: true,
          content,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
        };
      } catch {
        return {
          name,
          filename,
          path: filepath,
          exists: false,
          content: null,
          size: 0,
          sizeFormatted: '0 B',
        };
      }
    });

    const existingFiles = files.filter(f => f.exists);
    const totalSize = existingFiles.reduce((acc, f) => acc + f.size, 0);

    return NextResponse.json({
      files,
      summary: {
        total: CONTEXT_FILES.length,
        existing: existingFiles.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
      },
    });
  } catch (error) {
    console.error('Error reading system context:', error);
    return NextResponse.json({ files: [], error: String(error) }, { status: 500 });
  }
}
