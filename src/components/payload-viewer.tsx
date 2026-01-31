'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, AlertCircle, Send, Cpu, Wrench, MessageSquare, FileText, RefreshCw, Copy, Check, User, Bot, Zap, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface PayloadEntry {
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

interface PayloadData {
  enabled: boolean;
  path: string;
  message?: string;
  fileSize?: string;
  totalEntries?: number;
  entries: PayloadEntry[];
  error?: string;
}

interface FullPayload {
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
  };
}

function formatTime(ts: string) {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

function formatDate(ts: string) {
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={copy} className="h-6 px-2">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function PayloadDetailView({ digest }: { digest: string }) {
  const [data, setData] = useState<FullPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    system: false,
    messages: false,
    tools: false,
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payloads/${digest}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load payload:', err);
        setLoading(false);
      });
  }, [digest]);

  if (loading) {
    return <div className="p-4 text-zinc-500 text-sm">Loading payload...</div>;
  }

  if (!data?.payload) {
    return <div className="p-4 text-zinc-500 text-sm">No payload data available</div>;
  }

  const { payload } = data;

  let systemText = '';
  if (typeof payload.system === 'string') {
    systemText = payload.system;
  } else if (Array.isArray(payload.system)) {
    systemText = payload.system.map(p => p.text || '').join('\n\n');
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="divide-y divide-zinc-800 ml-6 border-l-2 border-zinc-700">
      <Collapsible open={expandedSections.system} onOpenChange={() => toggleSection('system')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800">
            <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", expandedSections.system && "rotate-90")} />
            <FileText className="h-4 w-4 mr-2 text-blue-400" />
            <span className="text-sm">System Prompt</span>
            <Badge variant="outline" className="ml-auto text-xs bg-blue-900/30 text-blue-400 border-blue-700">
              {(systemText.length / 1024).toFixed(1)} KB
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 bg-zinc-950 relative">
            <div className="absolute top-2 right-2">
              <CopyButton text={systemText} />
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-400 max-h-96 overflow-auto pr-8">
              {systemText}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={expandedSections.messages} onOpenChange={() => toggleSection('messages')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800">
            <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", expandedSections.messages && "rotate-90")} />
            <MessageSquare className="h-4 w-4 mr-2 text-green-400" />
            <span className="text-sm">Messages</span>
            <Badge variant="outline" className="ml-auto text-xs bg-green-900/30 text-green-400 border-green-700">
              {payload.messages?.length ?? 0} messages
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 bg-zinc-950 max-h-96 overflow-auto">
            {payload.messages?.map((msg, i) => (
              <div key={i} className={cn(
                "mb-3 p-2 rounded text-xs",
                msg.role === 'user' ? 'bg-blue-950/30 border-l-2 border-blue-500' : 'bg-zinc-900 border-l-2 border-zinc-600'
              )}>
                <div className="font-semibold text-zinc-300 mb-1">{msg.role}</div>
                <pre className="whitespace-pre-wrap font-mono text-zinc-400">
                  {typeof msg.content === 'string' 
                    ? msg.content.slice(0, 1000) + (msg.content.length > 1000 ? '...' : '')
                    : JSON.stringify(msg.content, null, 2).slice(0, 1000)
                  }
                </pre>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={expandedSections.tools} onOpenChange={() => toggleSection('tools')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800">
            <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", expandedSections.tools && "rotate-90")} />
            <Wrench className="h-4 w-4 mr-2 text-orange-400" />
            <span className="text-sm">Tools</span>
            <Badge variant="outline" className="ml-auto text-xs bg-orange-900/30 text-orange-400 border-orange-700">
              {payload.tools?.length ?? 0} tools
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 bg-zinc-950 max-h-96 overflow-auto">
            <div className="flex flex-wrap gap-1 mb-3">
              {payload.tools?.map((tool, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
                  {tool.name}
                </Badge>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">View full schema JSON</summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-zinc-400">
                {JSON.stringify(payload.tools, null, 2)}
              </pre>
            </details>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function PayloadEntryRow({ 
  entry, 
  isExpanded, 
  onToggle,
  isFirstInTurn,
  isLastInTurn,
}: { 
  entry: PayloadEntry; 
  isExpanded: boolean;
  onToggle: () => void;
  isFirstInTurn: boolean;
  isLastInTurn: boolean;
}) {
  const isRequest = entry.stage === 'request';
  
  return (
    <div className={cn(
      "border-b border-zinc-800/50",
      isFirstInTurn && "border-t-2 border-t-blue-500 mt-4 pt-1 bg-gradient-to-b from-blue-950/20 to-transparent",
    )}>
      {/* User message banner for new turns */}
      {isFirstInTurn && entry.summary?.triggeringMessage && (
        <div className="px-4 py-3 bg-blue-950/30 border-b border-blue-900/50">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-blue-300">USER REQUEST</span>
                <span className="text-xs text-zinc-500 font-mono">{formatTime(entry.ts)}</span>
              </div>
              <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                {entry.summary.triggeringMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compact row for API call details */}
      <button
        className={cn(
          "w-full text-left px-4 py-2 hover:bg-zinc-800/30 flex items-center gap-3 transition-colors",
          isLastInTurn && !isFirstInTurn && "bg-green-950/10"
        )}
        onClick={onToggle}
      >
        <ChevronRight className={cn(
          "h-4 w-4 text-zinc-500 transition-transform flex-shrink-0",
          isExpanded && "rotate-90"
        )} />
        
        {isFirstInTurn ? (
          <Send className="h-4 w-4 text-blue-400 flex-shrink-0" />
        ) : isLastInTurn ? (
          <Bot className="h-4 w-4 text-green-400 flex-shrink-0" />
        ) : isRequest ? (
          <Zap className="h-4 w-4 text-yellow-500/60 flex-shrink-0" />
        ) : (
          <Cpu className="h-4 w-4 text-purple-400/60 flex-shrink-0" />
        )}
        
        <span className="text-xs text-zinc-500 font-mono flex-shrink-0">
          {formatTime(entry.ts)}
        </span>
        
        {isLastInTurn && !isFirstInTurn && (
          <Badge variant="outline" className="text-xs bg-green-900/40 text-green-300 border-green-600 flex-shrink-0">
            RESPONSE
          </Badge>
        )}
        
        {!isFirstInTurn && !isLastInTurn && isRequest && (
          <Badge variant="outline" className="text-xs bg-yellow-900/20 text-yellow-400/60 border-yellow-700/40 flex-shrink-0">
            tool loop
          </Badge>
        )}

        {entry.modelId && (
          <span className="text-xs text-zinc-600 flex-shrink-0">
            {entry.modelId}
          </span>
        )}

        <div className="flex-1" />

        {isRequest && entry.summary && (
          <span className="text-xs text-zinc-600 flex-shrink-0">
            {entry.summary.messages.total} msgs · ~{(entry.summary.totalChars / 1024).toFixed(0)}KB
          </span>
        )}

        {!isRequest && entry.usage && (
          <span className="text-xs text-zinc-600 flex-shrink-0">
            {entry.usage.input_tokens?.toLocaleString()} in · {entry.usage.output_tokens?.toLocaleString()} out
            {entry.usage.cache_read_input_tokens && (
              <span className="text-green-500/70 ml-1">
                ({((entry.usage.cache_read_input_tokens / (entry.usage.input_tokens || 1)) * 100).toFixed(0)}% cached)
              </span>
            )}
          </span>
        )}
      </button>

      {isExpanded && entry.payloadDigest && (
        <PayloadDetailView digest={entry.payloadDigest} />
      )}

      {isExpanded && entry.usage && !entry.payloadDigest && (
        <div className="p-3 bg-zinc-950/50 text-xs font-mono text-zinc-400 ml-6 border-l-2 border-zinc-700">
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <div>Input tokens:</div>
            <div>{entry.usage.input_tokens?.toLocaleString()}</div>
            <div>Output tokens:</div>
            <div>{entry.usage.output_tokens?.toLocaleString()}</div>
            {entry.usage.cache_creation_input_tokens && (
              <>
                <div>Cache write:</div>
                <div>{entry.usage.cache_creation_input_tokens.toLocaleString()}</div>
              </>
            )}
            {entry.usage.cache_read_input_tokens && (
              <>
                <div>Cache read:</div>
                <div className="text-green-400">{entry.usage.cache_read_input_tokens.toLocaleString()}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PayloadViewer() {
  const [data, setData] = useState<PayloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showOnlyUserTurns, setShowOnlyUserTurns] = useState(false);

  const loadPayloads = () => {
    setLoading(true);
    fetch('/api/payloads?limit=200')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load payloads:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPayloads();
  }, []);

  // Process entries to identify turns
  const { processedEntries, turnCount } = useMemo(() => {
    if (!data?.entries) return { processedEntries: [], turnCount: 0 };
    
    const entryMeta = new Map<number, { isFirst: boolean; isLast: boolean }>();
    let turnCount = 0;
    
    // Entries are newest first, process to find turn boundaries
    // A new turn starts with turnType === 'new_turn'
    let currentTurnIndices: number[] = [];
    
    // Process in reverse (oldest first) to build turns correctly
    const entriesReversed = [...data.entries].reverse();
    
    entriesReversed.forEach((entry, i) => {
      const originalIndex = data.entries.length - 1 - i;
      
      if (entry.stage === 'request' && entry.summary?.turnType === 'new_turn') {
        // Finalize previous turn
        if (currentTurnIndices.length > 0) {
          currentTurnIndices.forEach((idx, j) => {
            entryMeta.set(idx, {
              isFirst: j === 0,
              isLast: j === currentTurnIndices.length - 1
            });
          });
          turnCount++;
        }
        // Start new turn
        currentTurnIndices = [originalIndex];
      } else {
        currentTurnIndices.push(originalIndex);
      }
    });
    
    // Finalize last turn
    if (currentTurnIndices.length > 0) {
      currentTurnIndices.forEach((idx, j) => {
        entryMeta.set(idx, {
          isFirst: j === 0,
          isLast: j === currentTurnIndices.length - 1
        });
      });
      turnCount++;
    }
    
    const processedEntries = data.entries.map((entry, i) => ({
      entry,
      index: i,
      meta: entryMeta.get(i) || { isFirst: false, isLast: false }
    }));
    
    return { processedEntries, turnCount };
  }, [data?.entries]);

  // Filter entries if showing only user turns
  const displayEntries = useMemo(() => {
    if (!showOnlyUserTurns) return processedEntries;
    return processedEntries.filter(e => e.meta.isFirst);
  }, [processedEntries, showOnlyUserTurns]);

  // Group by date for display
  const entriesByDate = useMemo(() => {
    return displayEntries.reduce((acc, item) => {
      const date = formatDate(item.entry.ts);
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }, {} as Record<string, typeof displayEntries>);
  }, [displayEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Loading payloads...
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-4">
        <AlertCircle className="h-12 w-12 text-yellow-500/50" />
        <div className="text-center">
          <p className="text-lg font-medium text-zinc-300 mb-2">Payload Logging Not Enabled</p>
          <p className="text-sm max-w-md">
            {data?.message || 'Set CLAWDBOT_ANTHROPIC_PAYLOAD_LOG=1 in your environment and restart the gateway.'}
          </p>
          <code className="block mt-4 p-3 bg-zinc-900 rounded text-xs font-mono text-green-400">
            echo &quot;CLAWDBOT_ANTHROPIC_PAYLOAD_LOG=1&quot; &gt;&gt; ~/.zshenv<br />
            clawdbot gateway restart
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-medium text-zinc-200">API Payloads</h2>
            <p className="text-xs text-zinc-500">{data.fileSize} · {data.totalEntries} entries · {turnCount} user turns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showOnlyUserTurns ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setShowOnlyUserTurns(!showOnlyUserTurns)}
            className={cn("gap-1.5", showOnlyUserTurns && "bg-blue-600 hover:bg-blue-700")}
          >
            <Filter className="h-4 w-4" />
            User turns only
          </Button>
          <Button variant="ghost" size="sm" onClick={loadPayloads} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 text-xs">
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-zinc-400">User request</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-500/60" />
          <span className="text-zinc-400">Tool loop</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-green-400" />
          <span className="text-zinc-400">Final response</span>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {Object.entries(entriesByDate).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-zinc-900/50 text-xs font-medium text-zinc-500 sticky top-0 z-10 border-b border-zinc-800">
                {date}
              </div>
              {items.map(({ entry, index, meta }) => {
                const key = entry.payloadDigest || `${entry.ts}-${index}`;
                return (
                  <PayloadEntryRow
                    key={key}
                    entry={entry}
                    isExpanded={expandedEntry === key}
                    onToggle={() => setExpandedEntry(expandedEntry === key ? null : key)}
                    isFirstInTurn={meta.isFirst}
                    isLastInTurn={meta.isLast}
                  />
                );
              })}
            </div>
          ))}

          {data.entries.length === 0 && (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              <div className="text-center">
                <p>No payload entries yet</p>
                <p className="text-sm mt-1">Send a message to see API payloads logged here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
