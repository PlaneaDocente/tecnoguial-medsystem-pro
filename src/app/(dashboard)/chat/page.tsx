'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  Clock,
  User
} from 'lucide-react';
import Link from 'next/link';
import type { Conversation, Patient, Message } from '@/lib/types';

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<(Conversation & { patient?: Patient })[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from('conversations')
        .select('*, patient:patients(id, first_name, last_name)')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    try {
      await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: newMessage,
        is_read: false
      });

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setNewMessage('');
      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mensajes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Comunicación con pacientes
          </p>
        </div>
      </div>

      <Card className="overflow-hidden h-[calc(100vh-200px)]">
        <div className="flex h-full">
          {/* Conversations List */}
          <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar conversación..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">No hay conversaciones</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Inicia una desde el perfil de un paciente
                  </p>
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 ${
                      selectedConversation?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {conv.patient?.first_name?.charAt(0)}{conv.patient?.last_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {conv.patient?.first_name} {conv.patient?.last_name}
                        </p>
                        <span className="text-xs text-slate-400">
                          {formatDate(conv.last_message_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden p-2 rounded-lg hover:bg-slate-100"
                  >
                    ←
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation.patient?.first_name?.charAt(0)}{selectedConversation.patient?.last_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedConversation.patient?.first_name} {selectedConversation.patient?.last_name}
                    </p>
                    <Link
                      href={`/patients/${selectedConversation.patient_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver expediente
                    </Link>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500">No hay mensajes</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Inicia la conversación
                      </p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.sender_id === user?.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.sender_id === user?.id ? 'text-blue-200' : 'text-slate-400'
                          }`}>
                            {formatTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    Selecciona una conversación
                  </h3>
                  <p className="text-sm text-slate-500">
                    Elige una conversación de la lista para ver los mensajes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
