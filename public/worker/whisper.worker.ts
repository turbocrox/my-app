import * as whisper from "whisper-wasm";

let ctx: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, audioData } = e.data;
  if (type === "init") {
    ctx = new (whisper as any).WhisperContext();
    self.postMessage({ type: "init-done" });
  }
  if (type === "transcribe") {
    if (ctx) {
      const result = ctx.transcribe(audioData);
      self.postMessage({ type: "transcription", text: result });
    } else {
      self.postMessage({ type: "error", message: "Context not initialized" });
    }
  }
};
