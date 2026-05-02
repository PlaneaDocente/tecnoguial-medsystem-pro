'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Send,
  Search,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Conversation, Patient, Message } from '@/lib/types';

type ConversationWithPatient = Conversation & {
  patient?: Pick<Patient, 'id' | 'first_name' | 'last_name'> | null;
};

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithPatient[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithPatient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, patient:patients(id, first_name, last_name)')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  useEffect(() => {
    if (selectedConversation) fetchMessages(selectedConversation.id);
  }, [selectedConversation, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const content = newMessage.trim();
    const conversationId = selectedConversation.id;
    const tempId = `temp-${Date.now()}`;

    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      is_read: false,
      sent_at: new Date().toISOString(),
    } as Message;

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');

    try {
      // ✅ FIX: supabase as any en inserts/updates
      const { error: msgError } = await (supabase as any).from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        is_read: false
      });

      if (msgError) throw msgError;

      const { error: convError } = await (supabase as any)
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (convError) throw convError;

      await fetchMessages(conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar mensaje');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [newMessage, selectedConversation, user, fetchMessages]);

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString() ? 'Hoy' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      `${c.patient?.first_name || ''} ${c.patient?.last_name || ''}`.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mensajes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Comunicación con pacientes</p>
        </div>
      </div>

      <Card className="overflow-hidden h-[calc(100vh-200px)] min-h-[500px]">
        <div className="flex h-full">
          <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                <Input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                  <p className="text-sm text-slate-500">{search.trim() ? 'No se encontraron' : 'No hay conversaciones'}</p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 text-left ${selectedConversation?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {conv.patient?.first_name?.charAt(0) || ''}{conv.patient?.last_name?.charAt(0) || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{conv.patient?.first_name || ''} {conv.patient?.last_name || ''}</p>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{formatDate(conv.last_message_at)}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <button onClick={() => setSelectedConversation(null)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Volver">
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {selectedConversation.patient?.first_name?.charAt(0) || ''}{selectedConversation.patient?.last_name?.charAt(0) || ''}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{selectedConversation.patient?.first_name || ''} {selectedConversation.patient?.last_name || ''}</p>
                    <Link href={`/patients/${selectedConversation.patient_id}`} className="text-xs text-blue-600 hover:underline">Ver expediente</Link>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" aria-hidden="true" />
                      <p className="text-slate-500">No hay mensajes</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.sender_id === user?.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'}`}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-blue-200' : 'text-slate-400'}`}>{formatTime(msg.sent_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex gap-2">
                    <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribe..." onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}><Send className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Enviar</span></Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Selecciona una conversación</h3>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}