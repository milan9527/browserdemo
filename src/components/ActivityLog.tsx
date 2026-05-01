/**
 * ActivityLog — displays the agent's reasoning and tool calls in real time.
 */

import { useEffect, useRef } from "react";

export interface AgentStep {
  timestamp: string;
  type: "tool_call" | "tool_result" | "thinking" | "answer";
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
  text?: string;
}

interface ActivityLogProps {
  steps: AgentStep[];
  isRunning: boolean;
}

export default function ActivityLog({ steps, isRunning }: ActivityLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">Activity Log</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-orange-400">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse-dot" />
              Agent running
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-600">{steps.length} steps</span>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto activity-log p-3 space-y-2">
        {steps.length === 0 && !isRunning && (
          <div className="text-center text-gray-600 text-sm py-8">
            <p>No activity yet</p>
            <p className="text-xs mt-1">Agent steps will appear here</p>
          </div>
        )}

        {steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} />
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
            <div className="flex gap-1">
              <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            Thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function StepCard({ step, index }: { step: AgentStep; index: number }) {
  const time = new Date(step.timestamp).toLocaleTimeString();

  const configs: Record<
    AgentStep["type"],
    { bg: string; border: string; icon: string; label: string }
  > = {
    tool_call: {
      bg: "bg-blue-500/5",
      border: "border-blue-500/20",
      icon: "🔧",
      label: `Tool: ${step.tool}`,
    },
    tool_result: {
      bg: "bg-green-500/5",
      border: "border-green-500/20",
      icon: "✅",
      label: `Result: ${step.tool}`,
    },
    thinking: {
      bg: "bg-purple-500/5",
      border: "border-purple-500/20",
      icon: "💭",
      label: "Thinking",
    },
    answer: {
      bg: "bg-orange-500/5",
      border: "border-orange-500/20",
      icon: "💬",
      label: "Answer",
    },
  };

  const config = configs[step.type];

  return (
    <div
      className={`rounded-lg border ${config.border} ${config.bg} px-3 py-2 text-xs`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span>{config.icon}</span>
          <span className="font-medium text-gray-300">{config.label}</span>
          <span className="text-gray-600">#{index + 1}</span>
        </div>
        <span className="text-gray-600 font-mono">{time}</span>
      </div>

      {step.input && (
        <pre className="text-gray-500 mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] bg-gray-900/50 rounded p-1.5">
          {JSON.stringify(step.input, null, 2)}
        </pre>
      )}

      {step.output && (
        <p className="text-gray-400 mt-1 break-all">{step.output}</p>
      )}

      {step.text && (
        <p className="text-gray-300 mt-1 whitespace-pre-wrap">{step.text}</p>
      )}
    </div>
  );
}
