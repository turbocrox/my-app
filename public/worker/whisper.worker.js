// public/worker/whisper.worker.js
console.log('self.whisper:', self.whisper);

self.ctx = null;

self.onmessage = function(e) {
  const { type, audioData } = e.data;

  if (type === "init") {
    // Initialize Whisper context
    self.ctx = new self.whisper.WhisperContext();
    self.postMessage({ type: "init-done" });
  }

  if (type === "transcribe") {
    if (self.ctx) {
      try {
        const text = self.ctx.transcribe(audioData);
        self.postMessage({ type: "transcription", text });
      } catch (err) {
        self.postMessage({ type: "error", message: err.message });
      }
    } else {
      self.postMessage({ type: "error", message: "Context not initialized" });
    }
  }
};

console.log('self.whisper:', self.whisper);

self.ctx = null;

self.onmessage = function(e) {
  const { type, audioData } = e.data;

  if (type === "init") {
    // Initialize Whisper context
    self.ctx = new self.whisper.WhisperContext();
    self.postMessage({ type: "init-done" });
  }

  if (type === "transcribe") {
    if (self.ctx) {
      try {
        const text = self.ctx.transcribe(audioData);
        self.postMessage({ type: "transcription", text });
      } catch (err) {
        self.postMessage({ type: "error", message: err.message });
      }
    } else {
      self.postMessage({ type: "error", message: "Context not initialized" });
    }
  }
};
