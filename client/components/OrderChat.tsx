import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, MessageSquare } from "lucide-react";
import {
  fetchOrderMessages,
  sendOrderMessage,
  markOrderMessagesAsRead,
  type OrderMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OrderChatProps {
  orderId: string;
  currentOrgId: string;
  currentUserId?: string;
  buyerOrgId: string;
  sellerOrgId: string;
}

export function OrderChat({
  orderId,
  currentOrgId,
  currentUserId,
  buyerOrgId,
  sellerOrgId,
}: OrderChatProps) {
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Query per messaggi
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["orderMessages", orderId],
    queryFn: () => fetchOrderMessages(orderId),
    refetchInterval: 3000, // Auto-refresh ogni 3 secondi
    enabled: !!orderId,
  });

  // Mutation per inviare messaggio
  const sendMessageMutation = useMutation({
    mutationFn: (text: string) =>
      sendOrderMessage(orderId, {
        sender_org_id: currentOrgId,
        sender_user_id: currentUserId,
        message_text: text,
      }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["orderMessages", orderId] });
      // Marca messaggi come letti dopo l'invio
      markOrderMessagesAsRead(orderId, currentOrgId).catch(console.error);
    },
  });

  // Marca messaggi come letti quando si caricano
  useEffect(() => {
    if (messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) => !msg.is_read && msg.sender_org_id !== currentOrgId,
      );
      if (unreadMessages.length > 0) {
        markOrderMessagesAsRead(orderId, currentOrgId).catch(console.error);
      }
    }
  }, [messages, orderId, currentOrgId]);

  // Scroll automatico ai nuovi messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(messageText.trim());
    }
  };

  const isBuyer = currentOrgId === buyerOrgId;
  const isSeller = currentOrgId === sellerOrgId;

  if (!isBuyer && !isSeller) {
    return null; // Non mostrare chat se non sei buyer o seller
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Chat Ordine</h3>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Comunica con {isBuyer ? "il venditore" : "il cliente"} riguardo a
          questo ordine
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Nessun messaggio ancora</p>
              <p className="text-xs text-slate-400 mt-1">
                Inizia la conversazione
              </p>
            </div>
          </div>
        ) : (
          messages.map((message: OrderMessage) => {
            const isOwnMessage = message.sender_org_id === currentOrgId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-80">
                    {message.sender_org_name || (isOwnMessage ? "Tu" : "Altro")}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.message_text}
                  </div>
                  <div
                    className={`text-xs mt-1 ${isOwnMessage ? "text-emerald-100" : "text-slate-500"}`}
                  >
                    {new Date(message.created_at).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
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
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Scrivi un messaggio..."
            disabled={sendMessageMutation.isPending}
            className="flex-1"
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
