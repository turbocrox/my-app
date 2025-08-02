// src/worker/whisper.worker.ts

import * as whisper from "whisper-wasm";

let ctx: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, audioData } = e.data;

  if (type === "init") {
    try {
      await whisper.init();
      ctx = new (whisper as any).WhisperContext();
      self.postMessage({ type: "init-done" });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: "Failed to initialize Whisper: " + (err as Error).message,
      });
    }
  }

  if (type === "transcribe") {
    if (ctx) {
      try {
        const result = ctx.transcribe(audioData);
        self.postMessage({ type: "transcription", text: result });
      } catch (err) {
        self.postMessage({
          type: "error",
          message: "Transcription failed: " + (err as Error).message,
        });
      }
    } else {
      self.postMessage({
        type: "error",
        message: "Context not initialized",
      });
    }
  }
};

export {}; // Ensures this file is treated as a module.
