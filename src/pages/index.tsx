import { useEffect, useRef, useState } from "react";
import {
  transcribe,
  canUseWhisperWeb,
  downloadWhisperModel,
  resampleTo16Khz,
  type WhisperWebModel
} from '@remotion/whisper-web';
import OpenAI from 'openai';

// Initialize OpenAI client (only used when AI is enabled)
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true,
});

// Audio conversion utility
async function audioBlobToPCM(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}

// Text-to-Speech function
async function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = 1;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      let hasStarted = false;
      let hasEnded = false;
      
      const timeout = setTimeout(() => {
        if (!hasStarted && !hasEnded) {
          console.warn('TTS timeout - assuming success');
          hasEnded = true;
          resolve();
        }
      }, 1000);
      
      utterance.onstart = () => {
        console.log('TTS started successfully');
        hasStarted = true;
        clearTimeout(timeout);
      };
      
      utterance.onend = () => {
        if (!hasEnded) {
          console.log('TTS ended successfully');
          hasEnded = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      
      utterance.onerror = (event) => {
        console.warn('TTS error (ignoring):', event.error);
        if (!hasEnded) {
          hasEnded = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      
      window.speechSynthesis.speak(utterance);
      
      setTimeout(() => {
        if (!hasStarted && !hasEnded) {
          console.warn('TTS silent fallback');
          hasEnded = true;
          resolve();
        }
      }, 2000);
      
    } catch (error) {
      console.warn('TTS exception (ignoring):', error);
      resolve();
    }
  });
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingChat, setProcessingChat] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<'unknown' | 'working' | 'failed'>('unknown');
  
  // NEW: AI Toggle State
  const [aiEnabled, setAiEnabled] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  const modelToUse: WhisperWebModel = 'tiny.en';

  // Dynamic Chat Response Function - switches based on aiEnabled state
  async function getChatResponse(userMessage: string): Promise<string> {
    if (!aiEnabled) {
      // Mock response when AI is disabled
      await new Promise(resolve => setTimeout(resolve, 500));
      return `I heard you say: "${userMessage}`;
    }

    // Real OpenAI integration when AI is enabled
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful voice assistant. Keep responses concise and conversational, under 100 words."
          },
          {
            role: "user", 
            content: userMessage
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('quota') || error.message.includes('billing')) {
          return `I heard you say: "${userMessage}". I'm having trouble connecting to ChatGPT right now due to API limits. Please check your OpenAI credits or try again later.`;
        }
        if (error.message.includes('rate limit')) {
          return `I heard you say: "${userMessage}". I'm being rate limited by ChatGPT. Please wait a moment and try again.`;
        }
      }
      
      return `I heard you say: "${userMessage}". I'm having trouble connecting to ChatGPT right now, but I can still transcribe your speech perfectly!`;
    }
  }

  useEffect(() => {
    async function initializeWhisper() {
      try {
        setLoading(true);
        
        const { supported, detailedReason } = await canUseWhisperWeb(modelToUse);
        if (!supported) {
          setError(`Whisper Web not supported: ${detailedReason}`);
          return;
        }

        console.log('Downloading Whisper model...');
        await downloadWhisperModel({
          model: modelToUse,
          onProgress: ({ progress }) => {
            console.log(`Downloading model (${Math.round(progress * 100)}%)...`);
          },
        });

        setModelReady(true);
        console.log('Whisper model ready!');
      } catch (err) {
        setError("Failed to initialize Whisper: " + (err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    initializeWhisper();
  }, []);

  const startRecording = async () => {
    if (!modelReady) return;
    
    setTranscript("");
    setChatReply("");
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    audioChunks.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        setLoading(true);
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        audioChunks.current = [];

        const channelWaveform = await resampleTo16Khz({
          file: audioBlob,
          onProgress: (p) => console.log(`Resampling (${Math.round(p * 100)}%)...`),
        });

        const { transcription } = await transcribe({
          channelWaveform,
          model: modelToUse,
          onProgress: (p) => console.log(`Transcribing (${Math.round(p * 100)}%)...`),
        });

        const text = transcription.map((t) => t.text).join(' ');
        setTranscript(text);

        if (text.trim()) {
          setProcessingChat(true);
          try {
            const response = await getChatResponse(text);
            setChatReply(response);
            
            // Automatically speak the response
            setSpeaking(true);
            await speakText(response);
            setSpeaking(false);
            
          } catch (err) {
            setError("Error: " + (err as Error).message);
          } finally {
            setProcessingChat(false);
          }
        }

      } catch (err) {
        setError("Transcription failed: " + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleSpeak = async () => {
    if (chatReply) {
      setSpeaking(true);
      await speakText(chatReply);
      setSpeaking(false);
    }
  };

  const handleStopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const testTTS = async () => {
    console.log('=== TTS TEST START ===');
    setSpeaking(true);
    
    try {
      await speakText("Hello, this is a test. Can you hear me?");
      setTtsStatus('working');
      console.log('=== TTS TEST: SUCCESS ===');
    } catch (error) {
      setTtsStatus('failed');
      console.log('=== TTS TEST: FAILED ===', error);
    }
    
    setSpeaking(false);
  };

  const testChatGPT = async () => {
    if (!aiEnabled) {
      setError("AI is disabled. Enable AI toggle first to test ChatGPT.");
      return;
    }
    
    setProcessingChat(true);
    try {
      const response = await getChatResponse("Hello, can you introduce yourself?");
      setChatReply(response);
    } catch (err) {
      setError("ChatGPT test failed: " + (err as Error).message);
    } finally {
      setProcessingChat(false);
    }
  };

  const diagnoseSystem = () => {
    console.log('=== SYSTEM DIAGNOSIS ===');
    console.log('Operating System:', navigator.platform);
    console.log('Browser:', navigator.userAgent);
    console.log('Speech Synthesis Support:', 'speechSynthesis' in window);
    console.log('AI Integration:', aiEnabled ? 'ENABLED' : 'DISABLED');
    console.log('OpenAI API Key configured:', !!process.env.NEXT_PUBLIC_OPENAI_API_KEY);
    
    if ('speechSynthesis' in window) {
      const voices = speechSynthesis.getVoices();
      console.log('Voice Count:', voices.length);
      
      if (voices.length === 0) {
        console.log('⚠️ NO VOICES AVAILABLE - This is likely the TTS problem!');
      } else {
        console.log('Available Voices:');
        voices.forEach((voice, i) => {
          console.log(`  ${i}: ${voice.name} (${voice.lang}) ${voice.localService ? '[Local]' : '[Remote]'}`);
        });
      }
    }
    
    console.log('=== END DIAGNOSIS ===');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">🎤 AI Voice Assistant - Dynamic Toggle</h1>
      
      {/* AI TOGGLE BUTTON - BIG AND PROMINENT */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">🤖 AI Integration</h3>
            <p className="text-sm text-gray-600">
              {aiEnabled ? 'ChatGPT responses enabled' : 'Using mock responses only'}
            </p>
          </div>
          <button
            onClick={() => setAiEnabled(!aiEnabled)}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 ${
              aiEnabled 
                ? 'bg-green-600 hover:bg-green-700 shadow-lg' 
                : 'bg-gray-500 hover:bg-gray-600'
            }`}
          >
            {aiEnabled ? '✅ AI ENABLED' : '❌ AI DISABLED'}
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          disabled={!modelReady || loading}
          onClick={recording ? stopRecording : startRecording}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {recording ? "Stop Recording" : "Start Recording"}
        </button>

        <button
          onClick={testTTS}
          disabled={speaking}
          className="bg-purple-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
        >
          🔊 Test TTS
        </button>

        <button
          onClick={testChatGPT}
          disabled={processingChat || !aiEnabled}
          className={`px-3 py-2 rounded text-sm disabled:opacity-50 ${
            aiEnabled 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-400 text-gray-700 cursor-not-allowed'
          }`}
        >
          🤖 Test ChatGPT
        </button>

        <button
          onClick={diagnoseSystem}
          className="bg-gray-600 text-white px-3 py-2 rounded text-sm"
        >
          🔍 Diagnose System
        </button>

        {chatReply && (
          <>
            <button
              onClick={handleSpeak}
              disabled={speaking}
              className="bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              🔊 Speak Response
            </button>
            <button
              onClick={handleStopSpeaking}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              🛑 Stop
            </button>
          </>
        )}
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <span className={`px-2 py-1 rounded text-sm ${
          ttsStatus === 'working' ? 'bg-green-100 text-green-800' :
          ttsStatus === 'failed' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          TTS: {ttsStatus === 'working' ? '✅ Working' : ttsStatus === 'failed' ? '❌ Failed' : '❓ Unknown'}
        </span>
        
        <span className={`px-2 py-1 rounded text-sm ${
          aiEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          AI: {aiEnabled ? '🤖 ChatGPT Active' : '❌ Mock Responses'}
        </span>
        
        {speaking && (
          <span className="px-2 py-1 rounded text-sm bg-purple-100 text-purple-800">
            🗣️ Speaking...
          </span>
        )}
        
        {processingChat && (
          <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
            {aiEnabled ? '🤖 ChatGPT Thinking...' : '📝 Processing...'}
          </span>
        )}
      </div>
      
      {loading && (
        <div className="text-blue-600 mt-2">
          {modelReady ? "Processing audio..." : "Loading model..."}
        </div>
      )}
      
      {!modelReady && !loading && (
        <div className="text-yellow-700 mt-2">Model not ready</div>
      )}
      
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">You said:</h2>
        <p className="bg-gray-100 p-4 rounded">{transcript || "..."}</p>
      </div>

      {chatReply && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">
            {aiEnabled ? 'ChatGPT Reply:' : 'Response:'}
          </h2>
          <p className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">{chatReply}</p>
        </div>
      )}
      
      {error && <p className="text-red-600 mt-4">{error}</p>}

      <div className="mt-8 p-4 bg-blue-50 rounded border-l-4 border-blue-400">
        <h3 className="font-semibold text-blue-800">🚀 How to Use Your Dynamic Voice Assistant:</h3>
        <ol className="text-sm text-blue-700 mt-2 space-y-1">
          <li>1. <strong>Toggle AI integration</strong> on/off using the big button above</li>
          <li>2. <strong>Click "Start Recording"</strong> and speak your question</li>
          <li>3. <strong>Click "Stop Recording"</strong> when done</li>
          <li>4. <strong>Get response</strong> - Real AI (if enabled) or mock response</li>
          <li>5. <strong>Listen to TTS</strong> speak the response (works in Firefox)</li>
        </ol>
      </div>
    </div>
  );
}
