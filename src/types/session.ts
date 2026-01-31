// Types for Clawdbot session transcripts

export interface SessionFile {
  id: string;
  filename: string;
  modifiedTime: string;
  size: number;
  sizeFormatted: string;
}

export interface ContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'toolResult' | 'image';
  text?: string;
  thinking?: string;
  thinkingSignature?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  content?: string | ContentBlock[];
  isError?: boolean;
}

export interface Usage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'toolResult';
  content: ContentBlock[];
  timestamp?: number;
}

export interface SessionEntry {
  type: 'session' | 'message' | 'model_change' | 'thinking_level_change' | 'tool_result';
  id: string;
  parentId?: string | null;
  timestamp: string;
  message?: Message;
  version?: number;
  cwd?: string;
  provider?: string;
  modelId?: string;
  thinkingLevel?: string;
}

export interface SessionData {
  id: string;
  entries: SessionEntry[];
  stats: SessionStats;
}

export interface SessionStats {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalTokens: number;
  totalCost: number;
  models: Record<string, number>;
}
