'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';

function subscribe() {
  return () => {};
}

function getIsSupportedSnapshot() {
  return Boolean(
    typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

function getServerSnapshot() {
  return false;
}

/**
 * useSpeechRecognition - Custom React hook for Browser Speech-to-Text
 *
 * Implements standard Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * with graceful fallback for unsupported browsers, permission denials, and interrupted speech.
 *
 * @param {Object} options
 * @param {string} [options.lang='en-US'] - Language code for speech recognition
 * @param {boolean} [options.continuous=true] - Continuous recognition across speech pauses
 * @param {boolean} [options.interimResults=true] - Stream interim recognition results
 * @returns {Object} { isSupported, isListening, transcript, interimTranscript, error, startListening, stopListening, resetTranscript }
 */
export function useSpeechRecognition({
  lang = 'en-US',
  continuous = true,
  interimResults = true,
} = {}) {
  const isSupported = useSyncExternalStore(
    subscribe,
    getIsSupportedSnapshot,
    getServerSnapshot
  );

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // Initialize SpeechRecognition instance
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = langRef.current;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interimChunk += result[0].transcript;
        }
      }

      if (finalChunk) {
        setTranscript((prev) => (prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim()));
      }
      setInterimTranscript(interimChunk);
    };

    recognition.onerror = (event) => {
      const errType = event.error;
      let userFriendlyError = 'Speech recognition error occurred';

      switch (errType) {
        case 'not-allowed':
        case 'service-not-allowed':
          userFriendlyError = 'Microphone permission was denied. Please allow microphone access or type your answer.';
          break;
        case 'no-speech':
          userFriendlyError = 'No speech detected. Please speak closer to your microphone or type directly.';
          break;
        case 'audio-capture':
          userFriendlyError = 'No microphone device was detected on your system.';
          break;
        case 'network':
          userFriendlyError = 'Speech recognition network error. Please check your connection or continue typing.';
          break;
        case 'aborted':
          // User aborted or restarted; don't flash alarming error
          userFriendlyError = null;
          break;
        default:
          userFriendlyError = `Speech recognition error: ${errType}`;
      }

      if (userFriendlyError) {
        setError(userFriendlyError);
      }
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      setInterimTranscript('');
    };

    return recognition;
  }, [continuous, interimResults]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Voice recognition is not supported in this browser.');
      return;
    }

    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initRecognition();
      }

      if (recognitionRef.current) {
        recognitionRef.current.lang = langRef.current;
        recognitionRef.current.start();
      }
    } catch (err) {
      // If already started or browser throws invalid state
      if (err.name === 'InvalidStateError') {
        // Recognition is already active
        setIsListening(true);
        isListeningRef.current = true;
      } else {
        setError('Failed to start voice recognition. Please try typing instead.');
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, [isSupported, initRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {
        // Ignore stop error
      }
    }
    setIsListening(false);
    isListeningRef.current = false;
    setInterimTranscript('');
  }, []);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {
          // Ignore abort error
        }
        recognitionRef.current = null;
      }
      isListeningRef.current = false;
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
