import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useOrganizationUsers, useOrganizationInvitations, useInviteUser, useRevokeInvitation } from '../hooks'
import { Mail, UserPlus, X, Clock, Check, AlertCircle } from 'lucide-react'

const inviteSchema = z.object({
  email: z.string().email('Email non valida'),
  role: z.enum(['BUYER_ADMIN', 'VENDOR_ADMIN', 'DISPATCHER', 'PILOT', 'SALES']),
})

type InviteForm = z.infer<typeof inviteSchema>

const roleLabels = {
  BUYER_ADMIN: 'Admin Acquisti',
  VENDOR_ADMIN: 'Admin Vendite',
  DISPATCHER: 'Dispatcher',
  PILOT: 'Pilota',
  SALES: 'Vendite',
}

const statusIcons = {
  PENDING: <Clock className="w-4 h-4 text-yellow-500" />,
  ACCEPTED: <Check className="w-4 h-4 text-green-500" />,
  EXPIRED: <AlertCircle className="w-4 h-4 text-red-500" />,
}

const statusLabels = {
  PENDING: 'In Attesa',
  ACCEPTED: 'Accettato',
  EXPIRED: 'Scaduto',
}

export function UsersSection() {
  const { toast } = useToast()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const { data: users = [], isLoading: usersLoading } = useOrganizationUsers()
  const { data: invitations = [], isLoading: invitationsLoading } = useOrganizationInvitations()
  const inviteMutation = useInviteUser()
  const revokeMutation = useRevokeInvitation()

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'BUYER_ADMIN',
    },
  })

  const onInviteSubmit = async (data: InviteForm) => {
    try {
      await inviteMutation.mutateAsync(data as { email: string; role: string })
      toast({
        title: 'Invito inviato',
        description: `L'invito è stato inviato a ${data.email}`,
      })
      form.reset()
      setInviteDialogOpen(false)
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message || 'Si è verificato un errore durante l\'invio dell\'invito.',
        variant: 'destructive',
      })
    }
  }

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    try {
      await revokeMutation.mutateAsync(invitationId)
      toast({
        title: 'Invito revocato',
        description: `L'invito per ${email} è stato revocato.`,
      })
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante la revoca dell\'invito.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Users Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membri dell'Organizzazione</CardTitle>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="emerald">
                <UserPlus className="w-4 h-4 mr-2" />
                Invita Utente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invita Nuovo Utente</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="email@esempio.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Ruolo *</Label>
                  <Select
                    value={form.watch('role')}
                    onValueChange={(value) => form.setValue('role', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUYER_ADMIN">Admin Acquisti</SelectItem>
                      <SelectItem value="VENDOR_ADMIN">Admin Vendite</SelectItem>
                      <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                      <SelectItem value="PILOT">Pilota</SelectItem>
                      <SelectItem value="SALES">Vendite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    variant="emerald"
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? 'Invio...' : 'Invia Invito'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Iscrizione</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.first_name && user.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user.member_type === 'PENDING_SETUP'
                        ? `${roleLabels[user.role] || user.role} (in attesa)`
                        : 'Membro'
                      }
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.member_type === 'ACTIVE' ? 'default' : 'outline'}>
                        {user.member_type === 'ACTIVE' ? 'Attivo' : 'In Attesa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell>
                      {user.member_type === 'PENDING_SETUP' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Pre-compila il form di invito con i dati esistenti
                            form.setValue('email', user.email);
                            form.setValue('role', user.role);
                            setInviteDialogOpen(true);
                          }}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Re-invita
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Members Section - Membri invitati ma senza account completo */}
      {users.some((user: any) => user.member_type === 'PENDING_SETUP') && (
        <Card>
          <CardHeader>
            <CardTitle>Membri In Attesa di Attivazione</CardTitle>
            <p className="text-sm text-slate-600">
              Utenti invitati che devono ancora completare la registrazione
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Data Invito</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users
                  .filter((user: any) => user.member_type === 'PENDING_SETUP')
                  .map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('it-IT')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            form.setValue('email', user.email);
                            form.setValue('role', user.role);
                            setInviteDialogOpen(true);
                          }}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Re-invita
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invitations Section */}
      <Card>
        <CardHeader>
          <CardTitle>Inviti Pendenti</CardTitle>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nessun invito pendente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Invito</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation: any) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {roleLabels[invitation.role] || invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[invitation.status]}
                        {statusLabels[invitation.status]}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'PENDING' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <X className="w-4 h-4 mr-1" />
                              Revoca
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revocare l'invito?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa azione non può essere annullata. L'utente non potrà più accettare questo invito.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Revoca Invito
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
