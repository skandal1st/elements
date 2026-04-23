import { useEffect, useRef, useState, useCallback } from "react";
import { MessagesSquare, X, ExternalLink } from "lucide-react";
import { useChatStore } from "../../store/chat.store";
import { apiGet } from "../../api/client";

interface SsoTokenResponse {
  rocketchat_url: string;
  login_token: string;
  user_id: string;
}

export function ChatWidget() {
  const { isOpen, isOnChatPage, toggle, close } = useChatStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [rcData, setRcData] = useState<SsoTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fetchSsoToken = useCallback(async () => {
    try {
      const data = await apiGet<SsoTokenResponse>("/it/rocketchat/sso-token");
      setRcData(data);
      setError(null);
    } catch {
      setError("RocketChat недоступен");
    }
  }, []);

  // Загружаем токен при первом открытии
  useEffect(() => {
    if (isOpen && !rcData && !error) {
      fetchSsoToken();
    }
  }, [isOpen, rcData, error, fetchSsoToken]);

  // postMessage для автологина после загрузки iframe
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (rcData && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { event: "login-with-token", loginToken: rcData.login_token },
        rcData.rocketchat_url
      );
    }
  }, [rcData]);

  // Повторно отправляем postMessage если данные появились после загрузки iframe
  useEffect(() => {
    if (iframeLoaded && rcData && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { event: "login-with-token", loginToken: rcData.login_token },
        rcData.rocketchat_url
      );
    }
  }, [iframeLoaded, rcData]);

  if (isOnChatPage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Панель с iframe — скрывается через CSS, не размонтируется */}
      <div
        className={`
          w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200
          flex flex-col overflow-hidden transition-all duration-200
          ${isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}
        `}
        style={{ transformOrigin: "bottom right" }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-brand-green" strokeWidth={2} />
            <span className="text-sm font-semibold text-gray-800">RocketChat</span>
          </div>
          <div className="flex items-center gap-1">
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
            <button
              onClick={close}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Тело */}
        <div className="flex-1 relative bg-gray-50">
          {error ? (
            <div className="flex items-center justify-center h-full text-center px-6">
              <div>
                <MessagesSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">{error}</p>
                <button
                  onClick={() => { setError(null); fetchSsoToken(); }}
                  className="mt-3 text-xs text-brand-green hover:underline"
                >
                  Повторить
                </button>
              </div>
            </div>
          ) : !rcData ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={rcData.rocketchat_url}
              className="w-full h-full border-0"
              title="RocketChat"
              onLoad={handleIframeLoad}
              allow="camera; microphone; notifications"
            />
          )}
        </div>
      </div>

      {/* Кнопка открытия */}
      <button
        onClick={toggle}
        className={`
          w-14 h-14 rounded-full shadow-xl flex items-center justify-center
          transition-all duration-200 hover:scale-105 active:scale-95
          ${isOpen ? "bg-gray-700" : "bg-brand-green"}
        `}
        title={isOpen ? "Закрыть чат" : "Открыть чат"}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" strokeWidth={2} />
        ) : (
          <MessagesSquare className="w-6 h-6 text-white" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
