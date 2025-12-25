import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useOrganizationGeneral, useUpdateOrganizationGeneral } from '../hooks'

const organizationSchema = z.object({
  legal_name: z.string().min(1, 'Nome legale obbligatorio'),
  logo_url: z.string().optional(),
  phone: z.string().optional(),
  support_email: z.string().email('Email non valida').optional().or(z.literal('')),
  vat_number: z.string().optional(),
  tax_code: z.string().optional(),
  org_type: z.enum(['FARM', 'VENDOR', 'OPERATOR_PROVIDER']),
  address_line: z.string().min(1, 'Indirizzo obbligatorio'),
  city: z.string().min(1, 'Città obbligatoria'),
  province: z.string().min(1, 'Provincia obbligatoria'),
  region: z.enum(['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'], 'Regione obbligatoria'),
  postal_code: z.string().optional(),
  country: z.string().default('IT'),
})

type OrganizationForm = z.infer<typeof organizationSchema>

export function GeneralSection() {
  const { toast } = useToast()
  const { data: organization, isLoading } = useOrganizationGeneral()
  const updateMutation = useUpdateOrganizationGeneral()

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
      city: '',
      province: '',
      region: 'Lombardia',
      postal_code: '',
      country: 'IT',
    },
  })

  // Update form when data loads
  React.useEffect(() => {
    if (organization) {
      form.reset({
        legal_name: organization.legal_name || '',
        logo_url: organization.logo_url || '',
        phone: organization.phone || '',
        support_email: organization.support_email || '',
        vat_number: organization.vat_number || '',
        tax_code: organization.tax_code || '',
        org_type: organization.org_type || 'FARM',
        address_line: organization.address_line || '',
        city: organization.city || '',
        province: organization.province || '',
        region: organization.region || 'Lombardia',
        postal_code: organization.postal_code || '',
        country: organization.country || 'IT',
      })
    }
  }, [organization, form])

  const onSubmit = async (data: OrganizationForm) => {
    try {
      await updateMutation.mutateAsync(data)
      toast({
        title: 'Impostazioni salvate',
        description: 'Le impostazioni dell\'organizzazione sono state aggiornate con successo.',
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
    <Card>
      <CardHeader>
        <CardTitle>Impostazioni Generali Organizzazione</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legal_name">Nome Legale *</Label>
              <Input
                id="legal_name"
                {...form.register('legal_name')}
                placeholder="Nome dell'organizzazione"
              />
              {form.formState.errors.legal_name && (
                <p className="text-sm text-red-600">{form.formState.errors.legal_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo Organizzazione</Label>
              <Input
                id="logo_url"
                {...form.register('logo_url')}
                placeholder="URL del logo (https://...)"
                type="url"
              />
              {form.watch('logo_url') && (
                <div className="mt-2">
                  <img
                    src={form.watch('logo_url')}
                    alt="Logo preview"
                    className="h-16 w-16 object-contain border border-gray-200 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder="+39 123 456 7890"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support_email">Email di Supporto</Label>
              <Input
                id="support_email"
                {...form.register('support_email')}
                placeholder="support@azienda.com"
                type="email"
              />
              {form.formState.errors.support_email && (
                <p className="text-sm text-red-600">{form.formState.errors.support_email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org_type">Tipo Organizzazione *</Label>
              <Select
                value={form.watch('org_type')}
                onValueChange={(value) => form.setValue('org_type', value as any)}
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

            <div className="space-y-2">
              <Label htmlFor="vat_number">Partita IVA</Label>
              <Input
                id="vat_number"
                {...form.register('vat_number')}
                placeholder="IT12345678901"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_code">Codice Fiscale</Label>
              <Input
                id="tax_code"
                {...form.register('tax_code')}
                placeholder="Codice fiscale"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Indirizzo</h3>

            <div className="space-y-2">
              <Label htmlFor="address_line">Indirizzo *</Label>
              <Textarea
                id="address_line"
                {...form.register('address_line')}
                placeholder="Via/Piazza, Numero civico"
                rows={2}
              />
              {form.formState.errors.address_line && (
                <p className="text-sm text-red-600">{form.formState.errors.address_line.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Città *</Label>
                <Input
                  id="city"
                  {...form.register('city')}
                  placeholder="Città"
                />
                {form.formState.errors.city && (
                  <p className="text-sm text-red-600">{form.formState.errors.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Provincia *</Label>
                <Input
                  id="province"
                  {...form.register('province')}
                  placeholder="Provincia"
                />
                {form.formState.errors.province && (
                  <p className="text-sm text-red-600">{form.formState.errors.province.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Regione *</Label>
                <Select
                  value={form.watch('region')}
                  onValueChange={(value) => form.setValue('region', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona regione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Abruzzo">Abruzzo</SelectItem>
                    <SelectItem value="Basilicata">Basilicata</SelectItem>
                    <SelectItem value="Calabria">Calabria</SelectItem>
                    <SelectItem value="Campania">Campania</SelectItem>
                    <SelectItem value="Emilia-Romagna">Emilia-Romagna</SelectItem>
                    <SelectItem value="Friuli-Venezia Giulia">Friuli-Venezia Giulia</SelectItem>
                    <SelectItem value="Lazio">Lazio</SelectItem>
                    <SelectItem value="Liguria">Liguria</SelectItem>
                    <SelectItem value="Lombardia">Lombardia</SelectItem>
                    <SelectItem value="Marche">Marche</SelectItem>
                    <SelectItem value="Molise">Molise</SelectItem>
                    <SelectItem value="Piemonte">Piemonte</SelectItem>
                    <SelectItem value="Puglia">Puglia</SelectItem>
                    <SelectItem value="Sardegna">Sardegna</SelectItem>
                    <SelectItem value="Sicilia">Sicilia</SelectItem>
                    <SelectItem value="Toscana">Toscana</SelectItem>
                    <SelectItem value="Trentino-Alto Adige">Trentino-Alto Adige</SelectItem>
                    <SelectItem value="Umbria">Umbria</SelectItem>
                    <SelectItem value="Valle d'Aosta">Valle d'Aosta</SelectItem>
                    <SelectItem value="Veneto">Veneto</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.region && (
                  <p className="text-sm text-red-600">{form.formState.errors.region.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">CAP</Label>
                <Input
                  id="postal_code"
                  {...form.register('postal_code')}
                  placeholder="20100"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="emerald"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Salvataggio...' : 'Salva Impostazioni'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
