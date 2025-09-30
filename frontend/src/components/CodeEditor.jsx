import { useEffect, useCallback, useRef } from 'react';
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
  className = '',
  toolbarControls = null,
  onManualRun = null,
  autoRefresh = true,
  enableManualShortcut = true
}) {
  const { theme } = useTheme();
  const manualRunRef = useRef(onManualRun);
  const manualShortcutEnabledRef = useRef(enableManualShortcut);

  useEffect(() => {
    manualRunRef.current = onManualRun;
  }, [onManualRun]);

  useEffect(() => {
    manualShortcutEnabledRef.current = enableManualShortcut;
  }, [enableManualShortcut]);
  
  const handleEditorChange = (newValue) => {
    onChange(newValue || '');
  };

  const handleEditorWillMount = useCallback(monaco => {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      globalTypeDeclarations,
      'ts:filename/globals.d.ts'
    );
  }, [])

  const handleEditorMount = useCallback((editor, monaco) => {
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        if (manualShortcutEnabledRef.current && manualRunRef.current) {
          manualRunRef.current();
        }
      }
    );
  }, []);

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
        <span className="editor-header-title">
          Generator Code
          {!autoRefresh && enableManualShortcut && (
            <span className="editor-shortcut-hint"> (ctrl+enter to run)</span>
          )}
        </span>
        <div className="editor-header-actions">
          <div className="editor-controls">
            {toolbarControls}
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
      </div>
      <Editor
        beforeMount={handleEditorWillMount}
        onMount={handleEditorMount}
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
