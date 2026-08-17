function CloneVoicePage() {
  return (
    <section className="mx-auto w-full max-w-5xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">克隆语音</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          创建专属音色
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          参考音频工作区界面组件，推理和音频处理由独立服务负责。
        </p>
      </header>
      <div className="mt-6 rounded-ui border border-border-strong bg-panel p-5 text-sm text-text-muted">
        音色克隆工作区将在此处提供。
      </div>
    </section>
  );
}

export default CloneVoicePage;
