'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, X, Brain, Wrench, ArrowDown } from 'lucide-react';

export type RoleFilter = 'all' | 'user' | 'assistant' | 'system' | 'toolResult';

interface FilterControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  roleFilter: RoleFilter;
  onRoleFilterChange: (role: RoleFilter) => void;
  showThinking: boolean;
  onShowThinkingChange: (show: boolean) => void;
  showToolCalls: boolean;
  onShowToolCallsChange: (show: boolean) => void;
  onJumpToBottom: () => void;
}

export function FilterControls({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  showThinking,
  onShowThinkingChange,
  showToolCalls,
  onShowToolCallsChange,
  onJumpToBottom,
}: FilterControlsProps) {
  const roles: { value: RoleFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: 'bg-zinc-700' },
    { value: 'user', label: 'User', color: 'bg-blue-900/50 text-blue-300' },
    { value: 'assistant', label: 'Assistant', color: 'bg-green-900/50 text-green-300' },
    { value: 'system', label: 'System', color: 'bg-yellow-900/50 text-yellow-300' },
    { value: 'toolResult', label: 'Tool Results', color: 'bg-zinc-700' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-10 backdrop-blur-sm">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          type="text"
          placeholder="Search messages... (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Role filter */}
      <div className="flex items-center gap-1">
        {roles.map((role) => (
          <Badge
            key={role.value}
            variant="outline"
            onClick={() => onRoleFilterChange(role.value)}
            className={cn(
              "cursor-pointer transition-all",
              roleFilter === role.value
                ? role.color + ' border-2'
                : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800'
            )}
          >
            {role.label}
          </Badge>
        ))}
      </div>

      {/* Toggle buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowThinkingChange(!showThinking)}
          className={cn(
            "gap-1",
            showThinking 
              ? "bg-zinc-700 text-zinc-200" 
              : "bg-zinc-800/50 text-zinc-500"
          )}
        >
          <Brain className="h-3 w-3" />
          Thinking
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowToolCallsChange(!showToolCalls)}
          className={cn(
            "gap-1",
            showToolCalls 
              ? "bg-purple-900/50 text-purple-300" 
              : "bg-zinc-800/50 text-zinc-500"
          )}
        >
          <Wrench className="h-3 w-3" />
          Tools
        </Button>
      </div>

      {/* Jump to bottom */}
      <Button
        variant="outline"
        size="sm"
        onClick={onJumpToBottom}
        className="gap-1 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700"
      >
        <ArrowDown className="h-3 w-3" />
        Bottom
      </Button>
    </div>
  );
}
