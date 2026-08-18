/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { FiPause, FiPlay, FiVolume2, FiVolumeX } from 'react-icons/fi';

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) {
    return '--:--';
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const progress = duration ? Math.min((currentTime / duration) * 100, 100) : 0;

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  function handleLoadedMetadata(event) {
    setDuration(event.currentTarget.duration || 0);
  }

  function handleTimeUpdate(event) {
    setCurrentTime(event.currentTarget.currentTime);
  }

  function handleSeek(event) {
    const nextTime = Number(event.target.value);
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handleVolumeChange(event) {
    const nextVolume = Number(event.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = nextVolume;
    }
    setVolume(nextVolume);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
      return;
    }
    audio.pause();
  }

  function toggleMute() {
    const nextVolume = volume ? 0 : 1;
    const audio = audioRef.current;
    if (audio) {
      audio.volume = nextVolume;
    }
    setVolume(nextVolume);
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-ui border border-border bg-surface px-3 py-2">
      <audio
        key={src}
        ref={audioRef}
        className="hidden"
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        className="grid h-8 w-8 flex-none place-items-center rounded-ui border border-primary bg-transparent text-primary transition hover:bg-primary hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        type="button"
        aria-label={playing ? '暂停音频' : '播放音频'}
        onClick={togglePlayback}
      >
        {playing ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
      </button>
      <span className="w-9 flex-none text-right font-mono text-[11px] tabular-nums text-text-muted">
        {formatTime(currentTime)}
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <input
          className="audio-range peer absolute inset-0 h-4 w-full cursor-pointer opacity-0"
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={Math.min(currentTime, duration || 0)}
          aria-label="音频播放进度"
          onChange={handleSeek}
        />
        <span className="pointer-events-none absolute -inset-1 rounded-ui peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2" />
      </div>
      <span className="w-9 flex-none font-mono text-[11px] tabular-nums text-text-muted">
        {formatTime(duration)}
      </span>
      <button
        className="grid h-7 w-7 flex-none place-items-center rounded-ui border-0 bg-transparent text-text-muted transition hover:bg-elevated hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        type="button"
        aria-label={volume ? '静音' : '恢复音量'}
        onClick={toggleMute}
      >
        {volume ? <FiVolume2 aria-hidden="true" /> : <FiVolumeX aria-hidden="true" />}
      </button>
      <input
        className="audio-range h-1.5 w-16 flex-none cursor-pointer accent-primary"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={volume}
        aria-label="音量"
        onChange={handleVolumeChange}
      />
    </div>
  );
}
