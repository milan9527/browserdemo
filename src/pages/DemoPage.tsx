/**
 * DemoPage — browser live view (left) + agent activity panel (right).
 * Browser is always visible. Thinking and responses shown in the right panel.
 */

import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import LiveViewPanel from "../components/LiveViewPanel";
import ActivityLog, { type AgentStep } from "../components/ActivityLog";
import PromptInput from "../components/PromptInput";
import { demoConfigs } from "../lib/demo-configs";
import {
  startDemoAgent,
  pollAgentJob,
} from "../lib/api";

export default function DemoPage() {
  const { demoId } = useParams<{ demoId: string }>();
  const config = demoConfigs[demoId ?? "web-crawl"];

  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [liveViewEndpoint, setLiveViewEndpoint] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (prompt: string, browserIdentifier?: string, action?: string) => {
      setIsRunning(true);
      setSteps([]);
      setAnswer(null);
      setError(null);
      setSessionId(null);
      setLiveViewUrl(null);
      setLiveViewEndpoint(null);

      try {
        setSteps([{ timestamp: new Date().toISOString(), type: "thinking", text: "Invoking agent on AgentCore Runtime..." }]);

        // Start agent — it creates its own browser session
        const { jobId } = await startDemoAgent(prompt, undefined, undefined, browserIdentifier, action);

        // Poll for results — live view URL arrives when agent's session is detected
        let done = false;
        while (!done) {
          await new Promise((r) => setTimeout(r, 3000));
          const job = await pollAgentJob(jobId);

          if (job.steps.length > 0) {
            setSteps((prev) => {
              const initial = prev.slice(0, 1);
              return [...initial, ...job.steps];
            });
          }

          if (job.agentSessionId && job.agentLiveViewUrl) {
            setSessionId(job.agentSessionId);
            setLiveViewUrl(job.agentLiveViewUrl);
          }

          if (job.status === "completed") {
            setAnswer(job.answer ?? null);
            setAgentMode(job.agentMode ?? null);
            done = true;
          } else if (job.status === "error") {
            setError(`Agent error: ${job.error}`);
            done = true;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
      } finally {
        setIsRunning(false);
      }
    },
    [demoId]
  );

  if (!config) {
    return <div className="flex items-center justify-center h-full text-gray-500">Demo not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact top bar */}
      <header className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <h2 className="text-sm font-semibold text-white">{config.title}</h2>
            <span className="text-xs text-gray-500">— {config.subtitle}</span>
          </div>
          {agentMode && (
            <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-green-500/10 text-green-400 border border-green-500/20">
              ⚡ AgentCore Runtime
            </span>
          )}
        </div>
      </header>

      {/* Main: Browser (left) + Panel (right) */}
      <div className="flex-1 flex min-h-0">
        {/* Browser — always visible */}
        <div className="flex-1 min-w-0">
          <LiveViewPanel
            signedUrl={liveViewUrl}
            liveViewEndpoint={liveViewEndpoint}
            sessionId={sessionId}
            isActive={isRunning || !!sessionId}
          />
        </div>

        {/* Right panel: activity + answer */}
        <div className="w-80 shrink-0 border-l border-gray-800 flex flex-col bg-gray-900/30">
          {/* Activity log */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ActivityLog steps={steps} isRunning={isRunning} />
          </div>

          {/* Answer */}
          {answer && (
            <div className="border-t border-gray-800 p-3 bg-orange-500/5 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-semibold text-orange-400 mb-1">Agent Response</p>
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{answer}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="border-t border-gray-800 p-3 bg-red-500/5">
              <p className="text-[10px] font-semibold text-red-400 mb-1">Error</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Prompt input */}
      <PromptInput
        defaultPrompt={config.defaultPrompt}
        placeholder={`Enter a prompt for ${config.title}...`}
        isRunning={isRunning}
        onSubmit={handleSubmit}
        promptOptions={config.promptOptions}
      />
    </div>
  );
}
