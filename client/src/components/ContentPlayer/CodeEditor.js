import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from 'react-query';
import { Play, Save, Copy, Download, RotateCcw, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { progressAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const CodeEditor = ({ content, onProgressUpdate, onComplete }) => {
  const editorRef = useRef(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  
  const { user } = useAuth();

  // Get content progress
  const { data: progressData } = useQuery(
    ['content-progress', content._id],
    () => progressAPI.getContentProgress(content._id),
    {
      enabled: !!content._id && !!user,
    }
  );

  // Load initial code content
  React.useEffect(() => {
    const codeFile = content.files.find(f => f.type === 'code');
    if (codeFile) {
      // In a real implementation, this would load the code file content
      setCode(`// Welcome to ${content.title}
// Start coding here...

function example() {
  console.log("Hello, World!");
  return "Welcome to the lesson!";
}

example();`);
    }
  }, [content]);

  // Language options
  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'json', label: 'JSON' },
    { value: 'markdown', label: 'Markdown' },
  ];

  // Theme options
  const themes = [
    { value: 'vs-dark', label: 'Dark' },
    { value: 'vs-light', label: 'Light' },
    { value: 'hc-black', label: 'High Contrast' },
  ];

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      fontSize,
      wordWrap: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCode();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCode();
    });
  }, [fontSize]);

  // Handle code change
  const handleCodeChange = useCallback((value) => {
    setCode(value);
    setHasUnsavedChanges(true);
    setExecutionResult(null);
  }, []);

  // Run code
  const runCode = useCallback(async () => {
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }

    setIsRunning(true);
    setOutput('');
    setExecutionResult(null);

    try {
      // In a real implementation, this would send code to a backend execution service
      // For now, we'll simulate execution for JavaScript
      if (language === 'javascript') {
        const originalLog = console.log;
        const logs = [];
        
        console.log = (...args) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        try {
          // Create a safe execution context
          const result = new Function(code)();
          console.log('Result:', result);
          
          setOutput(logs.join('\n'));
          setExecutionResult({
            success: true,
            message: 'Code executed successfully',
            result: result
          });
        } catch (error) {
          setOutput(`Error: ${error.message}`);
          setExecutionResult({
            success: false,
            message: error.message,
            error: error
          });
        } finally {
          console.log = originalLog;
        }
      } else {
        // For other languages, show a message
        setOutput(`Code execution for ${language} is not supported in this demo.\n\nIn a production environment, this would connect to a backend service to execute ${language} code.`);
        setExecutionResult({
          success: true,
          message: 'Code displayed (execution not available for this language in demo)'
        });
      }

      // Update progress
      if (user) {
        try {
          await progressAPI.updateContentProgress(content._id, {
            progress: 50, // Mark as in progress
            watchTime: 60, // Assume 1 minute of coding
          });
          
          if (onProgressUpdate) {
            onProgressUpdate(50);
          }
        } catch (error) {
          console.error('Failed to update progress:', error);
        }
      }
    } catch (error) {
      setOutput(`Execution error: ${error.message}`);
      setExecutionResult({
        success: false,
        message: error.message,
        error: error
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, language, content._id, user, onProgressUpdate]);

  // Save code
  const saveCode = useCallback(async () => {
    try {
      // In a real implementation, this would save to backend
      localStorage.setItem(`code_${content._id}`, code);
      setHasUnsavedChanges(false);
      toast.success('Code saved successfully');
      
      // Update progress
      if (user) {
        await progressAPI.updateContentProgress(content._id, {
          progress: 75, // Mark progress after saving
        });
        
        if (onProgressUpdate) {
          onProgressUpdate(75);
        }
      }
    } catch (error) {
      toast.error('Failed to save code');
      console.error('Save error:', error);
    }
  }, [code, content._id, user, onProgressUpdate]);

  // Copy code
  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  }, [code]);

  // Download code
  const downloadCode = useCallback(() => {
    const extensions = {
      javascript: 'js',
      python: 'py',
      typescript: 'ts',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md'
    };

    const extension = extensions[language] || 'txt';
    const filename = `${content.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Code downloaded successfully');
  }, [code, language, content.title]);

  // Reset code
  const resetCode = useCallback(() => {
    setCode('');
    setOutput('');
    setExecutionResult(null);
    setHasUnsavedChanges(false);
    toast.success('Code reset');
  }, []);

  // Mark as completed
  const markCompleted = useCallback(async () => {
    if (user) {
      try {
        await progressAPI.markContentCompleted(content._id);
        if (onComplete) {
          onComplete();
        }
        toast.success('Lesson completed!');
      } catch (error) {
        console.error('Failed to mark as completed:', error);
      }
    }
  }, [content._id, user, onComplete]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{content.description}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
            
            {/* Theme Selector */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {themes.map(th => (
                <option key={th.value} value={th.value}>
                  {th.label}
                </option>
              ))}
            </select>
            
            {/* Font Size */}
            <select
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Run */}
            <button
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{isRunning ? 'Running...' : 'Run'}</span>
            </button>
            
            {/* Save */}
            <button
              onClick={saveCode}
              disabled={!hasUnsavedChanges}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            
            {/* Copy */}
            <button
              onClick={copyCode}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </button>
            
            {/* Download */}
            <button
              onClick={downloadCode}
              className="flex items-center space-x-1 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            
            {/* Reset */}
            <button
              onClick={resetCode}
              className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            
            {/* Toggle Output */}
            <button
              onClick={() => setShowOutput(!showOutput)}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              {showOutput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showOutput ? 'Hide' : 'Show'} Output</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span className="text-sm text-orange-600">Unsaved changes</span>
            )}
            
            {/* Mark Complete */}
            <button
              onClick={markCompleted}
              className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Mark Complete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor and Output */}
      <div className={`grid ${showOutput ? 'grid-cols-2' : 'grid-cols-1'} h-[600px]`}>
        {/* Code Editor */}
        <div className="border-r border-gray-200">
          <Editor
            height="100%"
            language={language}
            theme={theme}
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize,
              wordWrap: 'on',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              parameterHints: { enabled: true },
            }}
          />
        </div>

        {/* Output Panel */}
        {showOutput && (
          <div className="flex flex-col bg-gray-900 text-gray-100">
            <div className="border-b border-gray-700 px-4 py-2 flex items-center justify-between">
              <h4 className="font-medium">Output</h4>
              {executionResult && (
                <div className="flex items-center space-x-1">
                  {executionResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-sm ${executionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {executionResult.message}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 p-4 font-mono text-sm overflow-auto">
              {output ? (
                <pre className="whitespace-pre-wrap">{output}</pre>
              ) : (
                <div className="text-gray-500 italic">
                  Click "Run" to execute your code and see the output here...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions Panel */}
      {content.metadata?.instructions && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-2">Instructions</h4>
          <div className="text-gray-700 text-sm">
            {content.metadata.instructions}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
