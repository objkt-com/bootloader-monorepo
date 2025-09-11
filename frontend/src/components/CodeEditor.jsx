import {useState, useEffect, useCallback} from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { HelpCircle } from 'lucide-react';
import { useTheme } from '../App.jsx';

const globalTypeDeclarations = `
  interface Btldr {
    /**
     * Set to true in preview mode.
     */
    isPreview: boolean;

    /**
     * The current iteration number.
     */
    interationNumber: number;

    /**
     * The current seed as a BigInt.
     */
    seed: BigInt;

    /**
     * Returns a deterministic random number between 0 and 1.
     *
     * @returns {number} A random number between 0 and 1.
     */
    rnd(): number;

    /**
     * A reference to the SVG root element.
     */
    svg: SVGElement;
  }
  
  
  /**
   * A reference to the global bootloader object.
   */
  declare const BTLDR: Btldr;
`

export default function CodeEditor({ 
  value, 
  onChange, 
  readOnly = false, 
  height = '400px',
  forkButton = null,
  className = ''
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const handleEditorChange = (newValue) => {
    onChange(newValue || '');
  };

  const handleEditorWillMount = useCallback(monaco => {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      globalTypeDeclarations,
      'ts:filename/globals.d.ts'
    );
  }, [])

  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: 'Courier New, monospace',
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    readOnly: readOnly,
    wordWrap: 'on',
    tabSize: 2,
    insertSpaces: true,
  };

  return (
    <div className={`editor-panel ${className}`.trim()}>
      <div className="editor-header">
        <span>Generator Code</span>
        <div className="editor-environment">
          <button 
            className="help-btn"
            onClick={() => window.open('/help', '_blank')}
            title="View help documentation"
          >
            <HelpCircle size={16} />
          </button>
          {forkButton}
        </div>
      </div>
      <Editor
        beforeMount={handleEditorWillMount}
        height={height}
        defaultLanguage="javascript"
        value={value || ''}
        onChange={handleEditorChange}
        options={editorOptions}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      />
    </div>
  );
}
