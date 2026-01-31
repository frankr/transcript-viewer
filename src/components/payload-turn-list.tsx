'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { User, MessageSquare, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PayloadSummary {
  model?: string;
  maxTokens?: number;
  turnType?: 'new_turn' | 'continuation';
  triggeringMessage?: string | null;
  userPreview?: string | null;
  systemPrompt: {
    chars: number;
    estimatedTokens: number;
    parts: string[];
  };
  messages: {
    total: number;
    user: number;
    assistant: number;
    chars: number;
    estimatedTokens: number;
  };
  tools: {
    count: number;
    names: string[];
    schemaChars: number;
    estimatedTokens: number;
  };
  totalChars: number;
  totalEstimatedTokens: number;
}

export interface PayloadEntry {
  ts: string;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  stage: 'request' | 'usage';
  payloadDigest?: string;
  summary?: PayloadSummary | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: string;
}

export interface PayloadData {
  enabled: boolean;
  path: string;
  message?: string;
  fileSize?: string;
  totalEntries?: number;
  entries: PayloadEntry[];
  error?: string;
}

export interface UserTurn {
  id: string;
  ts: string;
  triggeringMessage: string;
  messageCount: number;
  entries: PayloadEntry[]; // All entries (requests + usages) for this turn
}

function formatTime(ts: string) {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatDate(ts: string) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
}

interface PayloadTurnListProps {
  selectedTurnId: string | null;
  onSelectTurn: (turn: UserTurn | null) => void;
  onDataLoaded?: (data: PayloadData | null) => void;
}

export function PayloadTurnList({ selectedTurnId, onSelectTurn, onDataLoaded }: PayloadTurnListProps) {
  const [data, setData] = useState<PayloadData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPayloads = () => {
    setLoading(true);
    fetch('/api/payloads?limit=500')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
        onDataLoaded?.(data);
      })
      .catch(err => {
        console.error('Failed to load payloads:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPayloads();
  }, []);

  // Group entries into user turns
  const userTurns = useMemo(() => {
    if (!data?.entries) return [];
    
    const turns: UserTurn[] = [];
    let currentTurnEntries: PayloadEntry[] = [];
    let currentTurnStart: PayloadEntry | null = null;
    
    // Entries come in newest-first, so we process in reverse to build turns correctly
    const entriesOldestFirst = [...data.entries].reverse();
    
    for (const entry of entriesOldestFirst) {
      // Check if this is a new turn (request with turnType === 'new_turn')
      if (entry.stage === 'request' && entry.summary?.turnType === 'new_turn') {
        // Finalize previous turn if exists
        if (currentTurnStart && currentTurnEntries.length > 0) {
          const id = currentTurnStart.payloadDigest || currentTurnStart.ts;
          turns.push({
            id,
            ts: currentTurnStart.ts,
            triggeringMessage: currentTurnStart.summary?.triggeringMessage || '(No message)',
            messageCount: currentTurnStart.summary?.messages.total || 0,
            entries: [...currentTurnEntries],
          });
        }
        // Start new turn
        currentTurnStart = entry;
        currentTurnEntries = [entry];
      } else {
        // Add to current turn
        currentTurnEntries.push(entry);
      }
    }
    
    // Finalize last turn
    if (currentTurnStart && currentTurnEntries.length > 0) {
      const id = currentTurnStart.payloadDigest || currentTurnStart.ts;
      turns.push({
        id,
        ts: currentTurnStart.ts,
        triggeringMessage: currentTurnStart.summary?.triggeringMessage || '(No message)',
        messageCount: currentTurnStart.summary?.messages.total || 0,
        entries: [...currentTurnEntries],
      });
    }
    
    // Return newest first for display
    return turns.reverse();
  }, [data?.entries]);

  // Group turns by date
  const turnsByDate = useMemo(() => {
    return userTurns.reduce((acc, turn) => {
      const date = formatDate(turn.ts);
      if (!acc[date]) acc[date] = [];
      acc[date].push(turn);
      return acc;
    }, {} as Record<string, UserTurn[]>);
  }, [userTurns]);

  const handleSelectTurn = (turn: UserTurn) => {
    onSelectTurn(selectedTurnId === turn.id ? null : turn);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-zinc-500 text-sm text-center">
        <p className="mb-2">Payload logging not enabled</p>
        <code className="text-xs bg-zinc-800 p-2 rounded">
          CLAWDBOT_ANTHROPIC_PAYLOAD_LOG=1
        </code>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-400">
          {userTurns.length} user turns
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadPayloads}
          className="h-6 px-2 text-zinc-500 hover:text-zinc-300"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Turn list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(turnsByDate).map(([date, turns]) => (
          <div key={date}>
            <div className="px-3 py-1.5 bg-zinc-900/50 text-xs font-medium text-zinc-500 sticky top-0 border-b border-zinc-800/50">
              {date}
            </div>
            {turns.map((turn) => (
              <button
                key={turn.id}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors",
                  selectedTurnId === turn.id && "bg-blue-950/40 border-l-2 border-l-blue-500"
                )}
                onClick={() => handleSelectTurn(turn)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3 w-3 text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-500 font-mono">
                    {formatTime(turn.ts)}
                  </span>
                  <span className="text-xs text-zinc-600 ml-auto">
                    {turn.messageCount} msgs
                  </span>
                </div>
                <p className="text-sm text-zinc-300 line-clamp-2 leading-tight">
                  {turn.triggeringMessage}
                </p>
              </button>
            ))}
          </div>
        ))}

        {userTurns.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
            No turns recorded yet
          </div>
        )}
      </div>
    </div>
  );
}
