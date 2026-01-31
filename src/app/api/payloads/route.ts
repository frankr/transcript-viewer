import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

interface PayloadEntry {
  ts: string;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string;
  stage: 'request' | 'usage';
  payload?: {
    model?: string;
    max_tokens?: number;
    system?: string | Array<{ type: string; text?: string; cache_control?: unknown }>;
    messages?: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
    }>;
    tools?: Array<{
      name: string;
      description?: string;
      input_schema?: unknown;
    }>;
    [key: string]: unknown;
  };
  payloadDigest?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: string;
}

const PAYLOAD_LOG_PATH = path.join(os.homedir(), '.clawdbot', 'logs', 'anthropic-payload.jsonl');

async function readPayloadLog(limit: number = 100): Promise<PayloadEntry[]> {
  if (!fs.existsSync(PAYLOAD_LOG_PATH)) {
    return [];
  }

  const entries: PayloadEntry[] = [];
  const fileStream = fs.createReadStream(PAYLOAD_LOG_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line) as PayloadEntry;
        entries.push(entry);
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Return most recent entries first
  return entries.reverse().slice(0, limit);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function summarizePayload(entry: PayloadEntry) {
  if (!entry.payload) return null;

  const { payload } = entry;
  
  // System prompt analysis
  let systemPromptChars = 0;
  let systemPromptParts: string[] = [];
  
  if (typeof payload.system === 'string') {
    systemPromptChars = payload.system.length;
    systemPromptParts = ['text'];
  } else if (Array.isArray(payload.system)) {
    for (const part of payload.system) {
      if (part.text) {
        systemPromptChars += part.text.length;
      }
      systemPromptParts.push(part.type);
    }
  }

  // Message analysis
  const messageCount = payload.messages?.length ?? 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let messagesChars = 0;

  for (const msg of payload.messages ?? []) {
    if (msg.role === 'user') userMessages++;
    if (msg.role === 'assistant') assistantMessages++;
    
    if (typeof msg.content === 'string') {
      messagesChars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.text) messagesChars += block.text.length;
        if (block.type === 'tool_result' && typeof block.content === 'string') {
          messagesChars += block.content.length;
        }
      }
    }
  }

  // Tool analysis
  const toolCount = payload.tools?.length ?? 0;
  const toolNames = payload.tools?.map(t => t.name) ?? [];
  const toolSchemaChars = JSON.stringify(payload.tools ?? []).length;

  return {
    model: payload.model,
    maxTokens: payload.max_tokens,
    systemPrompt: {
      chars: systemPromptChars,
      estimatedTokens: estimateTokens(systemPromptChars.toString()),
      parts: systemPromptParts,
    },
    messages: {
      total: messageCount,
      user: userMessages,
      assistant: assistantMessages,
      chars: messagesChars,
      estimatedTokens: estimateTokens(messagesChars.toString()),
    },
    tools: {
      count: toolCount,
      names: toolNames.slice(0, 20), // First 20
      schemaChars: toolSchemaChars,
      estimatedTokens: estimateTokens(toolSchemaChars.toString()),
    },
    totalChars: systemPromptChars + messagesChars + toolSchemaChars,
    totalEstimatedTokens: estimateTokens((systemPromptChars + messagesChars + toolSchemaChars).toString()),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const includeRaw = searchParams.get('raw') === 'true';

  try {
    const exists = fs.existsSync(PAYLOAD_LOG_PATH);
    
    if (!exists) {
      return NextResponse.json({
        enabled: false,
        path: PAYLOAD_LOG_PATH,
        message: 'Payload logging not enabled. Set CLAWDBOT_ANTHROPIC_PAYLOAD_LOG=1 and restart the gateway.',
        entries: [],
      });
    }

    const stats = fs.statSync(PAYLOAD_LOG_PATH);
    const entries = await readPayloadLog(limit);

    // Process entries - add summaries
    const processed = entries.map(entry => {
      const summary = entry.stage === 'request' ? summarizePayload(entry) : null;
      
      return {
        ts: entry.ts,
        runId: entry.runId,
        sessionId: entry.sessionId,
        sessionKey: entry.sessionKey,
        provider: entry.provider,
        modelId: entry.modelId,
        stage: entry.stage,
        payloadDigest: entry.payloadDigest,
        summary,
        usage: entry.usage,
        error: entry.error,
        // Only include raw payload if requested
        payload: includeRaw ? entry.payload : undefined,
      };
    });

    return NextResponse.json({
      enabled: true,
      path: PAYLOAD_LOG_PATH,
      fileSize: formatBytes(stats.size),
      totalEntries: entries.length,
      entries: processed,
    });
  } catch (error) {
    console.error('Error reading payload log:', error);
    return NextResponse.json({ 
      enabled: false,
      error: String(error),
      entries: [],
    }, { status: 500 });
  }
}
