import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api/settings';
import useMessageStore from '../store/messageStore';

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
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-page__eyebrow">SETTINGS</p>
          <h1>设置</h1>
        </div>
      </header>
      <form className="settings-page__form" onSubmit={handleSave}>
        <label className="settings-page__field">
          <span>模型下载代理</span>
          <input
            type="text"
            value={modelDownloadProxy}
            onChange={(event) => setModelDownloadProxy(event.target.value)}
            placeholder="http://127.0.0.1:7897"
            disabled={loading || saving}
          />
          <small>留空表示模型下载时不使用代理。</small>
        </label>
        <label className="settings-page__field">
          <span>音频文件下载路径</span>
          <input
            type="text"
            value={audioDownloadDir}
            onChange={(event) => setAudioDownloadDir(event.target.value)}
            placeholder="C:\\Users\\用户名\\Music\\qwen3-tts-downloads"
            disabled={loading || saving}
          />
        </label>
        {pageError ? <p className="settings-page__error">{pageError}</p> : null}
        <button className="settings-page__save" type="submit" disabled={loading || saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </form>
    </section>
  );
}
