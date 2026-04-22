import { useRef, useCallback, useState } from "react";

export function useSpeech(options = {}) {
  const { lang = "es-CO", rate = 1.0, pitch = 1.0, volume = 1.0 } = options;
  
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(() => "speechSynthesis" in window);
  const queueRef = useRef([]);
  const currentUtteranceRef = useRef(null);

  const processQueue = useCallback(() => {
    if (!supported || queueRef.current.length === 0 || speaking) return;
    
    const text = queueRef.current.shift();
    if (!text) return;

    try {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        currentUtteranceRef.current = null;
        setTimeout(() => processQueue(), 100);
      };
      utterance.onerror = (e) => {
        console.warn("Speech error:", e);
        setSpeaking(false);
        currentUtteranceRef.current = null;
      };
      
      currentUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis failed:", e);
      setSpeaking(false);
    }
  }, [supported, speaking, lang, rate, pitch, volume]);

  const speak = useCallback((text, priority = false) => {
    if (!supported || !text) return;
    
    if (priority) {
      queueRef.current = [];
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    
    queueRef.current.push(text);
    processQueue();
  }, [supported, processQueue]);

  const cancel = useCallback(() => {
    if (!supported) return;
    queueRef.current = [];
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return {
    speak,
    cancel,
    stop,
    speaking,
    supported,
  };
}
