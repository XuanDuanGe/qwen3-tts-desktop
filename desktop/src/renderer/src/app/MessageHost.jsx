import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiTool,
  FiX,
} from 'react-icons/fi';
import useMessageStore from '../store/messageStore';

const LEVEL_META = {
  success: {
    icon: FiCheckCircle,
    label: 'Success',
    classes: 'border-success/50 [&_.message-icon]:text-success',
  },
  debug: {
    icon: FiTool,
    label: 'Debug',
    classes: 'border-debug/50 [&_.message-icon]:text-debug',
  },
  info: {
    icon: FiInfo,
    label: 'Info',
    classes: 'border-info/50 [&_.message-icon]:text-info',
  },
  warn: {
    icon: FiAlertTriangle,
    label: 'Warn',
    classes: 'border-warn/50 [&_.message-icon]:text-warn',
  },
  error: {
    icon: FiAlertCircle,
    label: 'Error',
    classes: 'border-error/50 [&_.message-icon]:text-error',
  },
};

export default function MessageHost() {
  const messages = useMessageStore((state) => state.messages);
  const remove = useMessageStore((state) => state.remove);

  return (
    <div
      className="pointer-events-none fixed right-5 top-12 z-50 grid w-[min(360px,calc(100vw-40px))] gap-3"
      aria-live="polite"
      aria-atomic="true"
    >
      {messages.map((message) => {
        const meta = LEVEL_META[message.level] || LEVEL_META.info;
        const Icon = meta.icon;
        return (
          <div
            key={message.id}
            className={`grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border bg-panel/95 p-3.5 pl-3 shadow-2xl backdrop-blur transition-[opacity,transform] duration-200 ${
              message.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
            } ${meta.classes}`}
            role="status"
          >
            <div className="message-icon mt-0.5 grid h-5 w-5 place-items-center text-lg">
              <Icon aria-hidden="true" />
            </div>
            <div className="grid min-w-0 gap-1">
              <strong className="text-[13px] text-text">{meta.label}</strong>
              <span className="break-words text-[13px] leading-[1.45] text-text-muted">
                {message.content}
              </span>
            </div>
            <button
              className="grid h-6 w-6 place-items-center rounded-md border-0 bg-transparent text-text-muted transition hover:bg-elevated hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              type="button"
              aria-label="关闭消息"
              onClick={() => remove(message.id)}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
