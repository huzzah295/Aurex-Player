import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { formatBitrate, formatBytes, formatTime } from "../../lib/format";

const list: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.025 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.16, ease: "easeOut" } },
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface SubtitleTrackInfo {
  lang: string | null;
  title: string | null;
  codec: string | null;
}

interface MediaInfo {
  title: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  aspect: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  fps: number | null;
  videoBitrateBps: number | null;
  audioBitrateBps: number | null;
  audioChannels: number | null;
  hdr: string | null;
  containerFormat: string | null;
  subtitleTracks: SubtitleTrackInfo[];
  fileSizeBytes: number | null;
  filePath: string | null;
}

export function MediaInfoPanel() {
  const currentTrack = usePlayerStore((s) => s.currentTrack());
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const path = currentTrack?.path;

  useEffect(() => {
    if (!isTauri || !path) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<MediaInfo>("get_media_info", { path });
        if (!cancelled) setInfo(result);
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <h2 className="text-base font-semibold">Media Information</h2>
        <p className="text-sm text-[rgb(var(--text-muted))]">No media loaded.</p>
      </div>
    );
  }

  if (loading || !info) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <h2 className="text-base font-semibold">Media Information</h2>
        <p className="text-sm text-[rgb(var(--text-muted))]">Loading…</p>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Resolution", info.width && info.height ? `${info.width}×${info.height}` : "—"],
    ["Aspect Ratio", info.aspect ? info.aspect.toFixed(2) : "—"],
    ["Video Codec", info.videoCodec ?? "—"],
    ["Audio Codec", info.audioCodec ?? "—"],
    ["FPS", info.fps ? info.fps.toFixed(2) : "—"],
    ["Video Bitrate", info.videoBitrateBps ? formatBitrate(info.videoBitrateBps) : "—"],
    ["Audio Bitrate", info.audioBitrateBps ? formatBitrate(info.audioBitrateBps) : "—"],
    ["Audio Channels", info.audioChannels ? String(info.audioChannels) : "—"],
    ["HDR", info.hdr ?? "SDR"],
    ["Duration", info.durationSeconds ? formatTime(info.durationSeconds) : "—"],
    ["File Size", info.fileSizeBytes ? formatBytes(info.fileSizeBytes) : "—"],
    ["Container Format", info.containerFormat ?? "—"],
    ["File Location", info.filePath ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Media Information</h2>
      <motion.div variants={list} initial="hidden" animate="visible" className="flex flex-col text-sm">
        {rows.map(([label, value]) => (
          <motion.div
            key={label}
            variants={row}
            className="flex items-start justify-between gap-4 border-b border-[rgb(var(--border))] py-1.5 last:border-b-0"
          >
            <span className="shrink-0 text-[rgb(var(--text-muted))]">{label}</span>
            <span className="max-w-[280px] truncate text-right text-[rgb(var(--text))]" title={value}>
              {value}
            </span>
          </motion.div>
        ))}
      </motion.div>
      {info.subtitleTracks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[rgb(var(--text-muted))]">Subtitle Tracks</span>
          {info.subtitleTracks.map((track, i) => (
            <span key={i} className="text-xs text-[rgb(var(--text))]">
              {track.title ?? track.lang ?? `Track ${i + 1}`}
              {track.codec ? ` (${track.codec})` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
