import { useEffect, useRef, useState, useCallback } from "react";
import { MessagesSquare, ExternalLink, RefreshCw } from "lucide-react";
import { useChatStore } from "../../../shared/store/chat.store";
import { apiGet } from "../../../shared/api/client";

interface SsoTokenResponse {
  rocketchat_url: string;
  login_token: string;
  user_id: string;
}

export function ChatPage() {
  const setOnChatPage = useChatStore((s) => s.setOnChatPage);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [rcData, setRcData] = useState<SsoTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    setOnChatPage(true);
    return () => setOnChatPage(false);
  }, [setOnChatPage]);

  const fetchSsoToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIframeLoaded(false);
    try {
      const data = await apiGet<SsoTokenResponse>("/it/rocketchat/sso-token");
      setRcData(data);
    } catch {
      setError("Не удалось подключиться к RocketChat. Проверьте настройки интеграции.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSsoToken();
  }, [fetchSsoToken]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (rcData && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { event: "login-with-token", loginToken: rcData.login_token },
        rcData.rocketchat_url
      );
    }
  }, [rcData]);

  useEffect(() => {
    if (iframeLoaded && rcData && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { event: "login-with-token", loginToken: rcData.login_token },
        rcData.rocketchat_url
      );
    }
  }, [iframeLoaded, rcData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)] -m-6 bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Подключение к RocketChat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)] -m-6 bg-white">
        <div className="text-center max-w-sm">
          <MessagesSquare className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-700 mb-2">Чат недоступен</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchSsoToken}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-white text-sm rounded-xl hover:bg-brand-green/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100vh-73px)] flex flex-col">
      {/* Топ-бар */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-5 h-5 text-brand-green" strokeWidth={2} />
          <span className="text-sm font-semibold text-gray-800">RocketChat</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSsoToken}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {rcData && (
            <a
              href={rcData.rocketchat_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
              title="Открыть в новой вкладке"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* iframe */}
      {rcData && (
        <iframe
          ref={iframeRef}
          src={rcData.rocketchat_url}
          className="flex-1 w-full border-0"
          title="RocketChat"
          onLoad={handleIframeLoad}
          allow="camera; microphone; notifications"
        />
      )}
    </div>
  );
}
