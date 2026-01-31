'use client';

import { SessionStats } from '@/types/session';
import { Badge } from '@/components/ui/badge';

interface StatsPanelProps {
  stats: SessionStats | null;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) return null;

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-zinc-900/50 border-b border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Messages:</span>
        <Badge variant="outline" className="bg-zinc-800">
          {stats.totalMessages}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">User:</span>
        <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-800">
          {stats.userMessages}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Assistant:</span>
        <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-800">
          {stats.assistantMessages}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Tool Calls:</span>
        <Badge variant="outline" className="bg-purple-900/30 text-purple-400 border-purple-800">
          {stats.toolCalls}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Tokens:</span>
        <Badge variant="outline" className="bg-zinc-800">
          {stats.totalTokens.toLocaleString()}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Cost:</span>
        <Badge variant="outline" className="bg-zinc-800 text-emerald-400">
          ${stats.totalCost.toFixed(4)}
        </Badge>
      </div>

      {Object.keys(stats.models).length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Models:</span>
          {Object.entries(stats.models).map(([model, count]) => (
            <Badge key={model} variant="outline" className="bg-zinc-800 text-xs">
              {model.split('/').pop()} ({count})
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
