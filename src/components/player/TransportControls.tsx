import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { playbackService } from "../../services/playbackService";
import { cycleRepeatMode, skipBy, toggleMute as toggleMuteAction, togglePlayPause } from "../../lib/playbackActions";
import { formatTime } from "../../lib/format";
import { VideoAdjustPopover } from "./VideoAdjustPopover";
import {
  FrameBackIcon,
  FrameForwardIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from "../icons";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

const iconButton =
  "glass-btn flex h-8 w-8 items-center justify-center rounded-md text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))] disabled:opacity-30 disabled:hover:bg-transparent";
const toggleButton = (active: boolean) =>
  `glass-btn flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 ${
    active
      ? "text-[rgb(var(--accent))]"
      : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
  }`;

export function TransportControls() {
  const state = usePlayerStore((s) => s.state);
  const currentTrack = usePlayerStore((s) => s.currentTrack());
  const position = usePlayerStore((s) => s.positionSeconds);
  const duration = usePlayerStore((s) => s.durationSeconds);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const speed = usePlayerStore((s) => s.speed);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const skipIntervalSeconds = useSettingsStore((s) => s.skipIntervalSeconds);

  const [hoverPreview, setHoverPreview] = useState<{ x: number; seconds: number } | null>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const isPlaying = state === "playing";
  const hasMedia = state !== "idle";
  const isPaused = state === "paused";
  const isVideoTrack = Boolean(currentTrack?.isVideo);
  const seekPercent = duration > 0 ? (Math.min(position, duration) / duration) * 100 : 0;
  const volumePercent = (muted ? 0 : volume) * 100;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(e.target.value);
    setPosition(seconds);
    void playbackService.seek(seconds);
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = seekRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPreview({ x: e.clientX - rect.left, seconds: ratio * duration });
  };

  const handleSeekLeave = () => setHoverPreview(null);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setVolume(value);
    void playbackService.setVolume(value);
  };

  const cycleSpeed = () => {
    const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(nextSpeed);
    void playbackService.setSpeed(nextSpeed);
  };

  return (
    <div className="glass-panel flex shrink-0 flex-col gap-2.5 border-t border-[rgb(var(--border))] px-4 py-3">
      <div className="relative">
        <AnimatePresence>
          {hoverPreview && hasMedia && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-[rgb(var(--bg))] px-2 py-1 text-[11px] tabular-nums text-[rgb(var(--text))] shadow-sm"
              style={{ left: hoverPreview.x }}
            >
              {formatTime(hoverPreview.seconds)}
            </motion.div>
          )}
        </AnimatePresence>
        <input
          ref={seekRef}
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(position, duration || 0)}
          onChange={handleSeek}
          onMouseMove={handleSeekHover}
          onMouseLeave={handleSeekLeave}
          disabled={!hasMedia}
          className="aurex-range aurex-range-seek w-full"
          style={{ ["--progress" as string]: `${seekPercent}%` }}
          aria-label="Seek"
        />
        <div className="flex items-center justify-between px-0.5 pt-1 text-[11px] tabular-nums text-[rgb(var(--text-muted))]">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => skipBy(-skipIntervalSeconds)}
            disabled={!hasMedia}
            className={iconButton}
            aria-label={`Skip back ${skipIntervalSeconds}s`}
            title={`Skip back ${skipIntervalSeconds}s`}
          >
            <SkipBackIcon className="h-[18px] w-[18px]" seconds={skipIntervalSeconds} />
          </button>
          <button onClick={previous} disabled={!hasMedia} className={iconButton} aria-label="Previous">
            <PreviousIcon className="h-[18px] w-[18px]" />
          </button>
          {isPaused && (
            <button
              onClick={() => void playbackService.frameStep(false)}
              disabled={!hasMedia}
              className={iconButton}
              aria-label="Previous frame"
              title="Previous frame"
            >
              <FrameBackIcon className="h-[18px] w-[18px]" />
            </button>
          )}
          <motion.button
            onClick={togglePlayPause}
            disabled={!hasMedia}
            whileTap={{ scale: 0.9 }}
            className="glass-btn relative flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-white disabled:opacity-30"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPlaying ? (
                <motion.span
                  key="pause"
                  initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute flex items-center justify-center"
                >
                  <PauseIcon className="h-4 w-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="play"
                  initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: -45 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute flex translate-x-px items-center justify-center"
                >
                  <PlayIcon className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          {isPaused && (
            <button
              onClick={() => void playbackService.frameStep(true)}
              disabled={!hasMedia}
              className={iconButton}
              aria-label="Next frame"
              title="Next frame"
            >
              <FrameForwardIcon className="h-[18px] w-[18px]" />
            </button>
          )}
          <button onClick={next} disabled={!hasMedia} className={iconButton} aria-label="Next">
            <NextIcon className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => skipBy(skipIntervalSeconds)}
            disabled={!hasMedia}
            className={iconButton}
            aria-label={`Skip forward ${skipIntervalSeconds}s`}
            title={`Skip forward ${skipIntervalSeconds}s`}
          >
            <SkipForwardIcon className="h-[18px] w-[18px]" seconds={skipIntervalSeconds} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleShuffle}
            className={toggleButton(shuffle)}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            title="Shuffle"
          >
            <ShuffleIcon className="h-4 w-4" />
          </button>
          <button
            onClick={cycleRepeatMode}
            className={toggleButton(repeatMode !== "off")}
            aria-label={`Repeat: ${repeatMode}`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === "one" ? <RepeatOneIcon className="h-4 w-4" /> : <RepeatIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={cycleSpeed}
            className="glass-btn h-7 min-w-7 rounded-md px-1.5 text-xs font-medium tabular-nums text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
            aria-label="Playback speed"
            title="Playback speed"
          >
            {speed}x
          </button>
          <VideoAdjustPopover disabled={!hasMedia || !isVideoTrack} />
          <span className="mx-1 h-4 w-px bg-[rgb(var(--border))]" aria-hidden="true" />
          <button
            onClick={toggleMuteAction}
            className="glass-btn flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--text-muted))] transition-colors duration-150 hover:text-[rgb(var(--text))]"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeMutedIcon className="h-[18px] w-[18px]" />
            ) : (
              <VolumeHighIcon className="h-[18px] w-[18px]" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            className="aurex-range w-24"
            style={{ ["--progress" as string]: `${volumePercent}%` }}
            aria-label="Volume"
          />
          <span className="w-8 text-right tabular-nums text-[rgb(var(--text-muted))]">
            {Math.round(volumePercent)}%
          </span>
        </div>
      </div>
    </div>
  );
}
