import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

export default function CodeEditor({ 
  value, 
  onChange, 
  readOnly = false, 
  height = '400px',
  forkButton = null
}) {
  const handleEditorChange = (newValue) => {
    onChange(newValue || '');
  };

  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: 'Courier New, monospace',
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    theme: 'vs',
    readOnly: readOnly,
    wordWrap: 'on',
    tabSize: 2,
    insertSpaces: true,
  };

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <span>Generator Code</span>
        <div className="editor-environment">
          <span>Environment:</span>
          <span className="env-var" title="Deterministic random function based on seed. Returns float 0-1, same seed always produces same sequence">rnd()</span>
          <span className="env-var" title="SVG document element">svg</span>
          {forkButton}
        </div>
      </div>
      <Editor
        height={height}
        defaultLanguage="javascript"
        value={value || ''}
        onChange={handleEditorChange}
        options={editorOptions}
      />
    </div>
  );
}
