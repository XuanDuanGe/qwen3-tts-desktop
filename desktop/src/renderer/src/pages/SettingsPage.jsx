import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api/settings';
import useMessageStore from '../store/messageStore';

const pageClass = 'mx-auto max-w-[760px] px-7 pb-12 pt-8';
const headerClass = 'mb-6 flex items-center justify-between gap-4';
const eyebrowClass = 'mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary';
const titleClass = 'm-0 text-2xl font-semibold text-text';
const fieldClass = 'grid gap-2 text-[13px] text-[#c5ccd2]';
const inputClass =
  'box-border h-10 w-full rounded-ui border border-border bg-panel px-3 text-text outline-none transition placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

export default function SettingsPage() {
  const pushMessage = useMessageStore((state) => state.push);
  const [modelDownloadProxy, setModelDownloadProxy] = useState('');
  const [audioDownloadDir, setAudioDownloadDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (!active) {
          return;
        }
        setModelDownloadProxy(settings.modelDownloadProxy || '');
        setAudioDownloadDir(settings.audioDownloadDir || '');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setPageError(error.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setPageError('');
    try {
      const settings = await saveSettings({
        modelDownloadProxy,
        audioDownloadDir,
      });
      setModelDownloadProxy(settings.modelDownloadProxy);
      setAudioDownloadDir(settings.audioDownloadDir);
      pushMessage({ level: 'success', content: '全局设置已保存。' });
    } catch (error) {
      setPageError(error.message);
      pushMessage({ level: 'error', content: `保存设置失败：${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={pageClass}>
      <header className={headerClass}>
        <div>
          <p className={eyebrowClass}>SETTINGS</p>
          <h1 className={titleClass}>设置</h1>
        </div>
      </header>
      <form className="grid gap-4" onSubmit={handleSave}>
        <label className={fieldClass}>
          <span>模型下载代理</span>
          <input
            className={inputClass}
            type="text"
            value={modelDownloadProxy}
            onChange={(event) => setModelDownloadProxy(event.target.value)}
            placeholder="http://127.0.0.1:7897"
            disabled={loading || saving}
          />
          <small className="text-[11px] text-text-subtle">留空表示模型下载时不使用代理。</small>
        </label>
        <label className={fieldClass}>
          <span>音频文件下载路径</span>
          <input
            className={inputClass}
            type="text"
            value={audioDownloadDir}
            onChange={(event) => setAudioDownloadDir(event.target.value)}
            placeholder="C:\\Users\\用户名\\Music\\qwen3-tts-downloads"
            disabled={loading || saving}
          />
        </label>
        {pageError ? <p className="m-0 text-[13px] text-danger">{pageError}</p> : null}
        <button
          className="inline-flex min-h-10 w-fit items-center justify-center rounded-ui border border-primary bg-primary px-5 font-semibold text-canvas transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={loading || saving}
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </form>
    </section>
  );
}
