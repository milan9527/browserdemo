/**
 * LiveViewPanel — renders the DCV live view stream from AgentCore Browser.
 * Always shows the browser area. DCV stream fills the container.
 * Includes a fullscreen toggle button.
 */

import { lazy, Suspense, useRef, useCallback, useState } from "react";

const BrowserLiveView = lazy(() =>
  import("bedrock-agentcore/browser/live-view").then((mod) => ({
    default: mod.BrowserLiveView,
  }))
);

interface LiveViewPanelProps {
  signedUrl: string | null;
  liveViewEndpoint?: string | null;
  sessionId: string | null;
  isActive: boolean;
}

export default function LiveViewPanel({
  signedUrl,
  sessionId,
  isActive,
}: LiveViewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasSession = !!(sessionId && isActive);
  const hasRealSession = hasSession && !sessionId.startsWith("sim-");
  const hasLiveView = hasRealSession && !!signedUrl;

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-gray-950">
      {/* Compact header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 border-b border-gray-800 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasLiveView
                ? "bg-green-500 animate-pulse-dot"
                : hasRealSession
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-600"
            }`}
          />
          <span className="text-[11px] font-medium text-gray-400">
            {hasLiveView ? "Live View" : hasRealSession ? "Connecting..." : "Browser"}
          </span>
          {sessionId && (
            <span className="text-[10px] font-mono text-gray-600">
              {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasLiveView && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600/90 rounded text-[9px] font-bold text-white">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse-dot" />
              LIVE
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Browser area — always visible */}
      <div className="flex-1 relative overflow-hidden">
        {/* DCV stream */}
        {hasLiveView && signedUrl && (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <svg className="w-8 h-8 animate-spin opacity-30" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            }
          >
            <BrowserLiveView
              key={signedUrl}
              signedUrl={signedUrl}
              remoteWidth={1920}
              remoteHeight={1080}
            />
          </Suspense>
        )}

        {/* Connecting state */}
        {hasRealSession && !signedUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <svg className="w-8 h-8 mb-2 animate-spin opacity-30" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs">Connecting...</p>
          </div>
        )}

        {/* Idle browser placeholder */}
        {!hasRealSession && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-xs text-gray-600">Launch a demo to start</p>
          </div>
        )}
      </div>
    </div>
  );
}
