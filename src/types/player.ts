export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export type RepeatMode = "off" | "one" | "all";

export interface MediaTrack {
  id: string;
  path: string;
  title: string;
  durationSeconds: number;
  isVideo: boolean;
}

export interface AudioTrackInfo {
  id: number;
  title: string;
  lang: string;
}

export interface SubtitleTrackInfo {
  id: number;
  title: string;
  lang: string;
  external: boolean;
}

export interface PlayerSnapshot {
  state: PlaybackState;
  positionSeconds: number;
  durationSeconds: number;
  volume: number;
  muted: boolean;
  speed: number;
  errorMessage?: string;
}
