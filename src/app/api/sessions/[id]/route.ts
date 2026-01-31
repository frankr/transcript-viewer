import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { SessionEntry, SessionStats, SessionData } from '@/types/session';

const SESSIONS_DIR = path.join(os.homedir(), '.clawdbot/agents/main/sessions');

async function parseJsonlFile(filepath: string): Promise<SessionEntry[]> {
  const entries: SessionEntry[] = [];
  
  const fileStream = fs.createReadStream(filepath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line) as SessionEntry;
        entries.push(entry);
      } catch (e) {
        console.error('Failed to parse line:', e);
      }
    }
  }

  return entries;
}

function computeStats(entries: SessionEntry[]): SessionStats {
  const stats: SessionStats = {
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    toolResults: 0,
    totalTokens: 0,
    totalCost: 0,
    models: {},
  };

  for (const entry of entries) {
    if (entry.type === 'message' && entry.message) {
      stats.totalMessages++;
      
      switch (entry.message.role) {
        case 'user':
          stats.userMessages++;
          break;
        case 'assistant':
          stats.assistantMessages++;
          // Count tool calls in assistant messages
          for (const block of entry.message.content || []) {
            if (block.type === 'toolCall') {
              stats.toolCalls++;
            }
          }
          break;
        case 'toolResult':
          stats.toolResults++;
          break;
      }
    }

    // Track model usage from assistant messages
    if (entry.type === 'message' && entry.message?.role === 'assistant') {
      const msg = entry.message as unknown as { model?: string; usage?: { totalTokens?: number; cost?: { total?: number } } };
      if (msg.model) {
        stats.models[msg.model] = (stats.models[msg.model] || 0) + 1;
      }
      if (msg.usage) {
        stats.totalTokens += msg.usage.totalTokens || 0;
        stats.totalCost += msg.usage.cost?.total || 0;
      }
    }
  }

  return stats;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filepath = path.join(SESSIONS_DIR, `${id}.jsonl`);

    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const entries = await parseJsonlFile(filepath);
    const stats = computeStats(entries);

    const data: SessionData = {
      id,
      entries,
      stats,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading session:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
