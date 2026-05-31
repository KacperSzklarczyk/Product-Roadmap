import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      onSuccess: (answer) => setMessages((m) => [...m, { role: "assistant", content: answer }]),
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

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
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
          ))}

          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
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
