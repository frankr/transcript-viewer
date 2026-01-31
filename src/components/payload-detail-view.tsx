'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronRight, ChevronDown, Send, Cpu, Bot, User, Zap, MessageSquare, 
  FileText, Wrench, Copy, Check, Info, ArrowRight
} from 'lucide-react';
import type { UserTurn, PayloadEntry } from './payload-turn-list';

interface FullPayload {
  payload?: {
    model?: string;
    max_tokens?: number;
    system?: string | Array<{ type: string; text?: string; cache_control?: unknown }>;
    messages?: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string; tool_use_id?: string; name?: string; [key: string]: unknown }>;
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

function MessageBlock({ msg, index }: { msg: { role: string; content: string | Array<{ type: string; text?: string; tool_use_id?: string; name?: string; [key: string]: unknown }> }; index: number }) {
  const [expanded, setExpanded] = useState(false);
  
  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';
  
  // Determine if this is a tool message
  let isToolUse = false;
  let isToolResult = false;
  let toolName = '';
  
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        isToolUse = true;
        toolName = block.name || 'tool';
      }
      if (block.type === 'tool_result') {
        isToolResult = true;
        toolName = block.name || 'tool_result';
      }
    }
  }
  
  // Get preview text
  let previewText = '';
  if (typeof msg.content === 'string') {
    previewText = msg.content;
  } else if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        previewText = block.text;
        break;
      }
    }
    if (!previewText && isToolUse) {
      previewText = `[Tool call: ${toolName}]`;
    }
    if (!previewText && isToolResult) {
      previewText = `[Tool result]`;
    }
  }
  
  const fullContent = typeof msg.content === 'string' 
    ? msg.content 
    : JSON.stringify(msg.content, null, 2);
  
  // Collapse tool messages by default
  const defaultCollapsed = isToolUse || isToolResult;
  
  return (
    <div className={cn(
      "rounded text-xs border",
      isUser && "bg-blue-950/30 border-blue-800/50",
      isAssistant && !isToolUse && "bg-zinc-900 border-zinc-700/50",
      isToolUse && "bg-orange-950/20 border-orange-800/30",
      isToolResult && "bg-purple-950/20 border-purple-800/30"
    )}>
      <button
        className="w-full flex items-center gap-2 p-2 text-left hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform flex-shrink-0 text-zinc-500", expanded && "rotate-90")} />
        
        {isUser && <User className="h-3 w-3 text-blue-400 flex-shrink-0" />}
        {isAssistant && !isToolUse && <Bot className="h-3 w-3 text-zinc-400 flex-shrink-0" />}
        {isToolUse && <Wrench className="h-3 w-3 text-orange-400 flex-shrink-0" />}
        {isToolResult && <Cpu className="h-3 w-3 text-purple-400 flex-shrink-0" />}
        
        <span className={cn(
          "font-medium flex-shrink-0",
          isUser && "text-blue-300",
          isAssistant && !isToolUse && "text-zinc-300",
          isToolUse && "text-orange-300",
          isToolResult && "text-purple-300"
        )}>
          {isToolUse ? toolName : isToolResult ? 'tool_result' : msg.role}
        </span>
        
        <span className="text-zinc-500 truncate flex-1">
          {previewText.slice(0, 80)}{previewText.length > 80 ? '...' : ''}
        </span>
        
        <span className="text-zinc-600 flex-shrink-0 text-[10px]">#{index + 1}</span>
      </button>
      
      {expanded && (
        <div className="border-t border-zinc-800/50 p-2 relative">
          <div className="absolute top-1 right-1">
            <CopyButton text={fullContent} />
          </div>
          <pre className="whitespace-pre-wrap font-mono text-zinc-400 text-[11px] max-h-60 overflow-auto pr-8">
            {previewText || fullContent}
          </pre>
        </div>
      )}
    </div>
  );
}

