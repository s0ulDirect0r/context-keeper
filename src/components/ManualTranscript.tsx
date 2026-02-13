'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';
import { isSupportedFile, parseTranscriptFile } from '@/lib/transcript-parsers';

interface Props {
  onSubmit: (transcript: string) => void;
  onBack: () => void;
}

export function ManualTranscript({ onSubmit, onBack }: Props) {
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileError(null);

    if (!isSupportedFile(file.name)) {
      setFileError('I can only read .txt, .srt, and .vtt files right now.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseTranscriptFile(content, file.name);
      setTranscript(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const clearFile = () => {
    setFileName(null);
    setTranscript('');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      onSubmit(transcript.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Upload your transcript</h2>
        <p className="text-muted-foreground">Drop a file and I&apos;ll take it from there.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
            dragActive
              ? 'border-primary ring-2 ring-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          {fileName ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{fileName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop a file here, or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-xs text-muted-foreground/70">.txt, .srt, .vtt</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.srt,.vtt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {fileError && (
          <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{fileError}</span>
            <button type="button" onClick={() => setFileError(null)} className="ml-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={!transcript.trim()}>
            Looks good
          </Button>
        </div>

        {transcript && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Preview</label>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-64 font-mono text-sm"
              readOnly
            />
          </div>
        )}
      </form>
    </div>
  );
}
