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
  vat_number: z.string().optional(),
  tax_code: z.string().optional(),
  org_type: z.enum(['FARM', 'VENDOR', 'OPERATOR_PROVIDER']),
  address_line: z.string().min(1, 'Indirizzo obbligatorio'),
  city: z.string().min(1, 'Città obbligatoria'),
  province: z.string().min(1, 'Provincia obbligatoria'),
  region: z.string().min(1, 'Regione obbligatoria'),
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
      vat_number: '',
      tax_code: '',
      org_type: 'FARM',
      address_line: '',
      city: '',
      province: '',
      region: '',
      country: 'IT',
    },
  })

  // Update form when data loads
  React.useEffect(() => {
    if (organization) {
      form.reset({
        legal_name: organization.legal_name || '',
        vat_number: organization.vat_number || '',
        tax_code: organization.tax_code || '',
        org_type: organization.org_type || 'FARM',
        address_line: organization.address_line || '',
        city: organization.city || '',
        province: organization.province || '',
        region: organization.region || '',
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
                <Input
                  id="region"
                  {...form.register('region')}
                  placeholder="Regione"
                />
                {form.formState.errors.region && (
                  <p className="text-sm text-red-600">{form.formState.errors.region.message}</p>
                )}
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
