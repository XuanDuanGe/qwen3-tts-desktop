import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Echo Float 渲染失败', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex h-full items-center justify-center bg-canvas p-6 text-text">
        <section className="w-full max-w-md rounded-ui border border-danger bg-panel p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-danger">
            启动错误
          </p>
          <h1 className="mt-2 text-xl font-semibold">Echo Float 未能完成界面渲染</h1>
          <p className="mt-3 break-words text-sm text-text-muted">
            {this.state.error.message || '发生未知前端错误。'}
          </p>
          <button
            className="mt-5 rounded-ui border border-primary bg-primary px-4 py-2 text-sm font-semibold text-canvas"
            onClick={() => window.location.reload()}
            type="button"
          >
            重新加载
          </button>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
