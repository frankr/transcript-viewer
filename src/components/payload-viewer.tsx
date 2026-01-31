'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, AlertCircle, Send, Cpu, Wrench, MessageSquare, FileText, RefreshCw, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayloadSummary {
  model?: string;
  maxTokens?: number;
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

  // Extract system prompt text
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
    <div className="divide-y divide-zinc-800">
      {/* System Prompt */}
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

      {/* Messages */}
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

      {/* Tools */}
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

function PayloadEntryRow({ entry, isExpanded, onToggle }: { 
  entry: PayloadEntry; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isRequest = entry.stage === 'request';
  
  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <Button
        variant="ghost"
        className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800/50"
        onClick={onToggle}
      >
        <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", isExpanded && "rotate-90")} />
        
        {isRequest ? (
          <Send className="h-4 w-4 mr-2 text-blue-400" />
        ) : (
          <Cpu className="h-4 w-4 mr-2 text-purple-400" />
        )}
        
        <span className="text-xs text-zinc-500 font-mono mr-3">
          {formatTime(entry.ts)}
        </span>
        
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs mr-2",
            isRequest 
              ? "bg-blue-900/30 text-blue-400 border-blue-700" 
              : "bg-purple-900/30 text-purple-400 border-purple-700"
          )}
        >
          {entry.stage}
        </Badge>
        
        {entry.modelId && (
          <Badge variant="outline" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700 mr-2">
            {entry.modelId}
          </Badge>
        )}

        {isRequest && entry.summary && (
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span>{entry.summary.messages.total} msgs</span>
            <span>•</span>
            <span>{entry.summary.tools.count} tools</span>
            <span>•</span>
            <span>~{(entry.summary.totalChars / 1024).toFixed(0)}KB</span>
          </div>
        )}

        {!isRequest && entry.usage && (
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span>in: {entry.usage.input_tokens?.toLocaleString()}</span>
            <span>out: {entry.usage.output_tokens?.toLocaleString()}</span>
            {entry.usage.cache_read_input_tokens && (
              <span className="text-green-500">cached: {entry.usage.cache_read_input_tokens.toLocaleString()}</span>
            )}
          </div>
        )}

        {entry.error && (
          <Badge variant="outline" className="ml-auto text-xs bg-red-900/30 text-red-400 border-red-700">
            error
          </Badge>
        )}
      </Button>

      {isExpanded && entry.payloadDigest && (
        <PayloadDetailView digest={entry.payloadDigest} />
      )}

      {isExpanded && entry.usage && (
        <div className="p-3 bg-zinc-950/50 text-xs font-mono text-zinc-400">
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
          {entry.error && (
            <div className="mt-2 text-red-400">Error: {entry.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function PayloadViewer() {
  const [data, setData] = useState<PayloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const loadPayloads = () => {
    setLoading(true);
    fetch('/api/payloads?limit=50')
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

  // Group entries by date
  const entriesByDate = data.entries.reduce((acc, entry) => {
    const date = formatDate(entry.ts);
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, PayloadEntry[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-medium text-zinc-200">API Payloads</h2>
            <p className="text-xs text-zinc-500">{data.fileSize} • {data.totalEntries} entries</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={loadPayloads} className="gap-1">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Entries */}
      <ScrollArea className="flex-1">
        {Object.entries(entriesByDate).map(([date, entries]) => (
          <div key={date}>
            <div className="px-4 py-2 bg-zinc-900/30 text-xs font-medium text-zinc-500 sticky top-0">
              {date}
            </div>
            {entries.map((entry, i) => {
              const key = entry.payloadDigest || `${entry.ts}-${i}`;
              return (
                <PayloadEntryRow
                  key={key}
                  entry={entry}
                  isExpanded={expandedEntry === key}
                  onToggle={() => setExpandedEntry(expandedEntry === key ? null : key)}
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
      </ScrollArea>
    </div>
  );
}
