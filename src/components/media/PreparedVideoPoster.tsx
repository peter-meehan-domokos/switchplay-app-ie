import { useLayoutEffect, useRef } from "react";

// React owns the mount point; the Card cache owns and retains the image node.
export default function PreparedVideoPoster({ image, fading }: { image: HTMLImageElement; fading: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    mount.current?.append(image);
    return () => { image.remove(); };
  }, [image]);
  useLayoutEffect(() => {
    image.setAttribute("class", `switchplay-video-poster${fading ? " switchplay-video-poster--fade-out" : ""}`);
  }, [image, fading]);
  return <div ref={mount} style={{ display: "contents" }} />;
}
