import React, { useEffect, useState, useCallback } from 'react';
import { Send, MessageSquare, Bell } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ConversationItem {
  id: number;
  subject: string;
  members: Array<{ userId: number; fullName: string }>;
  lastMessage: { body: string; createdAt: string } | null;
}

interface MessageItem {
  id: number;
  senderUserId: number;
  senderName: string;
  body: string;
  createdAt: string;
}

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function MessagesPage() {
  const { user, openAuthModal } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const [cRes, nRes] = await Promise.all([
        apiFetch<{ conversations: ConversationItem[] }>('/api/conversations'),
        apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),
      ]);
      setConversations(cRes.conversations);
      setNotifications(nRes.notifications);
      if (cRes.conversations.length > 0 && !activeConvId) {
        setActiveConvId(cRes.conversations[0].id);
      }
    } catch {
      // ignore
    }
  }, [user, activeConvId]);

  const loadMessages = useCallback(async (convId: number) => {
    try {
      const res = await apiFetch<{ messages: MessageItem[] }>(
        `/api/conversations/${convId}/messages`
      );
      setMessages(res.messages);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConvId && user) {
      loadMessages(activeConvId);
    }
  }, [activeConvId, user, loadMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !body.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setBody('');
      await loadMessages(activeConvId);
    } finally {
      setSending(false);
    }
  };

  const handleMarkRead = async (notifId: number) => {
    await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
    await loadConversations();
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          الرسائل والإشعارات
        </h1>
        <p className="text-sm text-slate-600">
          سجّل الدخول للتواصل مع المعلّمين والمرشدين ومتابعة إشعاراتك.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="px-6 py-3 bg-teal-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">
          الرسائل والإشعارات
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          المراسلات محفوظة في قاعدة البيانات ومقيّدة بأعضاء كل محادثة فقط (يتم تحديثها عند الإرسال أو التحديث).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <h2 className="font-display text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
            <MessageSquare className="w-4 h-4 text-teal-700" />
            <span>المحادثات ({conversations.length})</span>
          </h2>
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              لا توجد محادثات بعد. تُفتح المحادثات تلقائياً عند قبول عرض مهمة أو بدء تواصل.
            </p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-right p-3 rounded-lg transition-colors cursor-pointer ${
                    activeConvId === conv.id
                      ? 'bg-teal-50 border border-teal-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {conv.subject}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {conv.members.map((m) => m.fullName).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-3 overflow-y-auto max-h-96">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">
                اختر محادثة لعرض الرسائل
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.senderUserId === user.id;
                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl text-sm max-w-[85%] ${
                      mine
                        ? 'bg-teal-700 text-white mr-auto'
                        : 'bg-slate-100 text-slate-900 ml-auto'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-semibold mb-1 ${
                        mine ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      {m.senderName}
                    </div>
                    <p className="leading-relaxed">{m.body}</p>
                  </div>
                );
              })
            )}
          </div>

          {activeConvId && (
            <form
              onSubmit={handleSend}
              className="pt-4 mt-4 border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب رسالتك..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={sending}
                aria-label="إرسال الرسالة"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>إرسال</span>
              </button>
            </form>
          )}
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 className="font-display text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Bell className="w-4 h-4 text-teal-700" />
            <span>الإشعارات</span>
          </h2>
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500">لا توجد إشعارات.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div key={n.id} className="py-2.5 space-y-1">
                  <div className="text-xs font-bold text-slate-900">
                    {n.title}
                  </div>
                  <p className="text-xs text-slate-600">{n.body}</p>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="text-[11px] text-teal-700 hover:underline cursor-pointer"
                    >
                      تحديد كمقروء
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
