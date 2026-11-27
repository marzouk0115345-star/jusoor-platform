import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

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
  const { user, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';
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
      <div>
        <PageHeader
          title={isAr ? 'الرسائل والإشعارات' : 'Messages & Notifications'}
          subtitle={
            isAr
              ? 'سجّل الدخول للتواصل مع المعلّمين والمرشدين ومتابعة إشعاراتك.'
              : 'Sign in to message instructors and view your notifications.'
          }
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-chat-dots"
            title={isAr ? 'سجّل الدخول للمراسلة' : 'Sign in to view messages'}
            description={
              isAr
                ? 'المحادثات المباشرة محمية ومقيّدة بأطراف كل جلسة أو مهمة تعليمية.'
                : 'Direct messaging is secured to enrolled participants.'
            }
            action={
              <button
                type="button"
                onClick={openAuthModal}
                className="btn-jusoor-primary px-5 py-2.5 text-sm cursor-pointer"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker={isAr ? 'التواصل المباشر' : 'Direct Messaging'}
        title={isAr ? 'الرسائل والإشعارات' : 'Messages & Notifications'}
        subtitle={
          isAr
            ? 'المراسلات محفوظة في قاعدة البيانات ومقيّدة بأعضاء كل محادثة فقط.'
            : 'Messages are persisted securely and scoped to conversation members.'
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5">
        <div className="row g-4">
          {/* Conversations List */}
          <div className="col-12 col-lg-4">
            <div className="jusoor-card p-4 space-y-3 h-full">
              <h2 className="font-display text-sm font-bold text-[#102A43] flex items-center gap-2 pb-2.5 border-b border-[#DCE5F0] m-0">
                <i className="bi bi-chat-left-text text-[#247BA0]" aria-hidden="true" />
                <span>المحادثات ({conversations.length})</span>
              </h2>
              {conversations.length === 0 ? (
                <p className="text-xs text-[#64748B] py-4 m-0">
                  لا توجد محادثات بعد. تُفتح المحادثات تلقائياً عند قبول عرض مهمة أو بدء تواصل.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setActiveConvId(conv.id)}
                      className={`w-full text-start p-3 rounded-xl transition-colors cursor-pointer border ${
                        activeConvId === conv.id
                          ? 'bg-[#E8F8F5] border-[#99E2D8]'
                          : 'bg-transparent border-transparent hover:bg-[#F5F8FC]'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#102A43] truncate">
                        {conv.subject}
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                        {conv.members.map((m) => m.fullName).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Message Thread */}
          <div className="col-12 col-lg-5">
            <div className="jusoor-card p-4 p-sm-5 flex flex-col justify-between min-h-[420px] h-full">
              <div className="space-y-3 overflow-y-auto max-h-96">
                {messages.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <i
                      className="bi bi-chat-square-dots text-2xl text-[#64748B]"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-[#64748B] m-0">
                      اختر محادثة لعرض الرسائل
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderUserId === user.id;
                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl text-sm max-w-[85%] ${
                          mine
                            ? 'bg-[#102A43] text-white ms-auto'
                            : 'bg-[#EEF4FA] text-[#172B4D] me-auto'
                        }`}
                      >
                        <div
                          className={`text-[11px] font-semibold mb-1 ${
                            mine ? 'text-[#A7F3D0]' : 'text-[#64748B]'
                          }`}
                        >
                          {m.senderName}
                        </div>
                        <p className="leading-relaxed m-0">{m.body}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {activeConvId && (
                <form
                  onSubmit={handleSend}
                  className="pt-4 mt-4 border-t border-[#DCE5F0] flex gap-2"
                >
                  <input
                    type="text"
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="jusoor-input flex-1 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    aria-label="إرسال الرسالة"
                    className="btn-jusoor-primary px-4 py-2 text-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="bi bi-send" aria-hidden="true" />
                    <span>إرسال</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Notifications Panel */}
          <div className="col-12 col-lg-3">
            <div className="jusoor-card p-4 space-y-3 h-full">
              <h2 className="font-display text-sm font-bold text-[#102A43] flex items-center gap-2 pb-2.5 border-b border-[#DCE5F0] m-0">
                <i className="bi bi-bell text-[#247BA0]" aria-hidden="true" />
                <span>الإشعارات ({notifications.length})</span>
              </h2>
              {notifications.length === 0 ? (
                <p className="text-xs text-[#64748B] m-0">لا توجد إشعارات.</p>
              ) : (
                <div className="divide-y divide-[#EDF2F7]">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-2.5 space-y-1">
                      <div className="text-xs font-bold text-[#102A43]">
                        {n.title}
                      </div>
                      <p className="text-xs text-[#64748B] m-0">{n.body}</p>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="text-[11px] font-semibold text-[#0F766E] hover:underline cursor-pointer"
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
      </div>
    </div>
  );
}
