import { StrictMode, Component, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "@/App";
import { ToastProvider } from "@/components/ui/Toast";
import { Tooltips } from "@/components/ui/Tooltips";
import "@/styles.css";
import "@/styles/ui.css";
import "@/styles/player.css";
import "@/styles/timeline.css";
import "@/styles/audio.css";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 2000 },
  },
});

class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="error-page">
          <h1>Não foi possível exibir o Studio</h1>
          <p>Recarregue a página para abrir os arquivos novamente.</p>
          <button className="button primary" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppBoundary>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <App />
          <Tooltips />
        </ToastProvider>
      </QueryClientProvider>
    </AppBoundary>
  </StrictMode>,
);
