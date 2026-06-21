import { Component, ReactNode } from "react";

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-5 p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <div>
          <p className="text-white font-black text-lg">Что-то пошло не так</p>
          <p className="text-white/40 text-sm mt-1">{this.state.message || "Неизвестная ошибка"}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: "#3b82f6" }}
        >
          Перезагрузить
        </button>
      </div>
    );
  }
}
