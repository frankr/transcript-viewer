'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemContextFile {
  name: string;
  filename: string;
  path: string;
  exists: boolean;
  content: string | null;
  size: number;
  sizeFormatted: string;
}

interface SystemContextData {
  files: SystemContextFile[];
  summary: {
    total: number;
    existing: number;
    totalSize: number;
    totalSizeFormatted: string;
  };
}

function FileSection({ file }: { file: SystemContextFile }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!file.exists) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-zinc-600 border-b border-indigo-900/30 last:border-b-0">
        <AlertCircle className="h-4 w-4" />
        <span className="font-mono text-sm">{file.name}</span>
        <Badge variant="outline" className="text-xs bg-zinc-800/50 text-zinc-500 border-zinc-700">
          not found
        </Badge>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-indigo-900/30 last:border-b-0">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-3 py-2 h-auto rounded-none hover:bg-indigo-950/30"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 mr-2 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
          <FileText className="h-4 w-4 mr-2 text-indigo-400" />
          <span className="font-mono text-sm text-indigo-300">{file.name}</span>
          <Badge 
            variant="outline" 
            className="ml-auto text-xs bg-indigo-900/30 text-indigo-400 border-indigo-700"
          >
            {file.sizeFormatted}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 py-3 bg-zinc-950/50">
          <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-400 break-words max-h-96 overflow-auto">
            {file.content}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SystemContext() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<SystemContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system-context')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setData(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load system context:', err);
        setError(String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-indigo-950/20 border-b border-indigo-900/50 p-3">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="text-sm">Loading system context...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const existingFiles = data.files.filter(f => f.exists);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-indigo-950/20 border-b border-indigo-900/50">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-3 h-auto rounded-none hover:bg-indigo-950/30"
          >
            <ChevronRight
              className={cn(
                "h-5 w-5 mr-2 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
            <span className="text-base font-medium">📋 System Context</span>
            <div className="ml-auto flex items-center gap-2">
              <Badge 
                variant="outline" 
                className="text-xs bg-indigo-900/30 text-indigo-400 border-indigo-700"
              >
                {existingFiles.length} / {data.summary.total} files
              </Badge>
              <Badge 
                variant="outline" 
                className="text-xs bg-zinc-800/50 text-zinc-400 border-zinc-700"
              >
                {data.summary.totalSizeFormatted}
              </Badge>
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-indigo-900/30">
            {data.files.map((file) => (
              <FileSection key={file.filename} file={file} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
