import { RiGithubLine } from 'react-icons/ri';
import useEngineStore from '../store/engineStore';

const STATUS_META = {
  unknown: {
    label: '引擎状态检测中',
    indicator: 'bg-warn shadow-[0_0_0_0_rgba(231,198,106,0.5)] animate-status-pulse',
  },
  stopped: { label: '引擎已停止', indicator: 'bg-text-subtle' },
  starting: {
    label: '引擎启动中',
    indicator: 'bg-warn shadow-[0_0_0_0_rgba(231,198,106,0.5)] animate-status-pulse',
  },
  ready: {
    label: '引擎已就绪',
    indicator: 'bg-success shadow-[0_0_0_0_rgba(103,197,135,0.5)] animate-status-pulse',
  },
  unavailable: {
    label: '引擎不可用',
    indicator: 'bg-danger shadow-[0_0_0_0_rgba(216,120,120,0.5)] animate-status-pulse',
  },
};

export default function StatusBar() {
  const status = useEngineStore((state) => state.status);
  const meta = STATUS_META[status] || STATUS_META.unknown;

  return (
    <footer className="flex h-[36px] flex-none select-none items-center justify-between border-t border-border bg-canvas px-3 text-[11px] text-text-muted">
      <span className="inline-flex items-center gap-1.5" aria-live="polite">
        <span className={`h-[7px] w-[7px] rounded-full ${meta.indicator}`} aria-hidden="true" />
        {meta.label}
      </span>
      <a
        className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border px-2.5 text-text-muted no-underline transition hover:border-primary hover:bg-panel hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        href="https://github.com/XuanDuanGe/qwen3-tts-desktop"
        target="_blank"
        rel="noreferrer"
        aria-label="在 GitHub 查看 qwen3-tts-desktop 项目"
      >
        <RiGithubLine aria-hidden="true" />
        <span>GitHub</span>
      </a>
    </footer>
  );
}
