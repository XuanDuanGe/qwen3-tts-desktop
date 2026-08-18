import { useEffect, useMemo, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { downloadArtifact, readArtifact } from '../api/engine';
import useEngineStore from '../store/engineStore';
import useJobStore from '../store/jobStore';
import { track } from '../api/telemetry';

const CUSTOM_VOICE_MODELS = new Set([
  'qwen3-tts-12hz-1.7b-customvoice',
  'qwen3-tts-12hz-0.6b-customvoice',
]);

const JOB_STATUS_TEXT = {
  queued: '等待中',
  preparing: '准备中',
  running: '生成中',
  succeeded: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
};

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value?.type === 'Buffer' && Array.isArray(value.data)) {
    return new Uint8Array(value.data);
  }
  return new Uint8Array(value);
}

export default function VoiceGeneratePage() {
  const status = useEngineStore((state) => state.status);
  const models = useEngineStore((state) => state.models);
  const getCapabilities = useEngineStore((state) => state.getModelCapabilities);
  const installModel = useEngineStore((state) => state.installModel);
  const jobs = useJobStore((state) => state.jobs);
  const submit = useJobStore((state) => state.submit);
  const storeError = useJobStore((state) => state.error);
  const availableModels = useMemo(
    () =>
      models.filter(
        (model) =>
          CUSTOM_VOICE_MODELS.has(model.modelId) &&
          model.capabilities.includes('custom_voice'),
      ),
    [models],
  );
  const [modelId, setModelId] = useState('');
  const [capabilities, setCapabilities] = useState({
    speakers: [],
    languages: [],
  });
  const [text, setText] = useState('');
  const [instruct, setInstruct] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [language, setLanguage] = useState('Auto');
  const [splitByLine, setSplitByLine] = useState(false);
  const [jobId, setJobId] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [pageError, setPageError] = useState('');
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [installingModel, setInstallingModel] = useState(false);
  const [proxy, setProxy] = useState('http://127.0.0.1:7897');

  const job = jobId ? jobs[jobId] : null;
  const generating = Boolean(
    job && ['queued', 'preparing', 'running'].includes(job.status),
  );
  const selectedModel = availableModels.find(
    (model) => model.modelId === modelId,
  );
  const currentArtifact = job?.status === 'succeeded' ? job.result : null;
  const jobMessage = job?.message || JOB_STATUS_TEXT[job?.status] || '处理中';

  useEffect(() => {
    track('component_used', { component: 'voice_generate_page' }, { once: true });
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

  function handleModelChange(event) {
    setModelId(event.target.value);
    setCapabilities({ speakers: [], languages: [] });
    setSpeaker('');
    setLanguage('Auto');
  }

  async function handleCapabilities() {
    if (!modelId) return;
    setLoadingCapabilities(true);
    setPageError('');
    try {
      const result = await getCapabilities(modelId);
      track('model_capabilities_requested', { success: true });
      setCapabilities(result);
      setSpeaker(result.speakers[0] || '');
      setLanguage(result.languages[0] || 'Auto');
    } catch (error) {
      setPageError(error.message);
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
      text_length_bucket: text.trim().length > 500 ? '501_plus' : text.trim().length > 100 ? '101_500' : '1_100',
    });
    setInstallingModel(!selectedModel?.installed);
    try {
      if (!selectedModel?.installed) {
        await installModel(modelId, proxy.trim() || undefined);
      }
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
    } finally {
      setInstallingModel(false);
    }
  }

  async function handleDownload() {
    try {
      await downloadArtifact(currentArtifact.artifactId);
      track('artifact_downloaded', { success: true });
    } catch (error) {
      track('generation_failed', { code: error.code || 'unknown' });
      setPageError(error.message);
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
        <label className="voice-generate__field">
          <span>模型下载代理</span>
          <input
            type="text"
            value={proxy}
            onChange={(event) => setProxy(event.target.value)}
            placeholder="http://127.0.0.1:7897"
          />
          <small>仅用于模型下载，留空表示不使用代理。</small>
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
            onChange={(event) => setText(event.target.value)}
            placeholder="输入要转换为语音的文本"
          />
        </label>
        <label className="voice-generate__field">
          <span>声音特征描述</span>
          <textarea
            rows="3"
            value={instruct}
            onChange={(event) => setInstruct(event.target.value)}
            placeholder="可选，例如：用温柔、自然的语气朗读"
          />
        </label>
        <label className="voice-generate__field">
          <span>发言人</span>
          <select
            value={speaker}
            onChange={(event) => setSpeaker(event.target.value)}
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
            onChange={(event) => setLanguage(event.target.value)}
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
              onChange={() => setSplitByLine(false)}
            />
            否
          </label>
          <label>
            <input
              type="radio"
              name="splitByLine"
              checked={splitByLine}
              onChange={() => setSplitByLine(true)}
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
