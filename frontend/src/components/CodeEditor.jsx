import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';

export default function CodeEditor({ 
  value, 
  onChange, 
  readOnly = false, 
  height = '400px',
  forkButton = null
}) {
  const navigate = useNavigate();
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
          <button 
            className="help-btn"
            onClick={() => navigate('/help')}
            title="View help documentation"
          >
            ?
          </button>
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
