import { useEffect, useMemo, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { downloadArtifact, readArtifact } from '../../api/engine';
import { getSettings } from '../../api/settings';
import { track } from '../../api/telemetry';
import useEngineStore from '../../store/engineStore';
import useJobStore from '../../store/jobStore';
import useMessageStore from '../../store/messageStore';
import { CUSTOM_VOICE_MODELS, JOB_STATUS_TEXT } from './constants';
import useVoiceGenerateFormStore from './store';
import { toBytes } from './utils';

export default function VoiceGeneratePage() {
  const status = useEngineStore((state) => state.status);
  const models = useEngineStore((state) => state.models);
  const getCapabilities = useEngineStore((state) => state.getModelCapabilities);
  const installModel = useEngineStore((state) => state.installModel);
  const jobs = useJobStore((state) => state.jobs);
  const submit = useJobStore((state) => state.submit);
  const storeError = useJobStore((state) => state.error);
  const pushMessage = useMessageStore((state) => state.push);
  const availableModels = useMemo(
    () =>
      models.filter(
        (model) =>
          CUSTOM_VOICE_MODELS.has(model.modelId) &&
          model.capabilities.includes('custom_voice'),
      ),
    [models],
  );
  const form = useVoiceGenerateFormStore((state) => state.form);
  const setForm = useVoiceGenerateFormStore((state) => state.setForm);
  const { modelId, capabilities, text, instruct, speaker, language, splitByLine } = form;
  const [jobId, setJobId] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [pageError, setPageError] = useState('');
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [installingModel, setInstallingModel] = useState(false);
  const [modelDownloadProxy, setModelDownloadProxy] = useState('');

  const job = jobId ? jobs[jobId] : null;
  const generating = Boolean(
    job && ['queued', 'preparing', 'running'].includes(job.status),
  );
  const selectedModel = availableModels.find(
    (model) => model.modelId === modelId,
  );
  const currentArtifact = job?.status === 'succeeded' ? job.result : null;
  const jobMessage = job?.message || JOB_STATUS_TEXT[job?.status] || '处理中';
  const [now, setNow] = useState(0);
  const isActiveJob = Boolean(
    job && ['preparing', 'running'].includes(job.status) && job.startedAt,
  );
  const elapsedSeconds = isActiveJob
    ? now
      ? ((now / 1000) - job.startedAt).toFixed(1)
      : '0.0'
    : '';

  useEffect(() => {
    track('component_used', { component: 'voice_generate_page' }, { once: true });
  }, []);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (!active) {
          return;
        }
        setModelDownloadProxy(settings.modelDownloadProxy || '');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setPageError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentArtifact?.artifactId) {
      return undefined;
    }
    let active = true;
    readArtifact(currentArtifact.artifactId)
      .then((value) => {
        if (!active) return;
        const url = URL.createObjectURL(
          new Blob([toBytes(value)], {
            type: currentArtifact.mimeType || 'audio/wav',
          }),
        );
        setAudioUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return url;
        });
        track('artifact_preview_ready', { success: true });
      })
      .catch((error) => setPageError(error.message));
    return () => {
      active = false;
    };
  }, [currentArtifact]);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  useEffect(() => {
    if (!isActiveJob) {
      return undefined;
    }
    const timer = globalThis.setInterval(() => setNow(Date.now()), 100);
    return () => globalThis.clearInterval(timer);
  }, [isActiveJob, jobId]);

  function handleModelChange(event) {
    setForm({
      modelId: event.target.value,
      capabilities: { speakers: [], languages: [] },
      speaker: '',
      language: 'Auto',
    });
  }

  async function handleCapabilities() {
    if (!modelId) return;
    const requestedModelId = modelId;
    setLoadingCapabilities(true);
    setPageError('');
    pushMessage({ level: 'info', content: '开始加载模型能力。' });
    try {
      const result = await getCapabilities(requestedModelId);
      track('model_capabilities_requested', { success: true });
      if (
        useVoiceGenerateFormStore.getState().form.modelId !== requestedModelId
      ) {
        return;
      }
      setForm({
        capabilities: result,
        speaker: result.speakers[0] || '',
        language: result.languages[0] || 'Auto',
      });
      pushMessage({ level: 'success', content: '模型能力已加载。' });
    } catch (error) {
      setPageError(error.message);
      pushMessage({ level: 'error', content: `加载模型能力失败：${error.message}` });
    } finally {
      setLoadingCapabilities(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!modelId || !text.trim() || !speaker || !language) {
      setPageError('请选择模型、获取能力并填写文本、发言人和语言。');
      return;
    }
    setPageError('');
    track('generation_submitted', {
      kind: 'custom_voice',
      split_by_line: splitByLine,
      text_length_bucket:
        text.trim().length > 500
          ? '501_plus'
          : text.trim().length > 100
            ? '101_500'
            : '1_100',
    });
    setInstallingModel(!selectedModel?.installed);
    try {
      if (!selectedModel?.installed) {
        pushMessage({ level: 'info', content: '开始加载模型。' });
        await installModel(modelId, modelDownloadProxy.trim() || undefined);
        pushMessage({ level: 'success', content: '模型加载成功。' });
      }
      pushMessage({ level: 'info', content: '开始语音生成任务。' });
      const nextJob = await submit({
        kind: 'custom_voice',
        modelId,
        text: text.trim(),
        instruct: instruct.trim() || undefined,
        speaker,
        language,
        splitByLine,
      });
      setJobId(nextJob.jobId);
    } catch (error) {
      track('generation_failed', { code: error.code || 'unknown' });
      setPageError(error.message);
      pushMessage({ level: 'error', content: `操作失败：${error.message}` });
    } finally {
      setInstallingModel(false);
    }
  }

  async function handleDownload() {
    if (!currentArtifact?.artifactId) {
      return;
    }
    setPageError('');
    pushMessage({ level: 'info', content: '开始下载音频文件。' });
    try {
      await downloadArtifact(currentArtifact.artifactId);
      track('artifact_downloaded', { success: true });
      pushMessage({ level: 'success', content: '音频文件下载完成。' });
    } catch (error) {
      track('generation_failed', { code: error.code || 'unknown' });
      setPageError(error.message);
      pushMessage({ level: 'error', content: `下载音频文件失败：${error.message}` });
    }
  }

  return (
    <section className="voice-generate">
      <header className="voice-generate__header">
        <div>
          <p className="voice-generate__eyebrow">QWEN3 TTS</p>
          <h1>声音生成</h1>
        </div>
        <span
          className={`voice-generate__status voice-generate__status--${status}`}
        >
          引擎：{status}
        </span>
      </header>
      <form className="voice-generate__form" onSubmit={handleSubmit}>
        <label className="voice-generate__field">
          <span>模型</span>
          <select value={modelId} onChange={handleModelChange}>
            <option value="">请选择模型</option>
            {availableModels.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.repoId}
                {model.installed ? '' : '（未安装）'}
              </option>
            ))}
          </select>
        </label>
        <button
          className="voice-generate__secondary-button"
          type="button"
          disabled={!modelId || loadingCapabilities || status !== 'ready'}
          onClick={handleCapabilities}
        >
          {loadingCapabilities ? '获取中…' : '获取模型能力'}
        </button>
        <label className="voice-generate__field">
          <span>输入文本</span>
          <textarea
            rows="6"
            value={text}
            onChange={(event) => setForm({ text: event.target.value })}
            placeholder="输入要转换为语音的文本"
          />
        </label>
        <label className="voice-generate__field">
          <span>声音特征描述</span>
          <textarea
            rows="3"
            value={instruct}
            onChange={(event) => setForm({ instruct: event.target.value })}
            placeholder="可选，例如：用温柔、自然的语气朗读"
          />
        </label>
        <label className="voice-generate__field">
          <span>发言人</span>
          <select
            value={speaker}
            onChange={(event) => setForm({ speaker: event.target.value })}
          >
            <option value="">请先获取模型能力</option>
            {capabilities.speakers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="voice-generate__field">
          <span>语言</span>
          <select
            value={language}
            onChange={(event) => setForm({ language: event.target.value })}
          >
            {capabilities.languages.length ? (
              capabilities.languages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))
            ) : (
              <option value="Auto">请先获取模型能力</option>
            )}
          </select>
        </label>
        <fieldset className="voice-generate__field voice-generate__radio-group">
          <legend>分段生成（按行切分文本）</legend>
          <label>
            <input
              type="radio"
              name="splitByLine"
              checked={!splitByLine}
              onChange={() => setForm({ splitByLine: false })}
            />
            否
          </label>
          <label>
            <input
              type="radio"
              name="splitByLine"
              checked={splitByLine}
              onChange={() => setForm({ splitByLine: true })}
            />
            是
          </label>
        </fieldset>
        <button
          className="voice-generate__primary-button"
          type="submit"
          disabled={generating || installingModel}
        >
          {installingModel
            ? '模型下载中…'
            : generating
              ? jobMessage
              : '开始生成'}
        </button>
      </form>
      {(pageError || storeError) && (
        <p className="voice-generate__error">{pageError || storeError}</p>
      )}
      {job && (
        <p className="voice-generate__job-status">
          任务状态：{jobMessage}（{Math.round((job.progress || 0) * 100)}%）
          {isActiveJob ? ` · 已运行 ${elapsedSeconds} s` : ''}
        </p>
      )}
      {currentArtifact && (
        <section className="voice-generate__preview">
          <div className="voice-generate__preview-header">
            <h2>语音预览</h2>
            <button
              className="voice-generate__download-button"
              type="button"
              aria-label="下载语音"
              disabled={!currentArtifact}
              onClick={handleDownload}
            >
              <FiDownload aria-hidden="true" />
              下载
            </button>
          </div>
          {audioUrl ? <audio controls src={audioUrl} /> : <p>音频加载中…</p>}
        </section>
      )}
    </section>
  );
}
