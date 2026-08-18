import { RiGithubLine } from 'react-icons/ri';
import useEngineStore from '../store/engineStore';

const STATUS_META = {
  unknown: { label: '引擎状态检测中', tone: 'warning' },
  stopped: { label: '引擎已停止', tone: 'neutral' },
  starting: { label: '引擎启动中', tone: 'warning' },
  ready: { label: '引擎已就绪', tone: 'success' },
  unavailable: { label: '引擎不可用', tone: 'error' },
};

export default function StatusBar() {
  const status = useEngineStore((state) => state.status);
  const meta = STATUS_META[status] || STATUS_META.unknown;

  return (
    <footer className="status-bar">
      <span className="status-bar__engine" aria-live="polite">
        <span
          className={`status-bar__indicator status-bar__indicator--${meta.tone}`}
          aria-hidden="true"
        />
        {meta.label}
      </span>
      <a
        className="status-bar__github"
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
