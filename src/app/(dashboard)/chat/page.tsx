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
  ArrowLeft,
  Plus,
  X,
  Phone
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Conversation, Patient, Message } from '@/lib/types';

type ConversationWithPatient = Conversation & {
  patient?: Pick<Patient, 'id' | 'first_name' | 'last_name' | 'phone'> | null;
};

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithPatient[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithPatient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    
    try {
      const { data, error: queryError } = await supabase
        .from('conversations')
        .select('*, patient:patients(id, first_name, last_name, phone)')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (queryError) throw queryError;
      setConversations(data || []);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setError(err?.message || 'Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (queryError) throw queryError;
      setMessages(data || []);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      toast.error('Error al cargar mensajes');
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
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        is_read: false
      });

      if (msgError) throw msgError;

      const { error: convError } = await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (convError) throw convError;

      await fetchMessages(conversationId);
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error(err?.message || 'Error al enviar mensaje');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [newMessage, selectedConversation, user, fetchMessages]);

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const openNewModal = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone')
      .eq('user_id', user.id)
      .order('last_name');
    setPatientsList(data || []);
    setShowNewModal(true);
  };

  const handleCreateConversation = async (patientId: string) => {
    if (!user) return;
    setCreating(true);
    try {
      const existing = conversations.find(c => c.patient_id === patientId);
      if (existing) {
        setSelectedConversation(existing);
        setShowNewModal(false);
        return;
      }
      const { data, error: insErr } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, patient_id: patientId, last_message_at: new Date().toISOString() })
        .select('*, patient:patients(id, first_name, last_name, phone)')
        .single();
      if (insErr) throw insErr;
      toast.success('Nota creada');
      setShowNewModal(false);
      await fetchConversations();
      if (data) setSelectedConversation(data as ConversationWithPatient);
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear');
    } finally {
      setCreating(false);
    }
  };

  const openWhatsApp = (phone?: string | null) => {
    if (!phone) { toast.error('Este paciente no tiene telefono registrado'); return; }
    const clean = phone.replace(/\D/g, '');
    if (!clean) { toast.error('Telefono invalido'); return; }
    window.open(`https://wa.me/${clean}`, '_blank');
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

  if (loading && conversations.length === 0) {
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notas de Pacientes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Notas internas privadas por paciente</p>
        </div>
        <Button onClick={openNewModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Nota
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

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
                  <p className="text-sm text-slate-500">{search.trim() ? 'No se encontraron resultados' : 'Aun no hay notas. Crea una con el boton Nueva Nota.'}</p>
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
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{selectedConversation.patient?.first_name || ''} {selectedConversation.patient?.last_name || ''}</p>
                    <Link href={`/patients/${selectedConversation.patient_id}`} className="text-xs text-blue-600 hover:underline">Ver expediente</Link>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openWhatsApp(selectedConversation.patient?.phone)}
                    className="gap-2 flex-shrink-0"
                    title="Abrir WhatsApp con este paciente"
                  >
                    <Phone className="w-4 h-4 text-green-600" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
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
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h3 className="font-semibold">Nueva Nota - Selecciona Paciente</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {patientsList.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No tienes pacientes registrados</p>
              ) : (
                patientsList.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleCreateConversation(p.id)}
                    disabled={creating}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {p.first_name?.charAt(0) || ''}{p.last_name?.charAt(0) || ''}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{p.first_name || ''} {p.last_name || ''}</p>
                      {p.phone && <p className="text-xs text-slate-500">{p.phone}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}