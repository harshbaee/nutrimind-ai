import { useEffect, useRef, useState } from "react";
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"]; // the codes printed on grocery packs

// The browser's own reader where it has one (Android, macOS, ChromeOS); elsewhere, Windows included, a
// WebAssembly build of ZXing, loaded only when a scan starts and served from this app rather than a CDN.
async function makeDetector(): Promise<Detector> {
  try {
    if (window.BarcodeDetector) return new window.BarcodeDetector({ formats: FORMATS });
  } catch {
    // a native reader without these formats: use ZXing instead
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? zxingWasmUrl : prefix + path) } });
  return new BarcodeDetector({ formats: FORMATS as never });
}

// Scanning needs a camera; without one the barcode can still be typed in.
export const canScan = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

// A camera panel that reads a product barcode, hands it over once, and releases the camera when it closes.
export function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const handOver = useRef(onCode);
  handOver.current = onCode;
  const [error, setError] = useState<string>();

  useEffect(() => {
    dialog.current?.showModal();
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;
    const fail = () => setError("The camera isn't available. Allow camera access, or type the barcode instead.");

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        const detector = await makeDetector();
        if (stopped || !video.current) return s.getTracks().forEach((t) => t.stop());
        video.current.srcObject = s;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]) handOver.current(codes[0].rawValue);
          else timer = window.setTimeout(tick, 250);
        };
        tick();
      })
      .catch(fail);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <dialog ref={dialog} className="na-dialog" aria-labelledby="scan-title" onClose={onClose}>
      <div className="na-dialog-head">
        <h2 id="scan-title" className="np-h2">Scan a barcode</h2>
        <button type="button" className="na-text-btn" onClick={() => dialog.current?.close()}>Close</button>
      </div>
      {error ? (
        <p className="na-sub" role="alert">{error}</p>
      ) : (
        <>
          <video ref={video} className="na-video" muted playsInline aria-label="Camera view" />
          <p className="na-caption">Hold the barcode inside the frame. It's read on its own.</p>
        </>
      )}
    </dialog>
  );
}
