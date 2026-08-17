function HomePage() {
  return (
    <section className="mx-auto w-full max-w-6xl p-6 lg:p-8">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary">工作台</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          欢迎使用 Echo Float
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          一个独立的桌面界面原型，展示可扩展的语音工作区与应用设置。
        </p>
      </header>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-ui border border-border bg-panel p-6">
          <p className="text-xs font-medium tracking-[0.14em] text-primary">
            DESKTOP WORKSPACE
          </p>
          <h3 className="mt-3 text-xl font-semibold text-text">清晰、独立、可扩展</h3>
          <p className="mt-3 max-w-lg text-sm leading-6 text-text-muted">
            前端界面、桌面窗口壳和语音处理核心彼此独立，可分别开发、测试和部署。
          </p>
        </div>
        <div className="rounded-ui border border-border-strong bg-elevated p-6">
          <p className="text-xs font-medium tracking-[0.14em] text-primary">快速开始</p>
          <ol className="mt-3 space-y-2 text-sm text-text-muted">
            <li>1. 浏览语音生成工作区</li>
            <li>2. 查看克隆语音界面</li>
            <li>3. 在设置中调整界面偏好</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export default HomePage;
