import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiProgress, ASK_STEPS } from "@/components/roadmap/AiProgress";
import { useAskRoadmap } from "@/hooks/queries";

const EXAMPLES = [
  "What should we cut to hit the next milestone?",
  "Summarize what changed recently",
  "Which features are the riskiest bets?",
  "Is the Now bucket overloaded?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  followUps?: string[];
  otherTopics?: string[];
}

export function AskPanel({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ask = useAskRoadmap(projectId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ask.isPending]);

  function send(question: string) {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    ask.mutate(q, {
      onSuccess: (res) =>
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: res.answer,
            followUps: res.follow_ups,
            otherTopics: res.other_topics,
          },
        ]),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Ask your roadmap
          </SheetTitle>
          <SheetDescription>
            Ask anything about this project's features, priorities, and milestones.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Try asking…</p>
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  data-testid="ask-example"
                  className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const showSuggestions =
              m.role === "assistant" && isLast && !ask.isPending;
            return (
              <div key={i} className="space-y-2">
                <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                    }
                    data-testid={`ask-${m.role}`}
                  >
                    {m.content}
                  </div>
                </div>

                {showSuggestions && (m.followUps?.length || m.otherTopics?.length) ? (
                  <div className="space-y-2 pt-1">
                    {m.followUps && m.followUps.length > 0 && (
                      <SuggestionRow
                        label="Go deeper"
                        questions={m.followUps}
                        testId="ask-followup"
                        disabled={ask.isPending}
                        onPick={send}
                      />
                    )}
                    {m.otherTopics && m.otherTopics.length > 0 && (
                      <SuggestionRow
                        label="Explore other areas"
                        questions={m.otherTopics}
                        testId="ask-other"
                        disabled={ask.isPending}
                        onPick={send}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {ask.isPending && (
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-2.5">
              <AiProgress steps={ASK_STEPS} intervalMs={900} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this roadmap…"
            data-testid="ask-input"
          />
          <Button type="submit" size="icon" disabled={ask.isPending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SuggestionRow({
  label,
  questions,
  testId,
  disabled,
  onPick,
}: {
  label: string;
  questions: string[];
  testId: string;
  disabled: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            disabled={disabled}
            data-testid={testId}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
