'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SessionFile, SessionData, SessionEntry } from '@/types/session';
import { SessionList } from '@/components/session-list';
import { MessageDisplay } from '@/components/message-display';
import { StatsPanel } from '@/components/stats-panel';
import { FilterControls, RoleFilter } from '@/components/filter-controls';
import { SystemContext } from '@/components/system-context';
import { PayloadViewer } from '@/components/payload-viewer';
import { PayloadTurnList, UserTurn } from '@/components/payload-turn-list';
import { PayloadDetailView } from '@/components/payload-detail-view';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Menu, X, Download, MessageSquare, Send } from 'lucide-react';

export default function Home() {
  const [sessions, setSessions] = useState<SessionFile[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcripts' | 'payloads'>('transcripts');
  const [selectedPayloadTurn, setSelectedPayloadTurn] = useState<UserTurn | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [showThinking, setShowThinking] = useState(true);
  const [showToolCalls, setShowToolCalls] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load sessions list
  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        setSessions(data.sessions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load sessions:', err);
        setLoading(false);
      });
  }, []);

  // Load selected session
  useEffect(() => {
    if (!selectedSession) {
      setSessionData(null);
      return;
    }

    setLoadingSession(true);
    fetch(`/api/sessions/${selectedSession}`)
      .then(res => res.json())
      .then(data => {
        setSessionData(data);
        setLoadingSession(false);
      })
      .catch(err => {
        console.error('Failed to load session:', err);
        setLoadingSession(false);
      });
  }, [selectedSession]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F for search focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      }

      // J/K for navigation
      if (e.key === 'j' || e.key === 'k') {
        if (document.activeElement?.tagName === 'INPUT') return;
        
        const messages = document.querySelectorAll('[data-message]');
        const currentIndex = Array.from(messages).findIndex(
          msg => msg.getBoundingClientRect().top > 100
        );
        
        if (e.key === 'j' && currentIndex < messages.length - 1) {
          messages[currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (e.key === 'k' && currentIndex > 0) {
          messages[currentIndex - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter messages
  const filteredEntries = useMemo(() => {
    if (!sessionData?.entries) return [];

    return sessionData.entries.filter((entry: SessionEntry) => {
      // Only show messages
      if (entry.type !== 'message' || !entry.message) return false;

      // Role filter
      if (roleFilter !== 'all' && entry.message.role !== roleFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const hasMatch = entry.message.content.some(block => {
          if (block.type === 'text' && block.text?.toLowerCase().includes(query)) return true;
          if (block.type === 'thinking' && block.thinking?.toLowerCase().includes(query)) return true;
          if (block.type === 'toolCall' && block.name?.toLowerCase().includes(query)) return true;
          if (block.type === 'toolResult') {
            const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
            return content.toLowerCase().includes(query);
          }
          return false;
        });
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [sessionData, roleFilter, searchQuery]);

  const jumpToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Export as markdown
  const exportMarkdown = useCallback(() => {
    if (!sessionData) return;

    let md = `# Session: ${sessionData.id}\n\n`;
    md += `- Messages: ${sessionData.stats.totalMessages}\n`;
    md += `- Tokens: ${sessionData.stats.totalTokens.toLocaleString()}\n`;
    md += `- Cost: $${sessionData.stats.totalCost.toFixed(4)}\n\n---\n\n`;

    for (const entry of sessionData.entries) {
      if (entry.type !== 'message' || !entry.message) continue;

      const { role, content } = entry.message;
      md += `## ${role.toUpperCase()}\n\n`;

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          md += `${block.text}\n\n`;
        } else if (block.type === 'thinking' && block.thinking) {
          md += `> *Thinking: ${block.thinking}*\n\n`;
        } else if (block.type === 'toolCall') {
          md += `\`\`\`tool-call: ${block.name}\n${JSON.stringify(block.arguments, null, 2)}\n\`\`\`\n\n`;
        } else if (block.type === 'toolResult') {
          const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2);
          md += `\`\`\`tool-result\n${content}\n\`\`\`\n\n`;
        }
      }

      md += '---\n\n';
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionData.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sessionData]);

  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-100">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed md:relative md:translate-x-0
        w-80 h-full bg-zinc-900 border-r border-zinc-800
        transition-transform z-40
        flex flex-col
      `}>
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-semibold text-zinc-100">
            🔍 Context Inspector
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Clawdbot Session & Payload Browser
          </p>
          
          {/* Tab Switcher */}
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as 'transcripts' | 'payloads');
            // Clear selections when switching tabs
            if (v === 'transcripts') {
              setSelectedPayloadTurn(null);
            }
          }} className="mt-3">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
              <TabsTrigger value="transcripts" className="gap-1 text-xs data-[state=active]:bg-zinc-700">
                <MessageSquare className="h-3 w-3" />
                Transcripts
              </TabsTrigger>
              <TabsTrigger value="payloads" className="gap-1 text-xs data-[state=active]:bg-zinc-700">
                <Send className="h-3 w-3" />
                Payloads
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {activeTab === 'transcripts' && (
          <SessionList
            sessions={sessions}
            selectedId={selectedSession}
            onSelect={(id) => {
              setSelectedSession(id);
              setSidebarOpen(false);
            }}
            loading={loading}
          />
        )}
        
        {activeTab === 'payloads' && (
          <PayloadTurnList
            selectedTurnId={selectedPayloadTurn?.id || null}
            onSelectTurn={(turn) => {
              setSelectedPayloadTurn(turn);
              setSidebarOpen(false); // Close sidebar on mobile when selecting
            }}
          />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {activeTab === 'payloads' ? (
          <div className="h-full overflow-hidden">
            {selectedPayloadTurn ? (
              <PayloadDetailView turn={selectedPayloadTurn} />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full text-zinc-500">
                <div className="text-center">
                  <p className="text-xl mb-2">👈 Select a turn</p>
                  <p className="text-sm">Browse user requests from the sidebar</p>
                </div>
              </div>
            )}
          </div>
        ) : selectedSession && sessionData ? (
          <>
            {/* System Context */}
            <SystemContext />

            {/* Stats bar */}
            <div className="flex items-center justify-between border-b border-zinc-800">
              <StatsPanel stats={sessionData.stats} />
              <Button
                variant="ghost"
                size="sm"
                onClick={exportMarkdown}
                className="mr-4 gap-1 text-zinc-400 hover:text-zinc-200"
              >
                <Download className="h-4 w-4" />
                Export MD
              </Button>
            </div>

            {/* Filters */}
            <FilterControls
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              roleFilter={roleFilter}
              onRoleFilterChange={setRoleFilter}
              showThinking={showThinking}
              onShowThinkingChange={setShowThinking}
              showToolCalls={showToolCalls}
              onShowToolCallsChange={setShowToolCalls}
              onJumpToBottom={jumpToBottom}
            />

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {loadingSession ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  Loading session...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  {searchQuery || roleFilter !== 'all' 
                    ? 'No messages match your filters'
                    : 'No messages in this session'
                  }
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  {filteredEntries.map((entry, i) => (
                    <div key={entry.id || i} data-message>
                      <MessageDisplay
                        entry={entry}
                        showThinking={showThinking}
                        showToolCalls={showToolCalls}
                      />
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="text-xl mb-2">👈 Select a session</p>
              <p className="text-sm">Browse conversation transcripts from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
