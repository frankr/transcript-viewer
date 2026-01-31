'use client';

import { SessionFile } from '@/types/session';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SessionListProps {
  sessions: SessionFile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function SessionList({ sessions, selectedId, onSelect, loading }: SessionListProps) {
  if (loading) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        No sessions found
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={cn(
              "w-full text-left p-3 rounded-lg transition-colors",
              "hover:bg-zinc-800",
              selectedId === session.id 
                ? "bg-zinc-800 border border-zinc-700" 
                : "bg-zinc-900/50"
            )}
          >
            <div className="font-mono text-xs text-zinc-400 truncate">
              {session.id}
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-zinc-500">
                {formatDistanceToNow(new Date(session.modifiedTime), { addSuffix: true })}
              </span>
              <span className="text-xs text-zinc-600">
                {session.sizeFormatted}
              </span>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
