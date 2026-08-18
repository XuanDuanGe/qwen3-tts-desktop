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
  success: { icon: FiCheckCircle, label: 'Success' },
  debug: { icon: FiTool, label: 'Debug' },
  info: { icon: FiInfo, label: 'Info' },
  warn: { icon: FiAlertTriangle, label: 'Warn' },
  error: { icon: FiAlertCircle, label: 'Error' },
};

export default function MessageHost() {
  const messages = useMessageStore((state) => state.messages);
  const remove = useMessageStore((state) => state.remove);

  return (
    <div className="message-host" aria-live="polite" aria-atomic="true">
      {messages.map((message) => {
        const meta = LEVEL_META[message.level] || LEVEL_META.info;
        const Icon = meta.icon;
        return (
          <div
            key={message.id}
            className={`message message--${message.level} ${message.visible ? 'message--visible' : 'message--hidden'}`}
            role="status"
          >
            <div className="message__icon">
              <Icon aria-hidden="true" />
            </div>
            <div className="message__content">
              <strong>{meta.label}</strong>
              <span>{message.content}</span>
            </div>
            <button
              className="message__close"
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
