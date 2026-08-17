import { useState } from 'react';

function SettingsPage() {
  const [downloadDir, setDownloadDir] = useState('');
  const [status, setStatus] = useState('设置仅保存在当前界面。');

  const save = (event) => {
    event.preventDefault();
    setStatus(downloadDir.trim() ? '设置已暂存' : '请输入有效的目录');
  };

  const cancel = () => {
    setDownloadDir('');
    setStatus('已取消未保存的更改');
  };

  return (
    <section className="mx-auto w-full max-w-3xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">设置</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          应用设置
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          设置页面仅提供界面组件，不读取或写入桌面端配置文件。
        </p>
      </header>
      <form className="mt-6 flex flex-col gap-4" onSubmit={save}>
        <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          语音下载目录
          <input
            className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text"
            onChange={(event) => setDownloadDir(event.target.value)}
            placeholder="输入目录路径"
            value={downloadDir}
          />
          <span className="mt-2 block text-xs text-text-subtle">
            这是一个独立的界面字段，不会触发文件系统操作。
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            className="rounded-ui border border-primary bg-primary px-4 py-2 text-sm font-semibold text-canvas"
            type="submit"
          >
            保存
          </button>
          <button
            className="rounded-ui border border-border-strong bg-panel px-4 py-2 text-sm font-semibold text-text"
            onClick={cancel}
            type="button"
          >
            取消
          </button>
          <span className="text-xs text-text-subtle">{status}</span>
        </div>
      </form>
    </section>
  );
}

export default SettingsPage;
