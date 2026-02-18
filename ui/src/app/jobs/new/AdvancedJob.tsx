'use client';
import { useEffect, useState, useRef } from 'react';
import { JobConfig } from '@/types';
import YAML from 'yaml';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Settings } from '@/hooks/useSettings';
import { migrateJobConfig } from './jobConfig';

type Props = {
  jobConfig: JobConfig;
  setJobConfig: (value: any, key?: string) => void;
  status: 'idle' | 'saving' | 'success' | 'error';
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  runId: string | null;
  gpuIDs: string | null;
  setGpuIDs: (value: string | null) => void;
  gpuList: any;
  datasetOptions: any;
  settings: Settings;
};

const isDev = process.env.NODE_ENV === 'development';

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

export default function AdvancedJob({ jobConfig, setJobConfig, settings }: Props) {
  const [editorValue, setEditorValue] = useState<string>('');
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const lastJobConfigUpdateStringRef = useRef('');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if the editor has been mounted
  const isEditorMounted = useRef(false);

  // Initialize editor value immediately on component mount
  useEffect(() => {
    try {
      const yamlContent = YAML.stringify(jobConfig, yamlConfig);
      setEditorValue(yamlContent);
      lastJobConfigUpdateStringRef.current = JSON.stringify(jobConfig);
    } catch (e) {
      console.warn(e);
    }
  }, [jobConfig]);

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
    editorRef.current = editor;
    isEditorMounted.current = true;
    setEditorLoaded(true);
    setShowFallback(false);

    // Ensure editor has the correct content
    try {
      const yamlContent = YAML.stringify(jobConfig, yamlConfig);
      if (editor.getValue() !== yamlContent) {
        editor.setValue(yamlContent);
      }
      lastJobConfigUpdateStringRef.current = JSON.stringify(jobConfig);
    } catch (e) {
      console.warn(e);
    }
  };

  // Fallback textarea handler
  const handleFallbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEditorValue(value);
    handleChange(value);
  };

  useEffect(() => {
    const lastUpdate = lastJobConfigUpdateStringRef.current;
    const currentUpdate = JSON.stringify(jobConfig);

    // Skip if no changes or editor not yet mounted
    if (lastUpdate === currentUpdate || !isEditorMounted.current) {
      return;
    }

    try {
      // Preserve cursor position and selection
      const editor = editorRef.current;
      if (editor) {
        // Save current editor state
        const position = editor.getPosition();
        const selection = editor.getSelection();
        const scrollTop = editor.getScrollTop();

        // Update content
        const yamlContent = YAML.stringify(jobConfig, yamlConfig);

        // Only update if the content is actually different
        if (yamlContent !== editor.getValue()) {
          // Set value directly on the editor model instead of using React state
          editor.getModel()?.setValue(yamlContent);

          // Restore cursor position and selection
          if (position) editor.setPosition(position);
          if (selection) editor.setSelection(selection);
          editor.setScrollTop(scrollTop);
        }

        lastJobConfigUpdateStringRef.current = currentUpdate;
      }
    } catch (e) {
      console.warn(e);
    }
  }, [jobConfig]);

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;

    try {
      const parsed = YAML.parse(value);
      // Don't update jobConfig if the change came from the editor itself
      // to avoid a circular update loop
      if (JSON.stringify(parsed) !== lastJobConfigUpdateStringRef.current) {
        lastJobConfigUpdateStringRef.current = JSON.stringify(parsed);

        // We have to ensure certain things are always set
        try {
          // parsed.config.process[0].type = 'ui_trainer';
          parsed.config.process[0].sqlite_db_path = './aitk_db.db';
          parsed.config.process[0].training_folder = settings.TRAINING_FOLDER;
          parsed.config.process[0].device = 'cuda';
          parsed.config.process[0].performance_log_every = 10;
        } catch (e) {
          console.warn(e);
        }
        migrateJobConfig(parsed);
        setJobConfig(parsed);
      }
    } catch (e) {
      // Don't update on parsing errors
      console.warn(e);
    }
  };

  return (
    <>
      {showFallback ? (
        <div className="w-full h-full flex flex-col">
          <div className="p-2 bg-yellow-900/30 border-b border-yellow-700 text-yellow-300 text-sm">
            编辑器加载超时，使用备用编辑模式
          </div>
          <textarea
            value={editorValue}
            onChange={handleFallbackChange}
            className="flex-1 w-full bg-gray-900 text-gray-100 font-mono text-sm p-4 resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="yaml"
          value={editorValue}
          theme="vs-dark"
          onChange={handleChange}
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
          }}
        />
      )}
    </>
  );
}
