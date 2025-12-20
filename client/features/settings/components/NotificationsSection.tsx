import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Bell, Mail, MessageSquare } from 'lucide-react'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks'

export function NotificationsSection() {
  const { toast } = useToast()
  const { data: preferences, isLoading } = useNotificationPreferences()
  const updateMutation = useUpdateNotificationPreferences()

  // Local state for switches
  const [emailOrders, setEmailOrders] = useState(true)
  const [emailPayments, setEmailPayments] = useState(true)
  const [emailUpdates, setEmailUpdates] = useState(false)
  const [inappOrders, setInappOrders] = useState(true)
  const [inappMessages, setInappMessages] = useState(true)

  // Update local state when data loads
  useEffect(() => {
    if (preferences) {
      setEmailOrders(preferences.email_orders ?? true)
      setEmailPayments(preferences.email_payments ?? true)
      setEmailUpdates(preferences.email_updates ?? false)
      setInappOrders(preferences.inapp_orders ?? true)
      setInappMessages(preferences.inapp_messages ?? true)
    }
  }, [preferences])

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        email_orders: emailOrders,
        email_payments: emailPayments,
        email_updates: emailUpdates,
        inapp_orders: inappOrders,
        inapp_messages: inappMessages,
      })

      toast({
        title: 'Impostazioni salvate',
        description: 'Le tue preferenze di notifica sono state aggiornate.',
      })
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante il salvataggio.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifiche Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-orders">Nuovi ordini</Label>
                <p className="text-sm text-slate-500">
                  Ricevi notifiche quando vengono creati nuovi ordini
                </p>
              </div>
              <Switch
                id="email-orders"
                checked={emailOrders}
                onCheckedChange={setEmailOrders}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-payments">Pagamenti</Label>
                <p className="text-sm text-slate-500">
                  Ricevi notifiche sui pagamenti ricevuti
                </p>
              </div>
              <Switch
                id="email-payments"
                checked={emailPayments}
                onCheckedChange={setEmailPayments}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-updates">Aggiornamenti sistema</Label>
                <p className="text-sm text-slate-500">
                  Ricevi notifiche su aggiornamenti e manutenzioni
                </p>
              </div>
              <Switch
                id="email-updates"
                checked={emailUpdates}
                onCheckedChange={setEmailUpdates}
              />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Notifiche in-app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-orders">Nuovi ordini</Label>
              <p className="text-sm text-slate-500">
                Mostra notifiche in-app per nuovi ordini
              </p>
            </div>
            <Switch
              id="inapp-orders"
              checked={inappOrders}
              onCheckedChange={setInappOrders}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-messages">Messaggi</Label>
              <p className="text-sm text-slate-500">
                Mostra notifiche per nuovi messaggi
              </p>
            </div>
            <Switch
              id="inapp-messages"
              checked={inappMessages}
              onCheckedChange={setInappMessages}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="emerald"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Salvataggio...' : 'Salva Impostazioni'}
        </Button>
      </div>
    </div>
  )
}
