export default function VoiceClonePage() {
  return (
    <section className="mx-auto w-full max-w-5xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">语音克隆</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          创建专属音色
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          当前页面作为音色克隆工作区原型，预留参考音频、文本对齐与导出结果区域。
        </p>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-ui border border-border-strong bg-panel p-5">
          <h3 className="text-sm font-semibold text-text">参考音频</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            后续可接入本地文件选择、录音上传、采样率检测与波形预览组件。
          </p>
          <div className="mt-4 rounded-ui border border-dashed border-border bg-canvas px-4 py-10 text-center text-sm text-text-subtle">
            拖拽或选择参考音频文件
          </div>
        </section>

        <section className="rounded-ui border border-border bg-elevated p-5">
          <h3 className="text-sm font-semibold text-text">流程提示</h3>
          <ol className="mt-3 space-y-2 text-sm text-text-muted">
            <li>1. 上传干净参考音频</li>
            <li>2. 补充对应文本内容</li>
            <li>3. 生成并校验克隆结果</li>
          </ol>
        </section>
      </div>
    </section>
  );
}
