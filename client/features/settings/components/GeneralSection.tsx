import React, { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useOrganizationGeneral, useUpdateOrganizationGeneral } from "../hooks";
import {
  provinces,
  majorCities,
  type ProvinceData,
} from "@/lib/italian-addresses";

const organizationSchema = z.object({
  legal_name: z.string().min(1, "Nome legale obbligatorio"),
  logo_url: z.string().optional(),
  phone: z.string().optional(),
  support_email: z
    .string()
    .email("Email non valida")
    .optional()
    .or(z.literal("")),
  vat_number: z.string().optional(),
  tax_code: z.string().optional(),
  // org_type è determinato automaticamente dalle capabilities, non modificabile
  address_line: z.string().min(1, "Indirizzo obbligatorio"),
  region: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
});

type OrganizationForm = z.infer<typeof organizationSchema>;

export function GeneralSection() {
  const { toast } = useToast();
  const { data: organization, isLoading } = useOrganizationGeneral();
  const updateMutation = useUpdateOrganizationGeneral();

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("");

  // Filtri a cascata per indirizzo
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");

  // Stato per input città con autocomplete
  const [cityInputValue, setCityInputValue] = useState<string>("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Ottieni regioni uniche
  const regions = Array.from(new Set(provinces.map((p) => p.region))).sort();

  // Province filtrate per regione
  const filteredProvinces = selectedRegion
    ? provinces
        .filter((p) => p.region === selectedRegion)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Città filtrate per provincia (suggerimenti per autocomplete)
  const citySuggestions =
    selectedProvince && majorCities[selectedProvince]
      ? majorCities[selectedProvince]
          .filter((city) => city && city.trim() !== "")
          .sort()
      : [];

  // Filtra suggerimenti in base all'input
  const filteredCitySuggestions = cityInputValue
    ? citySuggestions.filter((city) =>
        city.toLowerCase().includes(cityInputValue.toLowerCase()),
      )
    : citySuggestions;

  const form = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      legal_name: "",
      logo_url: "",
      phone: "",
      support_email: "",
      vat_number: "",
      tax_code: "",
      address_line: "",
      region: "",
      province: "",
      city: "",
      postal_code: "",
    },
  });

  // Carica i dati quando organization è disponibile
  useEffect(() => {
    if (organization) {
      const region = organization.region || "";
      const province = organization.province || "";
      const city = organization.city || "";

      form.reset({
        legal_name: organization.legal_name || "",
        logo_url: organization.logo_url || "",
        phone: organization.phone || "",
        support_email: organization.support_email || "",
        vat_number: organization.vat_number || "",
        tax_code: organization.tax_code || "",
        address_line: organization.address_line || "",
        region: region,
        province: province,
        city: city,
        postal_code: organization.postal_code || "",
      });
      setCurrentLogoUrl(organization.logo_url || "");

      // Imposta i filtri a cascata
      setSelectedRegion(region);
      setSelectedProvince(province);
      setSelectedCity(city);
      setCityInputValue(city || "");
    }
  }, [organization, form]);

  // Reset province quando cambia regione
  useEffect(() => {
    if (!selectedRegion) {
      setSelectedProvince("");
      setSelectedCity("");
      form.setValue("province", "");
      form.setValue("city", "");
    }
  }, [selectedRegion, form]);

  // Reset città quando cambia provincia
  useEffect(() => {
    if (!selectedProvince) {
      setSelectedCity("");
      setCityInputValue("");
      form.setValue("city", "");
      setShowCitySuggestions(false);
    } else {
      // Reset input quando cambia provincia
      setCityInputValue("");
      setShowCitySuggestions(false);
    }
  }, [selectedProvince, form]);

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Errore",
        description: "Solo file PNG e JPEG sono supportati.",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast({
        title: "Errore",
        description: "File troppo grande. Massimo 2MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const orgData = localStorage.getItem("organization");
      if (!orgData) throw new Error("Dati organizzazione non trovati");

      const org = JSON.parse(orgData);
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Token di autenticazione mancante");

      const response = await fetch(
        `/api/settings/organization/upload-logo?orgId=${org.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Errore durante l'upload");
      }

      // Il backend restituisce logo_url direttamente o in data.organization.logoUrl
      const logoUrl =
        result.logo_url || result.data?.organization?.logoUrl || "";
      if (logoUrl) {
        form.setValue("logo_url", logoUrl);
        setCurrentLogoUrl(logoUrl);
      }

      toast({
        title: "Successo",
        description: "Logo caricato con successo!",
      });
    } catch (error: any) {
      console.error("Errore upload logo:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'upload del logo.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSubmit = async (data: OrganizationForm) => {
    try {
      const result = await updateMutation.mutateAsync(data);
      toast({
        title: "Successo",
        description: "Impostazioni salvate correttamente.",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile salvare le impostazioni.",
        variant: "destructive",
      });
    }
  };

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
    );
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
                {...form.register("legal_name")}
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
              {(form.watch("logo_url") || currentLogoUrl) && (
                <div className="mt-4">
                  <img
                    src={form.watch("logo_url") || currentLogoUrl}
                    alt="Anteprima logo"
                    className="h-20 w-20 object-contain rounded border border-gray-300"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}
            </div>

            {/* Telefono */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                {...form.register("phone")}
                placeholder="+39 123 456 7890"
                type="tel"
              />
            </div>

            {/* Email supporto */}
            <div className="space-y-2">
              <Label htmlFor="support_email">Email di Supporto</Label>
              <Input
                id="support_email"
                {...form.register("support_email")}
                placeholder="support@azienda.it"
                type="email"
              />
              {form.formState.errors.support_email && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.support_email.message}
                </p>
              )}
            </div>

            {/* Tipo organizzazione (determinato automaticamente dalle capabilities) */}
            <div className="space-y-2">
              <Label htmlFor="org_type">Tipo Organizzazione</Label>
              <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                {(() => {
                  const org = organization;
                  const orgType = org?.type || org?.org_type;
                  let result;
                  if (orgType === "provider") {
                    result = "Provider";
                  } else if (orgType === "buyer") {
                    result = "Acquirente";
                  } else {
                    result = "Non specificato";
                  }

                  return result;
                })()}
              </div>
              <p className="text-xs text-gray-500">
                Il tipo di organizzazione è determinato automaticamente dalle
                sue capabilities e non può essere modificato manualmente.
              </p>
            </div>

            {/* Partita IVA */}
            <div className="space-y-2">
              <Label htmlFor="vat_number">Partita IVA</Label>
              <Input
                id="vat_number"
                {...form.register("vat_number")}
                placeholder="IT12345678901"
              />
            </div>

            {/* Codice Fiscale */}
            <div className="space-y-2">
              <Label htmlFor="tax_code">Codice Fiscale</Label>
              <Input
                id="tax_code"
                {...form.register("tax_code")}
                placeholder="RSSMRA85M01H501Z"
              />
            </div>

            {/* Indirizzo - Via */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_line">Via / Indirizzo *</Label>
              <Input
                id="address_line"
                {...form.register("address_line")}
                placeholder="Via Example 123"
              />
              {form.formState.errors.address_line && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.address_line.message}
                </p>
              )}
            </div>

            {/* Regione */}
            <div className="space-y-2">
              <Label htmlFor="region">Regione</Label>
              <Select
                value={selectedRegion}
                onValueChange={(value) => {
                  setSelectedRegion(value);
                  form.setValue("region", value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona regione" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provincia */}
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Select
                value={selectedProvince}
                onValueChange={(value) => {
                  setSelectedProvince(value);
                  form.setValue("province", value);
                }}
                disabled={!selectedRegion}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedRegion
                        ? "Seleziona provincia"
                        : "Prima seleziona regione"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredProvinces.map((province) => (
                    <SelectItem key={province.code} value={province.code}>
                      {province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Città - Input con autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="city">Città</Label>
              <div className="relative">
                <Input
                  id="city"
                  {...form.register("city")}
                  value={cityInputValue || form.watch("city") || ""}
                  placeholder={
                    selectedProvince
                      ? "Inserisci città (con suggerimenti)"
                      : "Prima seleziona provincia"
                  }
                  disabled={!selectedProvince}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCityInputValue(value);
                    setSelectedCity(value);
                    form.setValue("city", value);
                    setShowCitySuggestions(
                      value.length > 0 && filteredCitySuggestions.length > 0,
                    );
                  }}
                  onFocus={() => {
                    if (cityInputValue && filteredCitySuggestions.length > 0) {
                      setShowCitySuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay per permettere click su suggerimento
                    setTimeout(() => setShowCitySuggestions(false), 200);
                  }}
                />
                {/* Suggerimenti autocomplete */}
                {showCitySuggestions &&
                  selectedProvince &&
                  filteredCitySuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredCitySuggestions.slice(0, 10).map((city) => (
                        <button
                          key={city}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                          onClick={() => {
                            setCityInputValue(city);
                            setSelectedCity(city);
                            form.setValue("city", city);
                            setShowCitySuggestions(false);
                          }}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
              {selectedProvince && citySuggestions.length > 0 && (
                <p className="text-xs text-slate-500">
                  {citySuggestions.length} città disponibili come suggerimenti.
                  Puoi anche inserire una città non in lista.
                </p>
              )}
            </div>

            {/* CAP */}
            <div className="space-y-2">
              <Label htmlFor="postal_code">CAP</Label>
              <Input
                id="postal_code"
                {...form.register("postal_code")}
                placeholder="20100"
                maxLength={5}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending || uploadingLogo}
            >
              {updateMutation.isPending
                ? "Salvataggio..."
                : "Salva Impostazioni"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
