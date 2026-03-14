import { useState, useEffect } from "react";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  AlertCircle,
  Search,
  RefreshCw,
  Mail,
  MoreVertical,
  Reply,
  Forward,
  X
} from "lucide-react";

interface MailMessage {
  id: string;
  uid: number;
  subject: string;
  sender: string;
  date: string;
  preview: string;
  is_read: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  folder: string;
}

interface MailMessageDetail {
  uid: number;
  subject: string;
  sender: string;
  date: string;
  text_body: string;
  html_body: string;
}

interface MailFolder {
  name: string;
  display_name: string;
}

export function MailPage() {
  const [emails, setEmails] = useState<MailMessage[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<MailMessage | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<MailMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("INBOX");
  const [isComposing, setIsComposing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings state (must match MailAccountCreate: email_address, imap_*, smtp_*, login, password)
  const [settings, setSettings] = useState({
    email_address: "",
    login: "",
    password: "",
    imap_host: "",
    imap_port: 993,
    imap_ssl: true,
    smtp_host: "",
    smtp_port: 465,
    smtp_ssl: true
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Form compose state
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // При первом заходе на страницу и при смене папки — подтягиваем папки и письма
  useEffect(() => {
    syncAll();
  }, []);

  useEffect(() => {
    if (!foldersLoading && folders.length > 0 && activeFolder) {
      fetchMessages();
    }
  }, [activeFolder, folders, foldersLoading]);

  /** Синхронизация: обновляет папки и письма (эффект вызовет fetchMessages после обновления папок). */
  const syncAll = () => {
    fetchFolders();
  };

  // Load current account into settings when opening the modal
  useEffect(() => {
    if (!showSettings) return;
    const loadAccount = async () => {
      setSettingsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/v1/mail/accounts/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const acc = await res.json();
          setSettings({
            email_address: acc.email_address ?? "",
            login: acc.login ?? "",
            password: "", // never send stored password back
            imap_host: acc.imap_host ?? "",
            imap_port: acc.imap_port ?? 993,
            imap_ssl: acc.imap_ssl !== false,
            smtp_host: acc.smtp_host ?? "",
            smtp_port: acc.smtp_port ?? 465,
            smtp_ssl: acc.smtp_ssl !== false
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSettingsLoading(false);
      }
    };
    loadAccount();
  }, [showSettings]);

  const fetchFolders = async () => {
    setFoldersLoading(true);
    const token = localStorage.getItem("token");
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch("/api/v1/mail/folders", {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (res.ok) {
        const raw = await res.json();
        const data = (Array.isArray(raw) ? raw : []).filter(
          (f: MailFolder) => f.name && f.name !== "/"
        );
        setFolders(data);
        if (data.length > 0 && activeFolder === "INBOX") {
          const hasInbox = data.some((f: MailFolder) => f.name === "INBOX" || f.name.toUpperCase() === "INBOX");
          if (!hasInbox) setActiveFolder(data[0].name);
        }
      } else if (res.status === 400) {
        setShowSettings(true);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
      setShowSettings(true);
    } finally {
      setFoldersLoading(false);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    setSelectedEmail(null);
    setSelectedDetail(null);
    const token = localStorage.getItem("token");
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 35000);
      const res = await fetch(
        `/api/v1/mail/inbox?folder=${encodeURIComponent(activeFolder)}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
      );
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
        if (data.length > 0) {
          selectEmail(data[0]);
        }
      } else if (res.status === 400) {
        setShowSettings(true);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      setLoading(false);
    }
  };


  const selectEmail = async (email: MailMessage) => {
    setSelectedEmail(email);
    setSelectedDetail(null);
    setDetailLoading(true);
    const token = localStorage.getItem("token");
    const folderParam = encodeURIComponent(activeFolder);
    try {
      await fetch(
        `/api/v1/mail/inbox/${email.uid}/mark-read?folder=${folderParam}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setEmails((prev) =>
        prev.map((e) => (e.uid === email.uid ? { ...e, is_read: true } : e))
      );
    } catch {
      // ignore
    }
    try {
      const res = await fetch(
        `/api/v1/mail/inbox/${email.uid}?folder=${folderParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const detail = await res.json();
        setSelectedDetail(detail);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const payload = {
        email_address: settings.email_address,
        login: settings.login,
        password: settings.password,
        imap_host: settings.imap_host,
        imap_port: Number(settings.imap_port),
        imap_ssl: settings.imap_ssl,
        smtp_host: settings.smtp_host,
        smtp_port: Number(settings.smtp_port),
        smtp_ssl: settings.smtp_ssl
      };
      const res = await fetch("/api/v1/mail/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowSettings(false);
        await fetchFolders();
        if (activeFolder) fetchMessages();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail ? (Array.isArray(err.detail) ? err.detail.map((d: { msg: string }) => d.msg).join("\n") : err.detail) : "Ошибка при сохранении настроек почты");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении настроек почты");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          to_email: toEmail,
          subject,
          text_body: body
        })
      });
      if (res.ok) {
        setIsComposing(false);
        setToEmail("");
        setSubject("");
        setBody("");
      } else {
        alert("Ошибка при отправке");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при отправке");
    } finally {
      setSending(false);
    }
  };

  const folderIcon = (name: string) => {
    const n = name.toUpperCase();
    if (n === "INBOX") return Inbox;
    if (n.includes("SENT") || n.includes("ОТПРАВЛЕН")) return Send;
    if (n.includes("DRAFT") || n.includes("ЧЕРНОВИК")) return FileText;
    if (n.includes("SPAM") || n.includes("СПАМ")) return AlertCircle;
    if (n.includes("TRASH") || n.includes("КОРЗИН") || n.includes("УДАЛЕН")) return Trash2;
    return Mail;
  };
  const currentFolderLabel = folders.find((f) => f.name === activeFolder)?.display_name ?? activeFolder;

  return (
    <div className="flex w-full h-full relative">
      {/* Sidebar Folders */}
      <div className="w-64 bg-gray-50 border-r border-gray-100 flex flex-col">
        <div className="p-4">
          <button
            onClick={() => setIsComposing(true)}
            className="w-full bg-brand-green text-white rounded-lg py-2.5 px-4 font-medium hover:bg-[#0a2e20] transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Написать письмо
          </button>
        </div>
        <div className="flex-1 py-2 px-3 space-y-1 overflow-y-auto">
          {foldersLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
              Загрузка папок…
            </div>
          ) : folders.length === 0 ? (
            <p className="text-sm text-gray-500 px-3 py-2">Настройте почту или проверьте подключение</p>
          ) : (
            folders.map((f) => {
              const Icon = folderIcon(f.name);
              const isActive = activeFolder === f.name;
              const count = isActive ? emails.length : undefined;
              return (
                <button
                  key={f.name}
                  onClick={() => setActiveFolder(f.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-white text-brand-green shadow-sm font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{f.display_name}</span>
                  </div>
                  {count !== undefined && count > 0 && (
                    <span className="bg-brand-green/10 text-brand-green py-0.5 px-2 rounded-full text-[10px] font-bold flex-shrink-0">
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="p-4 border-t border-gray-100">
           <button onClick={() => setShowSettings(true)} className="w-full text-sm text-gray-500 hover:text-gray-800 transition-colors text-left font-medium flex items-center gap-2">
             Настройки подключения
           </button>
        </div>
      </div>

      {/* Email List Center Pane */}
      <div className="w-80 border-r border-gray-100 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 truncate">{currentFolderLabel}</h2>
            <button onClick={syncAll} className="p-2 -mr-2 text-gray-400 hover:text-brand-green transition-colors rounded-full hover:bg-gray-50" title="Синхронизировать папки и письма">
              <RefreshCw className={`w-4 h-4 ${foldersLoading || loading ? "animate-spin text-brand-green" : ""}`} />
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border-transparent rounded-lg text-sm focus:bg-white focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green transition-colors"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
          {loading && emails.length === 0 ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin"></div>
            </div>
          ) : emails.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {emails.map((e) => (
                <div
                  key={e.id}
                  onClick={() => selectEmail(e)}
                  className={`p-4 cursor-pointer transition-colors ${selectedEmail?.id === e.id ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-sm truncate pr-2 ${!e.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {e.sender.substring(0, 25) + (e.sender.length > 25 ? '...' : '')}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{e.date.split(' ')[0]}</span>
                  </div>
                  <h4 className={`text-sm truncate mb-1 ${!e.is_read ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
                    {e.subject}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {e.preview}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
               <Inbox className="w-12 h-12 mb-3 text-gray-200" />
               <p className="text-sm">Нет писем</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane (Email Detail) */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedEmail ? (
          <>
            <div className="p-6 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedEmail.subject}</h2>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-sm font-bold">
                    {selectedEmail.sender.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{selectedEmail.sender}</div>
                    <div className="text-xs text-gray-500">Кому: мне</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 mr-2">{selectedEmail.date}</span>
                <button className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><Reply className="w-4 h-4" /></button>
                <button className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><Forward className="w-4 h-4" /></button>
                <button className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto min-h-0">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
                </div>
              ) : selectedDetail ? (
                <div className="prose prose-sm max-w-none text-gray-800">
                  {selectedDetail.html_body ? (
                    <iframe
                      title="Тело письма"
                      sandbox="allow-same-origin"
                      srcDoc={
                        selectedDetail.html_body.trim().toLowerCase().startsWith("<!doctype") ||
                        selectedDetail.html_body.trim().toLowerCase().startsWith("<html")
                          ? selectedDetail.html_body
                          : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:12px;font-family:system-ui,sans-serif;">${selectedDetail.html_body}</body></html>`
                      }
                      className="w-full min-h-[400px] border-0 rounded-lg bg-white"
                      style={{ height: "calc(100vh - 320px)" }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 break-words">
                      {selectedDetail.text_body || "Нет текста"}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  {selectedEmail.preview ? (
                    selectedEmail.preview.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))
                  ) : (
                    "Загрузка..."
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50">
               <div className="flex gap-2">
                 <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <Reply className="w-4 h-4" />
                    Ответить
                 </button>
                 <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <Forward className="w-4 h-4" />
                    Переслать
                 </button>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Mail className="w-16 h-16 mb-4 text-gray-200" />
            <p>Выберите письмо для просмотра</p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="absolute bottom-0 right-8 w-[500px] h-[600px] bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-t-xl">
            <h3 className="text-sm font-medium">Новое сообщение</h3>
            <button onClick={() => setIsComposing(false)} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSend} className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center">
              <span className="text-sm text-gray-500 w-12">Кому</span>
              <input
                type="email"
                required
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                className="flex-1 text-sm outline-none"
              />
            </div>
            <div className="px-4 py-2 border-b border-gray-100 flex items-center">
               <span className="text-sm text-gray-500 w-12">Тема</span>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="flex-1 text-sm outline-none font-medium"
              />
            </div>
            <div className="flex-1 p-4">
              <textarea
                required
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full h-full resize-none outline-none text-sm text-gray-800"
                placeholder="Напишите что-нибудь..."
              ></textarea>
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <button 
                type="submit" 
                disabled={sending}
                className="px-6 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-[#0a2e20] transition-colors disabled:opacity-50"
              >
                {sending ? "Отправка..." : "Отправить"}
              </button>
              <button type="button" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[500px] flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Настройки почты</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-2 border border-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto w-full custom-scrollbar">
              {settingsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
                </div>
              ) : (
              <form id="mail-settings-form" onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email адрес</label>
                  <input type="email" required value={settings.email_address} onChange={e => setSettings({...settings, email_address: e.target.value})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="user@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
                  <input type="text" required value={settings.login} onChange={e => setSettings({...settings, login: e.target.value})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="user@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пароль (IMAP/SMTP)</label>
                  <input type="password" value={settings.password} onChange={e => setSettings({...settings, password: e.target.value})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="Оставьте пустым, чтобы не менять" />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Сервер</label>
                    <input type="text" required value={settings.imap_host} onChange={e => setSettings({...settings, imap_host: e.target.value})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="imap.mail.ru" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Порт</label>
                    <input type="number" required value={settings.imap_port} onChange={e => setSettings({...settings, imap_port: Number(e.target.value)})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="993" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Сервер</label>
                    <input type="text" required value={settings.smtp_host} onChange={e => setSettings({...settings, smtp_host: e.target.value})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="smtp.mail.ru" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Порт</label>
                    <input type="number" required value={settings.smtp_port} onChange={e => setSettings({...settings, smtp_port: Number(e.target.value)})} className="w-full text-base bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20" placeholder="465" />
                  </div>
                </div>
              </form>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setShowSettings(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-xl transition-colors">
                Отмена
              </button>
              <button form="mail-settings-form" type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-brand-green hover:bg-[#0a2e20] rounded-xl transition-colors shadow-sm">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
