import { useState } from 'react';

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

function VoiceGenerationPage() {
  const [modelId, setModelId] = useState(models[0].id);
  const [text, setText] = useState('大家好，我是锤子猫！');
  const [instruct, setInstruct] = useState(
    '体现阳光开朗、大气豪放、元气满满的女声，音色明亮通透，音调略微偏高且富有弹性。',
  );
  const [speaker, setSpeaker] = useState('');
  const [language, setLanguage] = useState('');
  const [segmentGen, setSegmentGen] = useState(false);

  return (
    <section className="mx-auto w-full max-w-3xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">语音生成</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          生成自然语音
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          此页面仅保留语音生成表单组件与样式，不连接任何本地服务或推理模块。
        </p>
      </header>
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          模型选择
          <select
            className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text"
            onChange={(event) => setModelId(event.target.value)}
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
            className="mt-2 min-h-28 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text"
            onChange={(event) => setText(event.target.value)}
            placeholder="输入要合成的文本"
            value={text}
          />
        </label>
        <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          声音特征描述
          <textarea
            className="mt-2 min-h-24 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text"
            onChange={(event) => setInstruct(event.target.value)}
            placeholder="例如：自然、清晰、亲切的语气"
            value={instruct}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
            发言人
            <input
              className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text"
              onChange={(event) => setSpeaker(event.target.value)}
              placeholder="由独立服务提供可选项"
              value={speaker}
            />
          </label>
          <label className="rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
            语言
            <input
              className="mt-2 w-full rounded-ui border border-border bg-canvas px-3 py-2 text-text"
              onChange={(event) => setLanguage(event.target.value)}
              placeholder="由独立服务提供可选项"
              value={language}
            />
          </label>
        </div>
        <label className="flex items-center gap-3 rounded-ui border border-border-strong bg-panel p-4 text-sm text-text">
          <input
            checked={segmentGen}
            onChange={(event) => setSegmentGen(event.target.checked)}
            type="checkbox"
          />
          按行分段生成
        </label>
        <div className="rounded-ui border border-dashed border-border-strong bg-panel p-4 text-sm text-text-muted">
          推理、任务创建、音频预览及下载逻辑未包含在此独立界面中。
        </div>
      </form>
    </section>
  );
}

export default VoiceGenerationPage;
