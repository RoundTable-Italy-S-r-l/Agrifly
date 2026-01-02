import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { fetchJobOfferMessages, sendJobOfferMessage, markJobOfferMessagesAsRead, type JobOfferMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JobOfferChatProps {
  offerId: string;
  currentOrgId: string;
  currentUserId?: string;
  buyerOrgId: string;
  operatorOrgId: string;
}

export function JobOfferChat({ offerId, currentOrgId, currentUserId, buyerOrgId, operatorOrgId }: JobOfferChatProps) {
  console.log('💬 [CHAT COMPONENT] Rendered with:', { offerId, currentOrgId, currentUserId, buyerOrgId, operatorOrgId });

  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Query per messaggi
  const { data: messagesData, isLoading, error: queryError } = useQuery<JobOfferMessage[]>({
    queryKey: ['jobOfferMessages', offerId],
    queryFn: () => {
      console.log('💬 [CHAT QUERY] Fetching messages for offerId:', offerId);
      return fetchJobOfferMessages(offerId);
    },
    refetchInterval: 3000, // Auto-refresh ogni 3 secondi
    enabled: !!offerId
  });

  const messages = messagesData || [];

  // Gestisci success/error con useEffect
  useEffect(() => {
    if (messages.length > 0) {
      console.log('💬 [CHAT QUERY] Messages loaded:', messages.length, 'messages');
    }
  }, [messages]);

  useEffect(() => {
    if (queryError) {
      console.error('💬 [CHAT QUERY] Error loading messages:', queryError);
    }
  }, [queryError]);

  // Mutation per inviare messaggio
  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => {
      console.log('💬 [CHAT SEND] Sending message:', text, 'for offerId:', offerId);
      return sendJobOfferMessage(offerId, {
        content: text
      });
    }
  });

  // Gestisci success/error con useEffect
  useEffect(() => {
    if (sendMessageMutation.isSuccess) {
      console.log('💬 [CHAT SEND] Message sent successfully');
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['jobOfferMessages', offerId] });
      // Marca messaggi come letti dopo l'invio
      markJobOfferMessagesAsRead(offerId, currentOrgId).catch(console.error);
    }
  }, [sendMessageMutation.isSuccess, offerId, currentOrgId, queryClient]);

  useEffect(() => {
    if (sendMessageMutation.error) {
      console.error('💬 [CHAT SEND] Error sending message:', sendMessageMutation.error);
    }
  }, [sendMessageMutation.error]);

  // Marca messaggi come letti quando si caricano
  useEffect(() => {
    if (messages.length > 0) {
      const unreadMessages = messages.filter(
        msg => !msg.is_read && msg.sender_org_id !== currentOrgId
      );
      if (unreadMessages.length > 0) {
        markJobOfferMessagesAsRead(offerId, currentOrgId).catch(console.error);
      }
    }
  }, [messages, offerId, currentOrgId]);

  // Scroll to bottom quando arrivano nuovi messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(messageText.trim());
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Chat Offerta</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Nessun messaggio ancora. Inizia la conversazione.
          </div>
        ) : (
          messages.map((message: JobOfferMessage) => {
            const isOwnMessage = message.sender_org_id === currentOrgId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {!isOwnMessage && (
                    <div className="text-xs font-medium mb-1 opacity-80">
                      {message.sender_org_name || 'Altro'}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{message.message_text}</div>
                  <div
                    className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-slate-200">
        <div className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            type="submit"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

