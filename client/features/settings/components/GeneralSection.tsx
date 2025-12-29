import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast' // <-- IMPORT MANCANTE!
import {
  useOrganizationGeneral,
  useUpdateOrganizationGeneral,
} from '../hooks'

const organizationSchema = z.object({
  legal_name: z.string().min(1, 'Nome legale obbligatorio'),
  logo_url: z.string().optional(),
  phone: z.string().optional(),
  support_email: z
    .string()
    .email('Email non valida')
    .optional()
    .or(z.literal('')),
  vat_number: z.string().optional(),
  tax_code: z.string().optional(),
  org_type: z.enum(['FARM', 'VENDOR', 'OPERATOR_PROVIDER']),
  address_line: z.string().min(1, 'Indirizzo obbligatorio'),
  // Rimossi campi non usati nel submit: city, province, region, postal_code, country
  // se servono nel backend, aggiungili qui e nel form
})

type OrganizationForm = z.infer<typeof organizationSchema>

export function GeneralSection() {
  const { toast } = useToast()
  const { data: organization, isLoading } = useOrganizationGeneral()
  const updateMutation = useUpdateOrganizationGeneral()

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>('')

  const form = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      legal_name: '',
      logo_url: '',
      phone: '',
      support_email: '',
      vat_number: '',
      tax_code: '',
      org_type: 'FARM',
      address_line: '',
    },
  })

  // Carica i dati quando organization è disponibile
  useEffect(() => {
    if (organization) {
      form.reset({
        legal_name: organization.legal_name || '',
        logo_url: organization.logo_url || '',
        phone: organization.phone || '',
        support_email: organization.support_email || '',
        vat_number: organization.vat_number || '',
        tax_code: organization.tax_code || '',
        org_type: (organization.org_type as any) || 'FARM',
        address_line: organization.address_line || '',
      })
      setCurrentLogoUrl(organization.logo_url || '')
    }
  }, [organization, form])

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Errore',
        description: 'Solo file PNG e JPEG sono supportati.',
        variant: 'destructive',
      })
      return
    }

    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      toast({
        title: 'Errore',
        description: 'File troppo grande. Massimo 2MB.',
        variant: 'destructive',
      })
      return
    }

    setUploadingLogo(true)

    try {
      const formData = new FormData()
      formData.append('logo', file)

      const orgData = localStorage.getItem('organization')
      if (!orgData) throw new Error('Dati organizzazione non trovati')

      const org = JSON.parse(orgData)
      const token = localStorage.getItem('auth_token')
      if (!token) throw new Error('Token di autenticazione mancante')

      const response = await fetch(
        `/api/settings/organization/upload-logo?orgId=${org.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante l\'upload')
      }

      form.setValue('logo_url', result.logo_url)
      setCurrentLogoUrl(result.logo_url)

      toast({
        title: 'Successo',
        description: 'Logo caricato con successo!',
      })
    } catch (error: any) {
      console.error('Errore upload logo:', error)
      toast({
        title: 'Errore',
        description: error.message || 'Errore durante l\'upload del logo.',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  const onSubmit = async (data: OrganizationForm) => {
    try {
      await updateMutation.mutateAsync(data)
      toast({
        title: 'Successo',
        description: 'Impostazioni salvate correttamente.',
      })
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile salvare le impostazioni.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impostazioni Generali Organizzazione</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome legale */}
            <div className="space-y-2">
              <Label htmlFor="legal_name">Nome Legale *</Label>
              <Input
                id="legal_name"
                {...form.register('legal_name')}
                placeholder="Nome dell'organizzazione"
              />
              {form.formState.errors.legal_name && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.legal_name.message}
                </p>
              )}
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label htmlFor="logo">Logo Organizzazione</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
                {uploadingLogo && (
                  <span className="text-sm text-slate-600">Caricamento...</span>
                )}
              </div>
              {(form.watch('logo_url') || currentLogoUrl) && (
                <div className="mt-4">
                  <img
                    src={form.watch('logo_url') || currentLogoUrl}
                    alt="Anteprima logo"
                    className="h-20 w-20 object-contain rounded border border-gray-300"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            {/* Telefono */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder="+39 123 456 7890"
                type="tel"
              />
            </div>

            {/* Email supporto */}
            <div className="space-y-2">
              <Label htmlFor="support_email">Email di Supporto</Label>
              <Input
                id="support_email"
                {...form.register('support_email')}
                placeholder="support@azienda.it"
                type="email"
              />
              {form.formState.errors.support_email && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.support_email.message}
                </p>
              )}
            </div>

            {/* Tipo organizzazione */}
            <div className="space-y-2">
              <Label htmlFor="org_type">Tipo Organizzazione *</Label>
              <Select
                value={form.watch('org_type')}
                onValueChange={(value) =>
                  form.setValue('org_type', value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FARM">Azienda Agricola</SelectItem>
                  <SelectItem value="VENDOR">Fornitore</SelectItem>
                  <SelectItem value="OPERATOR_PROVIDER">Operatore</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Partita IVA */}
            <div className="space-y-2">
              <Label htmlFor="vat_number">Partita IVA</Label>
              <Input
                id="vat_number"
                {...form.register('vat_number')}
                placeholder="IT12345678901"
              />
            </div>

            {/* Codice Fiscale */}
            <div className="space-y-2">
              <Label htmlFor="tax_code">Codice Fiscale</Label>
              <Input
                id="tax_code"
                {...form.register('tax_code')}
                placeholder="RSSMRA85M01H501Z"
              />
            </div>

            {/* Indirizzo */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_line">Indirizzo *</Label>
              <Input
                id="address_line"
                {...form.register('address_line')}
                placeholder="Via Example 123, 20100 Milano MI"
              />
              {form.formState.errors.address_line && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.address_line.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending || uploadingLogo}
            >
              {updateMutation.isPending ? 'Salvataggio...' : 'Salva Impostazioni'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}