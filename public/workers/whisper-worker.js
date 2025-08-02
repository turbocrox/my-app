// public/worker/whisper.worker.js

// You might need to expose 'whisper' with importScripts if Whisper is a global
// For ES module usage, you'll need a bundler (advanced setup). 
// Example for environment where whisper-wasm exposes a global 'whisper'
self.ctx = null;

self.onmessage = function(e) {
  const { type, audioData } = e.data;

  if (type === "init") {
    self.ctx = new self.whisper.WhisperContext();
    self.postMessage({ type: "init-done" });
  }

  if (type === "transcribe") {
    if (self.ctx) {
      const result = self.ctx.transcribe(audioData);
      self.postMessage({ type: "transcription", text: result });
    } else {
      self.postMessage({ type: "error", message: "Context not initialized" });
    }
  }
};
