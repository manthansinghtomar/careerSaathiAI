'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { transliterateDevanagariToRoman } from '@/lib/transliteration';
import { Button } from '@/components/ui/Button';
import {
  Mic,
  Square,
  AlertCircle,
  X,
  Volume2,
} from 'lucide-react';

/**
 * VoiceRecorder - Reusable Voice-to-Text Component for Assessments & Interviews
 *
 * Supports speech transcription with Web Speech API, visual recording timer,
 * live interim feedback, Roman Hinglish conversion for Hinglish mode,
 * and seamless typing fallback for unsupported browsers or denied permissions.
 *
 * @param {Object} props
 * @param {Function} props.onAppendText - Callback receiving recognized text to append to parent textarea
 * @param {string} [props.preferredLanguage='en'] - 'en' | 'hinglish'
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 */
export function VoiceRecorder({
  onAppendText,
  preferredLanguage = 'en',
  disabled = false,
  className = '',
}) {
  const recognitionLang = preferredLanguage === 'hinglish' ? 'hi-IN' : 'en-US';

  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang: recognitionLang,
    continuous: true,
    interimResults: true,
  });

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [dismissedError, setDismissedError] = useState(null);
  const prevTranscriptRef = useRef('');

  // Timer while listening - no setState calls directly in the effect body
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  // When new final transcript chunk is recognized, append to parent textarea
  // If in Hinglish mode, transliterate Devanagari Hindi into natural Roman Hinglish with tech term preservation
  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      const addedChunk = transcript.slice(prevTranscriptRef.current.length).trim();
      if (addedChunk && onAppendText) {
        const textToAppend =
          preferredLanguage === 'hinglish'
            ? transliterateDevanagariToRoman(addedChunk)
            : addedChunk;
        onAppendText(textToAppend);
      }
      prevTranscriptRef.current = transcript;
    }
  }, [transcript, onAppendText, preferredLanguage]);

  // Reset internal reference when transcript resets
  useEffect(() => {
    if (!transcript) {
      prevTranscriptRef.current = '';
    }
  }, [transcript]);

  // Format seconds to mm:ss
  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleToggleRecord = () => {
    setDismissedError(null);
    if (isListening) {
      stopListening();
      setRecordingSeconds(0);
    } else {
      setRecordingSeconds(0);
      resetTranscript();
      startListening();
    }
  };

  // If browser does not support Web Speech API
  if (!isSupported) {
    return (
      <div className={`text-xs text-slate-500 flex items-center gap-1.5 py-1 ${className}`}>
        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
        <span>Voice input unavailable in this browser. You can type directly in the box below.</span>
      </div>
    );
  }

  const activeError = error && error !== dismissedError ? error : null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isListening ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleToggleRecord}
              disabled={disabled}
              className="h-8 px-3 text-xs font-semibold animate-pulse"
            >
              <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Stop Recording ({formatTimer(recordingSeconds)})
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleToggleRecord}
              disabled={disabled}
              className="h-8 px-3 text-xs font-semibold hover:border-[#0a66c2] hover:text-[#0a66c2]"
            >
              <Mic className="w-3.5 h-3.5 mr-1.5 text-[#0a66c2]" />
              Speak Answer
            </Button>
          )}

          {isListening && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <span>Listening in {preferredLanguage === 'hinglish' ? 'Hinglish (Roman output)' : 'English'}...</span>
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400 italic">
          Spoken words appear in the box and remain 100% editable
        </span>
      </div>

      {/* Interim live speech preview while speaking */}
      {isListening && interimTranscript && (
        <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-[#0a66c2] shrink-0 animate-bounce" />
          <span className="italic line-clamp-1">
            &ldquo;
            {preferredLanguage === 'hinglish'
              ? transliterateDevanagariToRoman(interimTranscript)
              : interimTranscript}
            &rdquo;
          </span>
        </div>
      )}

      {/* Error notification banner with dismissal */}
      {activeError && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{activeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedError(activeError)}
            className="text-amber-500 hover:text-amber-700 p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
