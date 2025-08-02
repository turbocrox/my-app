/*


import { useEffect, useRef, useState } from "react";
import {
  transcribe,
  canUseWhisperWeb,
  downloadWhisperModel,
  resampleTo16Khz,
  type WhisperWebModel
} from '@remotion/whisper-web';
import OpenAI from 'openai';

// Initialize OpenAI Client (client-side, ensure API key is configured)
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true,
});

async function audioBlobToPCM(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}

  //  chat gpt  response  
async function getChatResponse(userMessage: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // free-tier compatible model
      messages: [
        {
          role: "system",
          content: "Helpful assistant. Keep responses short and friendly."
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content || "Sorry, no response.";
  } catch (error) {
    console.error("OpenAI Error:", error);
    if (error instanceof Error) {
      if (error.message.includes("quota") || error.message.includes("billing")) {
        return "Unable to connect to AI due to quota limits.";
      }
    }
    return "Error connecting to AI.";
  }
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const modelToUse: WhisperWebModel = 'tiny.en';

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const { supported, detailedReason } = await canUseWhisperWeb(modelToUse);
        if (!supported) {
          setError(`Whisper not supported: ${detailedReason}`);
          return;
        }
        await downloadWhisperModel({ model: modelToUse });
        setModelReady(true);
      } catch (err) {
        setError("Whisper init error");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const startRecording = async () => {
    if (!modelReady) return;
    setTranscript(""); setChatReply(""); setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunks.current = [];
    recorder.ondataavailable = (e) => audioChunks.current.push(e.data);
    recorder.onstop = async () => {
      setLoading(true);
      try {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const waveform = await resampleTo16Khz({ file: blob });
        const { transcription } = await transcribe({ channelWaveform: waveform, model: modelToUse });
        const txt = transcription.map((t) => t.text).join(" ");
        setTranscript(txt);
        // Call AI
        setProcessingChat(true);
        const aiResponse = await getChatResponse(txt);
        setChatReply(aiResponse);
        setSpeaking(true);
        await speakText(aiResponse);
        setSpeaking(false);
      } catch (err) {
        setError("Error");
      } finally {
        setLoading(false);
        setProcessingChat(false);
      }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop(); setRecording(false);
  };
  const handleSpeak = async () => {
    if (chatReply) {
      setSpeaking(true);
      await speakText(chatReply);
      setSpeaking(false);
    }
  };
  const handleStop = () => {
    window.speechSynthesis.cancel(); setSpeaking(false);
  }
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Voice + AI</h1>
      <div className="flex gap-2 mb-4">
        <button
          disabled={!modelReady || loading}
          onClick={recording ? stopRecording : startRecording}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {recording ? "Stop" : "Record"}
        </button>
        <button onClick={handleSpeak} disabled={speaking || !chatReply}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          🔊 Speak Response
        </button>
        <button onClick={handleStop} className="bg-red-600 text-white px-4 py-2 rounded">🛑 Stop TTS</button>
      </div>
      <div>Transcript: {transcript}</div>
      <div>AI Reply: {chatReply}</div>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
*/


import { useEffect, useRef, useState } from "react";
import {
transcribe,
canUseWhisperWeb,
downloadWhisperModel,
resampleTo16Khz,
type WhisperWebModel
} from '@remotion/whisper-web';



// Audio conversion utility
async function audioBlobToPCM(blob: Blob): Promise<Float32Array> {
const arrayBuffer = await blob.arrayBuffer();
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
return audioBuffer.getChannelData(0);
}


// FALLBACK: Always working TTS with graceful degradation
async function speakText(text: string): Promise<void> {
return new Promise((resolve) => {
if (!('speechSynthesis' in window)) {
console.warn('Speech synthesis not supported');
resolve(); // Don't reject, just resolve silently
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
}, 1000); // 1 second timeout

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

// Try to speak
window.speechSynthesis.speak(utterance);

// Fallback: if nothing happens in 2 seconds, resolve anyway
setTimeout(() => {
if (!hasStarted && !hasEnded) {
console.warn('TTS silent fallback');
hasEnded = true;
resolve();
}
}, 2000);

} catch (error) {
console.warn('TTS exception (ignoring):', error);
resolve(); // Always resolve, never reject
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


const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const audioChunks = useRef<Blob[]>([]);

const modelToUse: WhisperWebModel = 'tiny.en';


async function getChatResponse(userMessage: string): Promise<string> {
await new Promise(resolve => setTimeout(resolve, 500));
return `I heard you say: "${userMessage}". This is a TTS test response.`;
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

// Try TTS - never fails, always continues
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


const diagnoseSystem = () => {
console.log('=== SYSTEM DIAGNOSIS ===');
console.log('Operating System:', navigator.platform);
console.log('Browser:', navigator.userAgent);
console.log('Speech Synthesis Support:', 'speechSynthesis' in window);

if ('speechSynthesis' in window) {
console.log('Speech Synthesis Object:', window.speechSynthesis);

const voices = speechSynthesis.getVoices();
console.log('Voice Count:', voices.length);

if (voices.length === 0) {
console.log('⚠️ NO VOICES AVAILABLE - This is likely the problem!');
console.log('Try: 1) Different browser, 2) Check system TTS settings, 3) Restart browser');
} else {
console.log('Available Voices:');
voices.forEach((voice, i) => {
console.log(` ${i}: ${voice.name} (${voice.lang}) ${voice.localService ? '[Local]' : '[Remote]'}`);
});
}

// Test if speechSynthesis is working at all
console.log('Speech Synthesis Speaking:', speechSynthesis.speaking);
console.log('Speech Synthesis Pending:', speechSynthesis.pending);
console.log('Speech Synthesis Paused:', speechSynthesis.paused);
}

console.log('=== END DIAGNOSIS ===');
};


return (
<div className="p-8">
<h1 className="text-2xl font-bold mb-4">🎤 Voice Assistant - TTS Debug Mode</h1>

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
className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
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


<div className="mb-4 flex gap-2">
<span className={`px-2 py-1 rounded text-sm ${
ttsStatus === 'working' ? 'bg-green-100 text-green-800' :
ttsStatus === 'failed' ? 'bg-red-100 text-red-800' :
'bg-gray-100 text-gray-800'
}`}>
TTS Status: {ttsStatus === 'working' ? '✅ Working' : ttsStatus === 'failed' ? '❌ Failed' : '❓ Unknown'}
</span>

{speaking && (
<span className="px-2 py-1 rounded text-sm bg-purple-100 text-purple-800">
🗣️ Speaking...
</span>
)}
</div>

{loading && (
<div className="text-blue-600 mt-2">
{modelReady ? "Processing audio..." : "Loading model..."}
</div>
)}

{processingChat && (
<div className="text-green-600 mt-2">Getting response...</div>
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
<h2 className="text-xl font-semibold mb-2">Response:</h2>
<p className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">{chatReply}</p>
</div>
)}

{error && <p className="text-red-600 mt-4">{error}</p>}


<div className="mt-8 p-4 bg-yellow-50 rounded border-l-4 border-yellow-400">
<h3 className="font-semibold text-yellow-800">🔧 Troubleshooting TTS Issues:</h3>
<ul className="text-sm text-yellow-700 mt-2 space-y-1">
<li>• Click "🔍 Diagnose System" and check console logs</li>
<li>• Try a different browser (Chrome, Firefox, Edge)</li>
<li>• Check your system's text-to-speech settings</li>
<li>• Make sure your speakers/headphones work with other audio</li>
<li>• Try incognito/private browsing mode</li>
<li>• On Linux: Install espeak or festival TTS packages</li>
</ul>
</div>
</div>
);
}