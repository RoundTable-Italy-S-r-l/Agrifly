import React, { useState, useCallback } from 'react'
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
import { provinces, majorCities, getProvincesByRegion, getCitiesByProvince, getProvinceName } from '@/lib/italian-addresses'

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
  region: z.enum(['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'], {
    errorMap: () => ({ message: 'Regione obbligatoria' })
  }),
  postal_code: z.string().optional(),
  country: z.string().default('IT'),
})

type OrganizationForm = z.infer<typeof organizationSchema>

export function GeneralSection() {
  const { toast } = useToast()
  const { data: organization, isLoading } = useOrganizationGeneral()
  const updateMutation = useUpdateOrganizationGeneral()

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>('')

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Verifica tipo file
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Errore',
        description: 'Solo file PNG e JPEG sono supportati.',
        variant: 'destructive',
      })
      return
    }

    // Verifica dimensione (max 2MB)
    const maxSize = 2 * 1024 * 1024
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

      // Get organization ID from localStorage
      const orgData = localStorage.getItem('organization');
      if (!orgData) {
        throw new Error('Organization data not found');
      }
      const org = JSON.parse(orgData);

      const response = await fetch(`/api/settings/organization/upload-logo?orgId=${org.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Errore upload')
      }

      // Aggiorna il form con il nuovo URL del logo
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
        description: error.message || 'Si è verificato un errore durante l\'upload.',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
    }
  }

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
        logo_url: organization.logo_url || '', // Campo non esistente nel DB, lasciato vuoto
        phone: organization.phone || '', // Campo non esistente nel DB, lasciato vuoto
        support_email: organization.support_email || '', // Campo non esistente nel DB, lasciato vuoto
        vat_number: organization.vat_number || '',
        tax_code: organization.tax_code || '',
        org_type: organization.org_type || 'FARM',
        address_line: organization.address_line || '',
        city: organization.city || '',
        province: organization.province || '',
        region: organization.region || 'Lombardia',
        postal_code: organization.postal_code || '', // Campo non esistente nel DB, lasciato vuoto
        country: organization.country || 'IT',
      })
      setCurrentLogoUrl(organization.logo_url || '')

      // Controlla se la città corrente è nella lista delle città disponibili
      const currentProvince = organization.province
      const currentCity = organization.city
      if (currentProvince && currentCity) {
        const citiesForProvince = getCitiesByProvince(currentProvince)
        if (!citiesForProvince.includes(currentCity)) {
          setAllowCustomCity(true)
        }
      }
    }
  }, [organization, form])

  // Stati per gestione cascata indirizzo (dopo la dichiarazione del form)
  const selectedRegion = form.watch('region')
  const selectedProvince = form.watch('province')
  const availableProvinces = selectedRegion ? getProvincesByRegion(selectedRegion) : []
  const availableCities = selectedProvince ? getCitiesByProvince(selectedProvince) : []
  const [allowCustomCity, setAllowCustomCity] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

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
              <Label htmlFor="logo">Logo Organizzazione</Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  className="flex-1"
                />
                {uploadingLogo && (
                  <div className="text-sm text-slate-600">Caricamento...</div>
                )}
              </div>
              {(form.watch('logo_url') || currentLogoUrl) && (
                <div className="mt-2">
                  <img
                    src={form.watch('logo_url') || currentLogoUrl}
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
              <div className="relative">
                <Textarea
                  id="address_line"
                  {...form.register('address_line')}
                  placeholder="Via/Piazza, Numero civico (digita per suggerimenti)"
                  rows={2}
                  onChange={(e) => {
                    const value = e.target.value;
                    form.setValue('address_line', value);
                    debouncedSearch(value);
                  }}
                  onBlur={() => {
                    // Ritarda la chiusura per permettere click sui suggerimenti
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm"
                        onClick={() => {
                          form.setValue('address_line', suggestion);
                          setShowSuggestions(false);
                          setAddressSuggestions([]);
                        }}
                      >
                        📍 {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                <div className="absolute right-2 top-2 text-xs text-slate-400">
                  💡 Digita per suggerimenti automatici
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Suggerimenti automatici di indirizzi italiani tramite OpenStreetMap
              </p>
              {form.formState.errors.address_line && (
                <p className="text-sm text-red-600">{form.formState.errors.address_line.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Città *</Label>
                {!allowCustomCity ? (
                  <Select
                    value={form.watch('city')}
                    onValueChange={(value) => {
                      if (value === 'other') {
                        setAllowCustomCity(true)
                        form.setValue('city', '')
                      } else {
                        form.setValue('city', value)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona città" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                      {availableCities.length > 0 && (
                        <SelectItem value="other">Altra città...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      id="city"
                      {...form.register('city')}
                      placeholder="Inserisci città"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAllowCustomCity(false)
                        form.setValue('city', '')
                      }}
                    >
                      ← Torna alla lista
                    </Button>
                  </div>
                )}
                {form.formState.errors.city && (
                  <p className="text-sm text-red-600">{form.formState.errors.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Provincia *</Label>
                <Select
                  value={form.watch('province')}
                  onValueChange={(value) => {
                    form.setValue('province', value)
                    // Reset città quando cambia provincia
                    form.setValue('city', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProvinces.map((province) => (
                      <SelectItem key={province.code} value={province.code}>
                        {province.name} ({province.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.province && (
                  <p className="text-sm text-red-600">{form.formState.errors.province.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Regione *</Label>
                <Select
                  value={form.watch('region')}
                  onValueChange={(value) => {
                    form.setValue('region', value as any)
                    // Reset provincia e città quando cambia regione
                    form.setValue('province', '')
                    form.setValue('city', '')
                    setAllowCustomCity(false)
                  }}
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
                  placeholder="40100"
                  maxLength={5}
                  pattern="[0-9]{5}"
                />
                <p className="text-xs text-slate-500">Codice di avviamento postale (5 cifre)</p>
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

  // Funzione per cercare suggerimenti indirizzo con debounce
  const searchAddressSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Usa Nominatim (OpenStreetMap) per geocoding gratuito
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&limit=5&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error('Errore nella ricerca indirizzi');
      }

      const data = await response.json();

      const suggestions = data.map((item: any) => item.display_name);
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Errore ricerca indirizzi:', error);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  // Funzione con debounce per evitare troppe chiamate API
  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchAddressSuggestions(query);
    }, 500); // 500ms di debounce

    setSearchTimeout(timeout);
  }, [searchAddressSuggestions, searchTimeout]);
}
