import Editor from "@monaco-editor/react";
import { useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface ReadOnlyCodeEditorProps {
  code: string;
  language?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
}

function normalizeLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "sh":
      return "shell";
    case "yml":
      return "yaml";
    default:
      return language;
  }
}

export function ReadOnlyCodeEditor({
  code,
  language = "javascript",
  className,
  minHeight = 120,
  maxHeight = 520,
}: ReadOnlyCodeEditorProps) {
  const { effectiveTheme } = useTheme();
  const monacoTheme = effectiveTheme === "dark" ? "vs-dark" : "light";

  const height = useMemo(() => {
    const lineCount = Math.max(1, code.split("\n").length);
    return Math.min(Math.max(lineCount * 20 + 24, minHeight), maxHeight);
  }, [code, minHeight, maxHeight]);

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-muted", className)}>
      <Editor
        key={monacoTheme}
        height={`${height}px`}
        defaultLanguage={normalizeLanguage(language)}
        value={code}
        theme={monacoTheme}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "off",
          lineNumbersMinChars: 0,
          glyphMargin: false,
          folding: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
    </div>
  );
}
