export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-6xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">工作台</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          欢迎使用 Qwen3 TTS Desktop
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          当前界面为桌面端语音工作区骨架，便于后续接入本地模型、任务队列和设置持久化。
        </p>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-ui border border-border bg-panel p-6">
          <p className="text-xs font-medium tracking-[0.14em] text-primary">
            DESKTOP WORKSPACE
          </p>
          <h3 className="mt-3 text-xl font-semibold text-text">清晰、独立、可扩展</h3>
          <p className="mt-3 max-w-lg text-sm leading-6 text-text-muted">
            前端界面、自定义窗口壳与 Tauri 后端能力已拆分，后续可分别接入语音生成、音色克隆与应用配置逻辑。
          </p>
        </div>

        <div className="rounded-ui border border-border-strong bg-elevated p-6">
          <p className="text-xs font-medium tracking-[0.14em] text-primary">快速开始</p>
          <ol className="mt-3 space-y-2 text-sm text-text-muted">
            <li>1. 前往语音生成页面编排文本与音色参数</li>
            <li>2. 在语音克隆页面整理参考音频流程</li>
            <li>3. 在设置页面预留下载目录与界面偏好</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
