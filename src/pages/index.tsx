import { useEffect, useRef, useState } from "react";

// Audio conversion utility
async function audioBlobToPCM(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0); // Use first channel (mono)
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    // Use absolute path for public worker:
    workerRef.current = new Worker("/worker/whisper.worker.js");

    workerRef.current.onmessage = (event) => {
      if (event.data.type === "transcription") {
        setTranscript(event.data.text);
        setError("");
      } else if (event.data.type === "error") {
        setError(event.data.message || "Worker error");
      }
    };

    workerRef.current.postMessage({ type: "init" });
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const startRecording = async () => {
    setTranscript("");
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    audioChunks.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
      audioChunks.current = [];
      try {
        const pcmData = await audioBlobToPCM(audioBlob);
        workerRef.current?.postMessage({ type: "transcribe", audioData: pcmData }, [pcmData.buffer]);
      } catch (err) {
        setError("Audio processing error: " + (err as Error).message);
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
        onClick={recording ? stopRecording : startRecording}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Transcript:</h2>
        <p className="bg-gray-100 p-4 rounded">{transcript || "..."}</p>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
