import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { VolumeHighIcon, VolumeMutedIcon } from "../icons";

/** Briefly shows the current volume level whenever it changes (slider drag or scroll-wheel). */
export function VolumeHud() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setVisible(true);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setVisible(false), 1100);
    return () => window.clearTimeout(timeoutRef.current);
  }, [volume, muted]);

  const percent = Math.round((muted ? 0 : volume) * 100);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="volume-hud flex items-center gap-2 rounded-full bg-[rgb(var(--bg-elevated))]/95 px-4 py-2 text-sm text-[rgb(var(--text))] shadow-lg"
          >
            {muted || volume === 0 ? (
              <VolumeMutedIcon className="h-4 w-4" />
            ) : (
              <VolumeHighIcon className="h-4 w-4" />
            )}
            <span className="tabular-nums">{percent}%</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
