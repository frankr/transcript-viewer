'use client';

import { useState } from 'react';
import { SessionEntry, ContentBlock } from '@/types/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface MessageDisplayProps {
  entry: SessionEntry;
  showThinking: boolean;
  showToolCalls: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function ContentBlockDisplay({ block, showThinking }: { block: ContentBlock; showThinking: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (block.type === 'text' && block.text) {
    const isLong = block.text.length > 1000;
    const displayText = isLong && !expanded ? block.text.slice(0, 1000) + '...' : block.text;

    return (
      <div className="group relative">
        <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-200 break-words">
          {displayText}
        </pre>
        {isLong && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 p-0 h-auto"
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
        <div className="absolute top-0 right-0">
          <CopyButton text={block.text} />
        </div>
      </div>
    );
  }

  if (block.type === 'thinking' && block.thinking && showThinking) {
    return (
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-zinc-500 p-0 h-auto mb-2 hover:text-zinc-400">
            <ChevronRight className="h-3 w-3 mr-1 transition-transform [[data-state=open]_&]:rotate-90" />
            <span className="text-xs italic">Thinking...</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-4 border-l-2 border-zinc-700 text-zinc-500 italic">
            <pre className="whitespace-pre-wrap font-mono text-xs break-words">
              {block.thinking}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (block.type === 'toolCall') {
    return (
      <div className="bg-purple-950/30 border border-purple-800/50 rounded-lg p-3 my-2">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="bg-purple-900/50 text-purple-300 border-purple-700">
            Tool Call
          </Badge>
          <span className="font-mono text-sm text-purple-300">{block.name}</span>
        </div>
        {block.arguments && (
          <Collapsible defaultOpen={Object.keys(block.arguments).length < 5}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-zinc-500 p-0 h-auto mb-1">
                <ChevronDown className="h-3 w-3 mr-1" />
                <span className="text-xs">Arguments</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="bg-zinc-900/50 rounded p-2 text-xs font-mono text-zinc-400 overflow-x-auto">
                {JSON.stringify(block.arguments, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  }

  if (block.type === 'toolResult') {
    const content = typeof block.content === 'string' 
      ? block.content 
      : JSON.stringify(block.content, null, 2);
    const isLong = content.length > 500;
    const [showFull, setShowFull] = useState(false);
    const displayContent = isLong && !showFull ? content.slice(0, 500) + '...' : content;

    return (
      <div className={cn(
        "bg-zinc-800/50 border rounded-lg p-3 my-2",
        block.isError ? "border-red-800/50" : "border-zinc-700/50"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={cn(
            block.isError 
              ? "bg-red-900/50 text-red-300 border-red-700"
              : "bg-zinc-700/50 text-zinc-400 border-zinc-600"
          )}>
            {block.isError ? 'Error' : 'Result'}
          </Badge>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-400 break-words max-h-96 overflow-auto">
          {displayContent}
        </pre>
        {isLong && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowFull(!showFull)}
            className="text-xs text-blue-400 p-0 h-auto mt-1"
          >
            {showFull ? 'Show less' : 'Show full result'}
          </Button>
        )}
      </div>
    );
  }

  return null;
}

export function MessageDisplay({ entry, showThinking, showToolCalls }: MessageDisplayProps) {
  if (entry.type !== 'message' || !entry.message) return null;

  const { role, content } = entry.message;
  const msg = entry.message as unknown as { 
    model?: string; 
    usage?: { 
      totalTokens?: number; 
      cost?: { total?: number } 
    } 
  };

  const roleColors = {
    user: 'border-l-blue-500 bg-blue-950/20',
    assistant: 'border-l-green-500 bg-green-950/20',
    system: 'border-l-yellow-500 bg-yellow-950/20',
    toolResult: 'border-l-zinc-500 bg-zinc-800/20',
  };

  const roleBadges = {
    user: 'bg-blue-900/50 text-blue-300',
    assistant: 'bg-green-900/50 text-green-300',
    system: 'bg-yellow-900/50 text-yellow-300',
    toolResult: 'bg-zinc-700/50 text-zinc-400',
  };

  // Filter content based on settings
  const filteredContent = content.filter(block => {
    if (block.type === 'thinking' && !showThinking) return false;
    if (block.type === 'toolCall' && !showToolCalls) return false;
    return true;
  });

  if (filteredContent.length === 0 && !showThinking && !showToolCalls) {
    // If all content was filtered out, check if there's at least some text
    const hasText = content.some(b => b.type === 'text');
    if (!hasText) return null;
  }

  return (
    <div className={cn(
      "border-l-4 rounded-r-lg p-4 mb-4 group",
      roleColors[role] || 'border-l-zinc-500'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={roleBadges[role] || ''}>
            {role}
          </Badge>
          {msg.model && (
            <span className="text-xs text-zinc-500 font-mono">{msg.model}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          {msg.usage?.totalTokens && (
            <span>{msg.usage.totalTokens.toLocaleString()} tokens</span>
          )}
          {msg.usage?.cost?.total && (
            <span>${msg.usage.cost.total.toFixed(4)}</span>
          )}
          {entry.timestamp && (
            <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {(filteredContent.length > 0 ? filteredContent : content.filter(b => b.type === 'text')).map((block, i) => (
          <ContentBlockDisplay 
            key={i} 
            block={block} 
            showThinking={showThinking}
          />
        ))}
      </div>
    </div>
  );
}
