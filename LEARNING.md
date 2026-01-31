# Learning the Agentic AI Stack

A living document of resources, concepts, and insights as Frank explores how modern AI agents actually work.

---

## 🎯 Core Concepts Covered

### 1. The Agentic Loop ✅
**What:** Instead of single prompt→response, the model loops: think → tool call → observe result → think again → repeat until done.

**Key insight:** One user message can trigger 4-10+ API calls behind the scenes.

**Resources:**
- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) — the definitive guide
- [Sketch.dev: The Unreasonable Effectiveness of an LLM Agent Loop](https://sketch.dev/blog/agent-loop) — 9 lines of code that explain it all
- [Braintrust: The Canonical Agent Architecture](https://www.braintrust.dev/blog/agent-while-loop) — why it's just a while loop

---

### 2. Prompt Caching ✅
**What:** Repeated content (system prompt, conversation history) is cached and charged at 10% of normal price.

**Key insight:** Without caching, agentic loops would be economically insane. With caching, you only pay full price for *new* tokens.

**Economics:**
- Cache write: 1.25x price (one-time)
- Cache read: 0.1x price (90% off!)

**Resources:**
- [Anthropic: Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

---

### 3. Context Windows & Accumulation ✅
**What:** Every API request includes the FULL conversation history. Messages accumulate turn over turn.

**Key insight:** A request with "117 messages" contains ALL prior turns + tool calls, not just the current turn.

**Limits:**
| Model | Context |
|-------|---------|
| Claude Opus/Sonnet | 200K tokens |
| Gemini 1.5 Pro | 1-2M tokens |
| GPT-4 Turbo | 128K tokens |

**Resources:**
- [Anthropic: Context Windows](https://docs.anthropic.com/en/docs/build-with-claude/context-windows)

---

## 📚 Topics to Explore Next

### Tool Use / Function Calling
How does Claude know what tools are available? How are tool schemas defined? What makes a good tool design?

### System Prompts
What's in that 30KB system prompt? How does it shape behavior? What are the best practices?

### Thinking Blocks (Extended Thinking)
Claude's internal reasoning before acting. When to use it, what it costs, how it improves output.

### Context Compaction
What happens when you hit the limit? How does summarization work? What gets lost?

### ReAct Pattern
The academic foundation: Reasoning + Acting. How it differs from pure chain-of-thought.

### Multi-Agent Architectures
Sub-agents, orchestrators, handoffs. When one agent spawns another.

### Evaluation & Observability
How do you know if your agent is working well? Metrics, tracing, debugging.

### Memory Systems
Short-term (context), medium-term (session), long-term (files/databases). How agents remember.

---

## 💡 Kai's Quick Explanations

*Space for summaries and explanations as we discuss them*

### [Topic placeholder]
...

---

## 🔗 Resource Library

### Official Documentation
- [Anthropic Docs](https://docs.anthropic.com)
- [OpenAI Docs](https://platform.openai.com/docs)
- [LangChain Docs](https://docs.langchain.com)

### Deep Dives
- [Phil Schmid: Agentic Patterns](https://www.philschmid.de/agentic-pattern)
- [Lilian Weng: LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)

### Communities
- [r/LocalLLaMA](https://reddit.com/r/LocalLLaMA)
- [r/AI_Agents](https://reddit.com/r/AI_Agents)

---

*Last updated: 2026-01-31*
