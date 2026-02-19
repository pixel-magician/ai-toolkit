'use client';
import { useEffect, useState, useRef } from 'react';
import YAML from 'yaml';
import Editor, { OnMount } from '@monaco-editor/react';

import { Job } from '@prisma/client';

interface Props {
  job: Job;
}

const yamlConfig: YAML.DocumentOptions &
  YAML.SchemaOptions &
  YAML.ParseOptions &
  YAML.CreateNodeOptions &
  YAML.ToStringOptions = {
  indent: 2,
  lineWidth: 999999999999,
  defaultStringType: 'QUOTE_DOUBLE',
  defaultKeyType: 'PLAIN',
  directives: true,
};

export default function JobConfigViewer({ job }: Props) {
  const [editorValue, setEditorValue] = useState<string>('');
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize editor value immediately on component mount
  useEffect(() => {
    if (job?.job_config) {
      try {
        const yamlContent = YAML.stringify(JSON.parse(job.job_config), yamlConfig);
        setEditorValue(yamlContent);
      } catch (e) {
        console.warn(e);
      }
    }
  }, [job]);

  // Set a timeout to show fallback if editor takes too long to load
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!editorLoaded) {
        console.warn('Monaco Editor taking too long to load, showing fallback');
        setShowFallback(true);
      }
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [editorLoaded]);

  // Handler for editor mounting
  const handleEditorDidMount: OnMount = editor => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setEditorLoaded(true);
    setShowFallback(false);
  };

  return (
    <>
      {showFallback ? (
        <div className="w-full h-full flex flex-col">
          <div className="p-2 bg-yellow-900/30 border-b border-yellow-700 text-yellow-300 text-sm">
            编辑器加载超时，使用备用显示模式
          </div>
          <pre className="flex-1 w-full bg-gray-900 text-gray-100 font-mono text-sm p-4 overflow-auto whitespace-pre-wrap">
            {editorValue}
          </pre>
        </div>
      ) : (
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="yaml"
          value={editorValue}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          }
          options={{
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: true,
          }}
        />
      )}
    </>
  );
}
