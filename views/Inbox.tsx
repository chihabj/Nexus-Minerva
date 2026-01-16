import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { sendTextMessage, markMessageAsRead } from '../services/whatsapp';
import type { Conversation, Message, Client } from '../types';

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, client:clients(*)')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    setConversations(data || []);
    setLoading(false);
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
    
    // Mark conversation as read
    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    // Update local state
    setConversations(prev => 
      prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
    );
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime updates
  useEffect(() => {
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log('📩 New message received:', newMessage);
          
          // If it's for the current conversation, add it
          if (selectedConversation && newMessage.conversation_id === selectedConversation.id) {
            setMessages(prev => [...prev, newMessage]);
          }
          
          // Refresh conversations list
          fetchConversations();
        }
      )
      .subscribe();

    // Subscribe to conversation updates
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [selectedConversation, fetchConversations]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || !selectedConversation || sending) return;

    const messageText = input.trim();
    setInput('');
    setSending(true);

    try {
      // Send via WhatsApp API
      const result = await sendTextMessage(selectedConversation.client_phone, messageText);

      if (!result.success) {
        console.error('Failed to send WhatsApp message:', result.error);
        // Still save to DB for record keeping
      }

      // Save message to database
      const { data: savedMessage, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          wa_message_id: result.messageId || null,
          from_phone: '33767668396', // Our number
          to_phone: selectedConversation.client_phone,
          direction: 'outbound',
          message_type: 'text',
          content: messageText,
          status: result.success ? 'sent' : 'failed',
          error_message: result.error || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
      } else if (savedMessage) {
        setMessages(prev => [...prev, savedMessage]);
      }

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message: messageText,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', selectedConversation.id);

    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  // Mark conversation as resolved
  const handleMarkResolved = async () => {
    if (!selectedConversation) return;

    await supabase
      .from('conversations')
      .update({ status: 'resolved' })
      .eq('id', selectedConversation.id);

    setSelectedConversation(prev => prev ? { ...prev, status: 'resolved' } : null);
    fetchConversations();
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.client_name?.toLowerCase().includes(term) ||
      c.client_phone.includes(term) ||
      c.last_message?.toLowerCase().includes(term)
    );
  });

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <span className="material-symbols-outlined text-[14px] text-slate-400">done</span>;
      case 'delivered': return <span className="material-symbols-outlined text-[14px] text-slate-400">done_all</span>;
      case 'read': return <span className="material-symbols-outlined text-[14px] text-blue-400">done_all</span>;
      case 'failed': return <span className="material-symbols-outlined text-[14px] text-red-400">error</span>;
      default: return null;
    }
  };

  return (
    <div className="flex h-full bg-[#efeae2] dark:bg-background-dark/50">
      {/* Conversations List */}
      <aside className="w-[360px] flex-none bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-bold mb-4">Messages</h3>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-2 text-sm" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2">chat</span>
              <p className="text-sm">Aucune conversation</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div 
                key={conv.id} 
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-slate-50 dark:border-slate-800 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${
                  selectedConversation?.id === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                }`}
              >
                <div className="size-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {(conv.client_name || conv.client_phone)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm truncate">
                      {conv.client_name || conv.client_phone}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {conv.client_phone}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">
                      {conv.last_message || 'Nouvelle conversation'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Header */}
          <header className="h-16 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
                {(selectedConversation.client_name || selectedConversation.client_phone)[0].toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  {selectedConversation.client_name || selectedConversation.client_phone}
                </h4>
                <div className="flex items-center gap-1.5">
                  <div className={`size-2 rounded-full ${selectedConversation.status === 'open' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    {selectedConversation.status === 'open' ? 'Actif' : 'Résolu'} • WhatsApp
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedConversation.status === 'open' && (
                <button 
                  onClick={handleMarkResolved}
                  className="px-3 py-1.5 text-xs font-semibold bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all"
                >
                  Marquer résolu
                </button>
              )}
              <a 
                href={`tel:+${selectedConversation.client_phone}`}
                className="p-2 text-slate-400 hover:text-primary transition-all"
              >
                <span className="material-symbols-outlined">call</span>
              </a>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="material-symbols-outlined text-6xl mb-4">forum</span>
                <p>Aucun message dans cette conversation</p>
              </div>
            ) : (
              messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${m.direction === 'outbound' ? 'items-end' : 'items-start'}`}
                >
                  {m.message_type === 'system' ? (
                    <div className="bg-amber-100 border border-amber-200 text-amber-800 text-[11px] px-4 py-1.5 rounded-full font-medium shadow-sm">
                      {m.content}
                    </div>
                  ) : (
                    <>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        m.direction === 'outbound' 
                          ? 'bg-primary text-white rounded-br-none' 
                          : 'bg-white dark:bg-surface-dark rounded-bl-none text-slate-800 dark:text-slate-100'
                      }`}>
                        {m.content || `[${m.message_type}]`}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatTime(m.created_at)}
                        </span>
                        {m.direction === 'outbound' && getStatusIcon(m.status)}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 border border-transparent focus-within:border-primary/50 flex items-center">
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Écrivez votre message..." 
                  className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32"
                  rows={1}
                  disabled={sending}
                />
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
                  <span className="material-symbols-outlined">sentiment_satisfied</span>
                </button>
              </div>
              <button 
                onClick={handleSend}
                className="bg-primary hover:bg-primary-dark text-white p-3 rounded-xl shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                disabled={!input.trim() || sending}
              >
                {sending ? (
                  <div className="size-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                ) : (
                  <span className="material-symbols-outlined">send</span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // No conversation selected
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50">
          <div className="bg-white dark:bg-surface-dark rounded-2xl p-8 shadow-lg text-center max-w-md">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-primary">chat</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Messages WhatsApp</h3>
            <p className="text-slate-500 text-sm mb-4">
              Sélectionnez une conversation pour voir les messages et répondre aux clients.
            </p>
            <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="font-semibold mb-1">💡 Conseil</p>
              <p>Les messages des clients apparaîtront ici automatiquement grâce au webhook WhatsApp.</p>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar - Client Info */}
      {selectedConversation && selectedConversation.client && (
        <aside className="w-[320px] flex-none bg-white dark:bg-surface-dark border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="text-center">
            <div className="size-20 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
              {(selectedConversation.client.name || selectedConversation.client_phone)[0].toUpperCase()}
            </div>
            <h3 className="font-bold text-lg">{selectedConversation.client.name || 'Client'}</h3>
            <p className="text-sm text-slate-500">{selectedConversation.client_phone}</p>
          </div>

          {selectedConversation.client.vehicle && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Véhicule</h4>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-500">directions_car</span>
                  <div>
                    <p className="font-bold text-sm">{selectedConversation.client.vehicle}</p>
                    {selectedConversation.client.vehicle_year && (
                      <p className="text-xs text-slate-500">{selectedConversation.client.vehicle_year}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedConversation.client.last_visit && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Dernière visite</h4>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                <p className="font-bold text-sm">
                  {new Date(selectedConversation.client.last_visit).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}

          {selectedConversation.client.center_name && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Centre</h4>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                <p className="font-bold text-sm">{selectedConversation.client.center_name}</p>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
