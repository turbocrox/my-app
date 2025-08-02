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

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  const modelToUse: WhisperWebModel = 'tiny.en';

  useEffect(() => {
    async function initializeWhisper() {
      try {
        setLoading(true);
        
        // Check if browser supports Whisper Web
        const { supported, detailedReason } = await canUseWhisperWeb(modelToUse);
        if (!supported) {
          setError(`Whisper Web not supported: ${detailedReason}`);
          return;
        }

        // Download model
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

        // Resample audio for Whisper
        console.log('Resampling audio...');
        const channelWaveform = await resampleTo16Khz({
          file: audioBlob,
          onProgress: (p) => console.log(`Resampling (${Math.round(p * 100)}%)...`),
        });

        // Transcribe
        console.log('Transcribing...');
        const { transcription } = await transcribe({
          channelWaveform,
          model: modelToUse,
          onProgress: (p) => console.log(`Transcribing (${Math.round(p * 100)}%)...`),
        });

        const text = transcription.map((t) => t.text).join(' ');
        setTranscript(text);
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Whisper Transcriber</h1>
      
      <button
        disabled={!modelReady || loading}
        onClick={recording ? stopRecording : startRecording}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>
      
      {loading && (
        <div className="text-blue-600 mt-2">
          {modelReady ? "Processing audio..." : "Loading model..."}
        </div>
      )}
      
      {!modelReady && !loading && (
        <div className="text-yellow-700 mt-2">Model not ready</div>
      )}
      
      <div className="mt-6">
        <h2 className="text-xl font-semibular mb-2">Transcript:</h2>
        <p className="bg-gray-100 p-4 rounded">{transcript || "..."}</p>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
