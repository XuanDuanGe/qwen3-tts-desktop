import { useEffect, useMemo, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import AudioPlayer from '../../components/AudioPlayer';
import { downloadArtifact, readArtifact } from '../../api/engine';
import { getSettings } from '../../api/settings';
import { track } from '../../api/telemetry';
import useEngineStore from '../../store/engineStore';
import useJobStore from '../../store/jobStore';
import useMessageStore from '../../store/messageStore';
import { CUSTOM_VOICE_MODELS, JOB_STATUS_TEXT } from './constants';
import useVoiceGenerateFormStore from './store';
import { toBytes } from './utils';

const pageClass = 'mx-auto max-w-[760px] px-6 pb-8 pt-6';
const headerClass = 'mb-5 flex items-center justify-between gap-4';
const eyebrowClass = 'mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary';
const titleClass = 'm-0 text-2xl font-semibold text-text';
const fieldClass = 'grid gap-2 text-[13px] text-label';
const radioGroupClass = 'flex flex-wrap items-center gap-[18px] text-[13px] text-label';
const controlClass =
  'box-border w-full rounded-ui border border-border bg-panel px-3 text-text outline-none transition placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary';
const selectClass = `${controlClass} select-control h-10`;
const textareaClass = `${controlClass} app-scrollbar min-h-[88px] resize-y py-[11px]`;
const secondaryButtonClass =
  'inline-flex min-h-10 w-full items-center justify-center rounded-ui border border-primary bg-transparent px-4 font-semibold text-primary transition hover:bg-primary hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-ui border border-primary bg-primary px-4 font-semibold text-canvas transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const previewClass = 'mt-5 rounded-ui border border-border bg-panel p-4';

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
    <section className={pageClass}>
      <header className={headerClass}>
        <div>
          <p className={eyebrowClass}>QWEN3 TTS</p>
          <h1 className={titleClass}>声音生成</h1>
        </div>
      </header>
      <form className="grid gap-3.5" onSubmit={handleSubmit}>
        <label className={fieldClass}>
          <span>模型</span>
          <select className={selectClass} value={modelId} onChange={handleModelChange}>
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
          className={secondaryButtonClass}
          type="button"
          disabled={!modelId || loadingCapabilities || status !== 'ready'}
          onClick={handleCapabilities}
        >
          {loadingCapabilities ? '获取中…' : '获取模型能力'}
        </button>
        <label className={fieldClass}>
          <span>输入文本</span>
          <textarea className={textareaClass}
            rows="6"
            value={text}
            onChange={(event) => setForm({ text: event.target.value })}
            placeholder="输入要转换为语音的文本"
          />
        </label>
        <label className={fieldClass}>
          <span>声音特征描述</span>
          <textarea className={textareaClass}
            rows="3"
            value={instruct}
            onChange={(event) => setForm({ instruct: event.target.value })}
            placeholder="可选，例如：用温柔、自然的语气朗读"
          />
        </label>
        <label className={fieldClass}>
          <span>发言人</span>
          <select className={selectClass}
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
        <label className={fieldClass}>
          <span>语言</span>
          <select className={selectClass}
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
        <fieldset className={radioGroupClass}>
          <legend className="mb-0.5 w-full">分段生成（按行切分文本）</legend>
          <label className="inline-flex items-center gap-1.5 text-text-muted">
            <input
              className="h-3.5 w-3.5 accent-primary"
              type="radio"
              name="splitByLine"
              checked={!splitByLine}
              onChange={() => setForm({ splitByLine: false })}
            />
            否
          </label>
          <label className="inline-flex items-center gap-1.5 text-text-muted">
            <input
              className="h-3.5 w-3.5 accent-primary"
              type="radio"
              name="splitByLine"
              checked={splitByLine}
              onChange={() => setForm({ splitByLine: true })}
            />
            是
          </label>
        </fieldset>
        <button
          className={primaryButtonClass}
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
        <p className="m-0 mt-4 text-[13px] text-danger">{pageError || storeError}</p>
      )}
      {job && (
        <p className="m-0 mt-4 text-xs text-text-muted">
          任务状态：{jobMessage}（{Math.round((job.progress || 0) * 100)}%）
          {isActiveJob ? ` · 已运行 ${elapsedSeconds} s` : ''}
        </p>
      )}
      {currentArtifact && (
        <section className={previewClass}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="m-0 text-[17px] font-semibold text-text">语音预览</h2>
            <button
              className="inline-flex w-fit items-center justify-center gap-2 rounded-ui border border-primary bg-transparent px-4 text-primary transition hover:bg-primary hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              aria-label="下载语音"
              disabled={!currentArtifact}
              onClick={handleDownload}
            >
              <FiDownload aria-hidden="true" />
              下载
            </button>
          </div>
          {audioUrl ? (
            <AudioPlayer key={audioUrl} src={audioUrl} />
          ) : (
            <p className="m-0 text-[13px] text-text-muted">音频加载中…</p>
          )}
        </section>
      )}
    </section>
  );
}