function RequestDetail({ digest }: { digest: string }) {
  const [data, setData] = useState<FullPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    messages: false,
    system: false,
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
    return <div className="p-3 text-zinc-500 text-xs">Loading...</div>;
  }

  if (!data?.payload) {
    return <div className="p-3 text-zinc-500 text-xs">No payload data</div>;
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
    <div className="border-l-2 border-zinc-700 ml-4 space-y-1">
      {/* Messages Section */}
      <Collapsible open={expandedSections.messages} onOpenChange={() => toggleSection('messages')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800/50">
            <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", expandedSections.messages && "rotate-90")} />
            <MessageSquare className="h-4 w-4 mr-2 text-green-400" />
            <span className="text-sm">Conversation History</span>
            <Badge variant="outline" className="ml-auto text-xs bg-green-900/30 text-green-400 border-green-700">
              {payload.messages?.length ?? 0} messages
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 bg-zinc-950/50 space-y-1.5 max-h-[500px] overflow-y-auto">
            {/* Explanation about message accumulation */}
            <div className="flex items-start gap-2 p-2 bg-blue-950/30 rounded border border-blue-800/30 mb-3">
              <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200/80">
                This shows the <strong>full conversation history</strong> sent to Claude in this request. 
                Each API call includes all previous messages, so this accumulates over the session.
              </p>
            </div>
            
            {payload.messages?.map((msg, i) => (
              <MessageBlock key={i} msg={msg} index={i} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* System Prompt */}
      <Collapsible open={expandedSections.system} onOpenChange={() => toggleSection('system')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800/50">
            <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", expandedSections.system && "rotate-90")} />
            <FileText className="h-4 w-4 mr-2 text-blue-400" />
            <span className="text-sm">System Prompt</span>
            <Badge variant="outline" className="ml-auto text-xs bg-blue-900/30 text-blue-400 border-blue-700">
              {(systemText.length / 1024).toFixed(1)} KB
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 bg-zinc-950/50 relative">
            <div className="absolute top-2 right-2">
              <CopyButton text={systemText} />
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-400 max-h-80 overflow-auto pr-8">
              {systemText}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tools */}
      <Collapsible open={expandedSections.tools} onOpenChange={() => toggleSection('tools')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-zinc-800/50">
            <ChevronRight className={cn("h-4 w-4 mr-2 transition-transform", expandedSections.tools && "rotate-90")} />
            <Wrench className="h-4 w-4 mr-2 text-orange-400" />
            <span className="text-sm">Tools</span>
            <Badge variant="outline" className="ml-auto text-xs bg-orange-900/30 text-orange-400 border-orange-700">
              {payload.tools?.length ?? 0} tools
            </Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 bg-zinc-950/50 max-h-60 overflow-auto">
            <div className="flex flex-wrap gap-1">
              {payload.tools?.map((tool, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
                  {tool.name}
                </Badge>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function UsageDetail({ entry }: { entry: PayloadEntry }) {
  if (!entry.usage) return null;
  
  const { usage } = entry;
  const cachePercent = usage.cache_read_input_tokens && usage.input_tokens
    ? ((usage.cache_read_input_tokens / usage.input_tokens) * 100).toFixed(0)
    : null;
  
  return (
    <div className="border-l-2 border-zinc-700 ml-4 p-3 bg-zinc-950/30">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs max-w-xs">
        <span className="text-zinc-500">Input tokens:</span>
        <span className="text-zinc-300 font-mono">{usage.input_tokens?.toLocaleString()}</span>
        
        <span className="text-zinc-500">Output tokens:</span>
        <span className="text-zinc-300 font-mono">{usage.output_tokens?.toLocaleString()}</span>
        
        {usage.cache_read_input_tokens && (
          <>
            <span className="text-zinc-500">Cache read:</span>
            <span className="text-green-400 font-mono">
              {usage.cache_read_input_tokens.toLocaleString()}
              {cachePercent && <span className="text-green-500/70 ml-1">({cachePercent}%)</span>}
            </span>
          </>
        )}
        
        {usage.cache_creation_input_tokens && (
          <>
            <span className="text-zinc-500">Cache write:</span>
            <span className="text-yellow-400 font-mono">{usage.cache_creation_input_tokens.toLocaleString()}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface PayloadDetailViewProps {
  turn: UserTurn;
}

export function PayloadDetailView({ turn }: PayloadDetailViewProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  
  // Separate requests and usages, pair them together
  const timeline = turn.entries.map((entry, i) => {
    const key = entry.payloadDigest || `${entry.ts}-${i}`;
    const isRequest = entry.stage === 'request';
    const isFirst = i === 0;
    const isLast = i === turn.entries.length - 1;
    
    // Determine entry type
    let type: 'initial' | 'continuation' | 'response' = 'continuation';
    if (isRequest && entry.summary?.turnType === 'new_turn') {
      type = 'initial';
    } else if (!isRequest && isLast) {
      type = 'response';
    }
    
    return { entry, key, isRequest, type };
  });
  
  // Count API calls (requests only)
  const requestCount = timeline.filter(t => t.isRequest).length;
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* User Message Header */}
      <div className="p-4 bg-blue-950/30 border-b border-blue-800/30">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-300">User Request</span>
              <span className="text-xs text-zinc-500 font-mono">{formatTime(turn.ts)}</span>
            </div>
            <p className="text-zinc-200 whitespace-pre-wrap break-words">
              {turn.triggeringMessage}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Header */}
      <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-zinc-300">API Call Timeline</span>
        </div>
        <span className="text-xs text-zinc-500">
          {requestCount} {requestCount === 1 ? 'call' : 'calls'}
          {requestCount > 1 && ' (includes tool loops)'}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {timeline.map(({ entry, key, isRequest, type }) => {
            const isExpanded = expandedEntry === key;
            
            return (
              <div key={key}>
                <button
                  className={cn(
                    "w-full text-left p-3 rounded hover:bg-zinc-800/50 transition-colors flex items-center gap-3",
                    type === 'initial' && "bg-blue-950/20 border border-blue-800/30",
                    type === 'continuation' && isRequest && "bg-yellow-950/10 border border-yellow-800/20",
                    type === 'response' && "bg-green-950/20 border border-green-800/30",
                    !isRequest && type !== 'response' && "bg-zinc-900/50 border border-zinc-800/50"
                  )}
                  onClick={() => setExpandedEntry(isExpanded ? null : key)}
                >
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform flex-shrink-0 text-zinc-500",
                    isExpanded && "rotate-90"
                  )} />
                  
                  {type === 'initial' && <Send className="h-4 w-4 text-blue-400 flex-shrink-0" />}
                  {type === 'continuation' && isRequest && <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                  {type === 'response' && <Bot className="h-4 w-4 text-green-400 flex-shrink-0" />}
                  {!isRequest && type !== 'response' && <Cpu className="h-4 w-4 text-purple-400 flex-shrink-0" />}
                  
                  <span className="text-xs text-zinc-500 font-mono flex-shrink-0">
                    {formatTime(entry.ts)}
                  </span>
                  
                  {type === 'initial' && (
                    <Badge variant="outline" className="text-xs bg-blue-900/40 text-blue-300 border-blue-600">
                      Initial Request
                    </Badge>
                  )}
                  
                  {type === 'continuation' && isRequest && (
                    <Badge variant="outline" className="text-xs bg-yellow-900/30 text-yellow-400 border-yellow-700/50">
                      Tool Loop
                    </Badge>
                  )}
                  
                  {type === 'response' && (
                    <Badge variant="outline" className="text-xs bg-green-900/40 text-green-300 border-green-600">
                      Final Usage
                    </Badge>
                  )}
                  
                  {!isRequest && type !== 'response' && (
                    <Badge variant="outline" className="text-xs bg-purple-900/30 text-purple-300 border-purple-700/50">
                      Usage
                    </Badge>
                  )}
                  
                  <div className="flex-1" />
                  
                  {isRequest && entry.summary && (
                    <span className="text-xs text-zinc-600">
                      {entry.summary.messages.total} msgs · ~{(entry.summary.totalChars / 1024).toFixed(0)}KB
                    </span>
                  )}
                  
                  {!isRequest && entry.usage && (
                    <span className="text-xs text-zinc-600">
                      {entry.usage.input_tokens?.toLocaleString()} in · {entry.usage.output_tokens?.toLocaleString()} out
                    </span>
                  )}
                </button>
                
                {isExpanded && isRequest && entry.payloadDigest && (
                  <RequestDetail digest={entry.payloadDigest} />
                )}
                
                {isExpanded && !isRequest && (
                  <UsageDetail entry={entry} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Explanation at bottom */}
        <div className="mt-6 p-3 bg-zinc-900/50 rounded border border-zinc-800 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-zinc-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="mb-1">
                <strong className="text-zinc-300">Understanding the message count:</strong>
              </p>
              <p>
                Each API request includes the <em>entire</em> conversation history up to that point. 
                So &quot;{turn.messageCount} messages&quot; means all previous exchanges are sent each time — 
                this is how Claude maintains context.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
