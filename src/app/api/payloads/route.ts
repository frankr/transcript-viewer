import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

function readLastNLines(filePath: string, n: number): string[] {
  // Efficiently read the last N lines from a file without loading the whole thing
  const CHUNK_SIZE = 64 * 1024; // 64KB chunks
  const fd = fs.openSync(filePath, 'r');
  const stats = fs.fstatSync(fd);
  const fileSize = stats.size;
  
  if (fileSize === 0) {
    fs.closeSync(fd);
    return [];
  }

  const lines: string[] = [];
  let buffer = '';
  let position = fileSize;
  
  while (position > 0 && lines.length < n) {
    const readSize = Math.min(CHUNK_SIZE, position);
    position -= readSize;
    
    const chunk = Buffer.alloc(readSize);
    fs.readSync(fd, chunk, 0, readSize, position);
    buffer = chunk.toString('utf-8') + buffer;
    
    // Extract complete lines from buffer
    const parts = buffer.split('\n');
    
    // Keep the first part (might be incomplete) in buffer
    buffer = parts[0];
    
    // Add complete lines (in reverse order since we're reading backwards)
    for (let i = parts.length - 1; i > 0; i--) {
      if (parts[i].trim()) {
        lines.unshift(parts[i]);
        if (lines.length >= n) break;
      }
    }
  }
  
  // Don't forget remaining buffer if we've reached the start
  if (position === 0 && buffer.trim() && lines.length < n) {
    lines.unshift(buffer);
  }
  
  fs.closeSync(fd);
  return lines.slice(-n); // Ensure we return exactly n lines max
}

function readPayloadLog(limit: number = 100): PayloadEntry[] {
  if (!fs.existsSync(PAYLOAD_LOG_PATH)) {
    return [];
  }

  try {
    // Read only the last N lines efficiently
    const lines = readLastNLines(PAYLOAD_LOG_PATH, limit);
    
    const entries: PayloadEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as PayloadEntry;
        entries.push(entry);
      } catch {
        // Skip malformed lines
      }
    }

    // Return most recent entries first
    return entries.reverse();
  } catch (error) {
    console.error('Error reading payload log:', error);
    return [];
  }
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

function extractLastUserMessage(messages: Array<{
  role: string;
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}>): string | null {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        return msg.content;
      } else if (Array.isArray(msg.content)) {
        // Find text blocks (skip tool_result blocks which are usually verbose)
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            return block.text;
          }
        }
      }
    }
  }
  return null;
}

function detectTurnType(messages: Array<{
  role: string;
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}>): 'new_turn' | 'continuation' {
  if (!messages || messages.length === 0) return 'new_turn';
  
  // Get the last message
  const lastMsg = messages[messages.length - 1];
  
  // If last message is from assistant, this shouldn't happen (we're looking at requests)
  // If last message is from user, check what type of content it has
  if (lastMsg.role === 'user') {
    if (typeof lastMsg.content === 'string') {
      // Plain string = user text = new turn
      return 'new_turn';
    } else if (Array.isArray(lastMsg.content)) {
      // Check the LAST block in the content array
      const lastBlock = lastMsg.content[lastMsg.content.length - 1];
      if (lastBlock?.type === 'tool_result') {
        return 'continuation';
      }
      // If last block is text, it's a new turn
      if (lastBlock?.type === 'text') {
        return 'new_turn';
      }
    }
  }
  
  return 'new_turn';
}

function extractTriggeringMessage(messages: Array<{
  role: string;
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}>): string | null {
  if (!messages || messages.length === 0) return null;
  
  const lastMsg = messages[messages.length - 1];
  
  if (lastMsg.role === 'user') {
    if (typeof lastMsg.content === 'string') {
      return lastMsg.content;
    } else if (Array.isArray(lastMsg.content)) {
      // For new turns, get the text content
      // For continuations, we could show the tool name but let's just return null
      for (const block of lastMsg.content) {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
      }
    }
  }
  
  return null;
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

  // Extract last user message for preview (legacy)
  const lastUserMessage = payload.messages ? extractLastUserMessage(payload.messages) : null;
  const userPreview = lastUserMessage 
    ? lastUserMessage.slice(0, 100) + (lastUserMessage.length > 100 ? '...' : '')
    : null;

  // Detect turn type and triggering message
  const turnType = payload.messages ? detectTurnType(payload.messages) : 'new_turn';
  const triggeringMessageRaw = payload.messages ? extractTriggeringMessage(payload.messages) : null;
  const triggeringMessage = triggeringMessageRaw
    ? triggeringMessageRaw.slice(0, 150) + (triggeringMessageRaw.length > 150 ? '...' : '')
    : null;

  // Tool analysis
  const toolCount = payload.tools?.length ?? 0;
  const toolNames = payload.tools?.map(t => t.name) ?? [];
  const toolSchemaChars = JSON.stringify(payload.tools ?? []).length;

  return {
    model: payload.model,
    maxTokens: payload.max_tokens,
    turnType, // 'new_turn' or 'continuation'
    triggeringMessage, // The actual message that triggered this request
    userPreview, // Preview of the last user message (legacy)
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
    const entries = readPayloadLog(limit);

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
