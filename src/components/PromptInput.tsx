/**
 * PromptInput — text area + launch buttons.
 * If promptOptions are provided, shows option buttons that run the user's
 * typed prompt with different configurations (e.g. different browser identifiers).
 */

import { useState, type FormEvent } from "react";

interface PromptOption {
  label: string;
  description: string;
  prompt: string;
  browserIdentifier?: string;
}

interface PromptInputProps {
  defaultPrompt?: string;
  placeholder?: string;
  isRunning: boolean;
  onSubmit: (prompt: string, browserIdentifier?: string) => void;
  onStop?: () => void;
  promptOptions?: PromptOption[];
}

export default function PromptInput({
  defaultPrompt = "",
  placeholder = "Enter a prompt for the browser agent...",
  isRunning,
  onSubmit,
  onStop,
  promptOptions,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;
    onSubmit(prompt.trim());
  };

  const hasOptions = promptOptions && promptOptions.length > 0;

  return (
    <div className="border-t border-gray-800 bg-gray-900 shrink-0">
      <form onSubmit={handleSubmit} className="p-3">
        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={2}
            disabled={isRunning}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e);
              }
            }}
          />

          <div className="flex flex-col gap-1.5 shrink-0">
            {hasOptions ? (
              /* Show option buttons — each runs the user's prompt with a different config */
              promptOptions!.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!prompt.trim() || isRunning}
                  onClick={() => {
                    if (prompt.trim() && !isRunning) {
                      onSubmit(prompt.trim(), opt.browserIdentifier);
                    }
                  }}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              /* Default launch button */
              <>
                {isRunning ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!prompt.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Launch
                  </button>
                )}
              </>
            )}
            <span className="text-[9px] text-gray-600 text-center">
              {isRunning ? "Running..." : hasOptions ? "Pick an option" : "⌘+Enter"}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
