/**
 * CodeSnippet — displays relevant code for each demo scenario.
 */

interface CodeSnippetProps {
  title: string;
  language: string;
  code: string;
}

export default function CodeSnippet({ title, language, code }: CodeSnippetProps) {
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        <span className="text-[10px] font-medium text-gray-400">{title}</span>
        <span className="text-[10px] text-gray-600 font-mono">{language}</span>
      </div>
      <pre className="p-3 bg-gray-950 overflow-x-auto text-xs">
        <code className="text-gray-400 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
