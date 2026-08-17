import { useEffect, useState } from 'react';
import { usePageTelemetry } from '../hooks/usePageTelemetry';
import { measure, remark, track } from '../utils/telemetry';

const models = [
  {
    id: 'model-large',
    label: 'Large voice model',
  },
  {
    id: 'model-compact',
    label: 'Compact voice model',
  },
];

export default function VoiceGeneratePage() {
  usePageTelemetry('voice-generate');

  const [modelId, setModelId] = useState(models[0].id);
  const [text, setText] = useState('大家好，欢迎使用 Qwen3 TTS Desktop。');
  const [instruct, setInstruct] = useState(
    '体现自然、明亮、亲和的中文女声，节奏平稳，字句清晰，保留适度情感起伏。',
  );
  const [speaker, setSpeaker] = useState('');
  const [language, setLanguage] = useState('中文');
  const [segmentGen, setSegmentGen] = useState(false);

  useEffect(() => {
    remark('page.voice-generate.paint', { page: 'voice-generate' });
    measure('page.voice-generate.first.effect', 'page.voice-generate.paint', {
      page: 'voice-generate',
    });
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    track('voice-generate.submit', {
      modelId,
      textLength: text.length,
      instructLength: instruct.length,
      hasSpeaker: Boolean(speaker.trim()),
      language,
      segmentGen,
    });
  };

  return (
    <section className="mx-auto w-full max-w-3xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">语音生成</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          生成自然语音
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          当前页面保留生成任务所需基础表单，未接入本地推理与音频下载逻辑。
        </p>
      </header>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          模型选择
          <select
            className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text outline-none transition-colors focus:border-primary"
            onChange={(event) => {
              setModelId(event.target.value);
              track('voice-generate.model.change', { modelId: event.target.value });
            }}
            value={modelId}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          输入文本
          <textarea
            className="mt-2 min-h-28 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text outline-none transition-colors focus:border-primary"
            onChange={(event) => {
              setText(event.target.value);
              track('voice-generate.text.change', {
                textLength: event.target.value.length,
              });
            }}
            placeholder="输入要合成的文本"
            value={text}
          />
        </label>

        <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          声音特征描述
          <textarea
            className="mt-2 min-h-24 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text outline-none transition-colors focus:border-primary"
            onChange={(event) => {
              setInstruct(event.target.value);
              track('voice-generate.instruct.change', {
                instructLength: event.target.value.length,
              });
            }}
            placeholder="例如：自然、清晰、亲切的语气"
            value={instruct}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
            发言人
            <input
              className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text outline-none transition-colors focus:border-primary"
              onChange={(event) => {
                setSpeaker(event.target.value);
                track('voice-generate.speaker.change', {
                  speakerLength: event.target.value.length,
                });
              }}
              placeholder="后续接入模型可选角色"
              value={speaker}
            />
          </label>

          <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
            语言
            <input
              className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text outline-none transition-colors focus:border-primary"
              onChange={(event) => {
                setLanguage(event.target.value);
                track('voice-generate.language.change', {
                  language: event.target.value,
                });
              }}
              placeholder="输入语言类型"
              value={language}
            />
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          <input
            checked={segmentGen}
            onChange={(event) => {
              setSegmentGen(event.target.checked);
              track('voice-generate.segment.toggle', {
                checked: event.target.checked,
              });
            }}
            type="checkbox"
          />
          按行分段生成
        </label>

        <div className="rounded-ui border border-dashed border-border-strong bg-panel p-4 text-sm text-text-muted">
          推理任务、进度回显、音频试听与导出按钮后续可直接接入此工作区。
        </div>
      </form>
    </section>
  );
}
