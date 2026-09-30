import type { createMotionRenderer } from "./motion-blur.js";
import type { connectFrameStream } from "./video-stream.js";

declare global {
	interface Window {
		ready: boolean;
		motionRenderer: ReturnType<typeof createMotionRenderer>;
		frameStream: Awaited<ReturnType<typeof connectFrameStream>>;
		seek: (t: number) => void;
		seekBlur: (t: number, samples: number, fps?: number) => void;
		subframes: (t: number) => number;
	}
}
