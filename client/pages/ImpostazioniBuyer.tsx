import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BuyerLayout } from "@/components/BuyerLayout";
import {
  User,
  Building,
  MapPin,
  Phone,
  Mail,
  Bell,
  Shield,
  Save,
  RefreshCw,
  Truck,
  FileText,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  type Address,
} from "@/lib/api";

export default function ImpostazioniBuyer() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    address: "",
    city: "",
    postalCode: "",
    taxId: "",
  });

  const [notifications, setNotifications] = useState({
    emailQuotes: true,
    emailUpdates: true,
    smsAlerts: false,
    marketingEmails: false,
  });

  // Stato per form indirizzo
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
    type: "SHIPPING" as "SHIPPING" | "BILLING",
    name: "",
    company: "",
    address_line: "",
    city: "",
    province: "",
    postal_code: "",
    country: "IT",
    phone: "",
    is_default: false,
  });

  // Carica dati utente e organizzazione dal localStorage
  useEffect(() => {
    try {
      const orgData = localStorage.getItem("organization");
      if (orgData) {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
        setUserData({
          firstName: org.contact_first_name || "",
          lastName: org.contact_last_name || "",
          email: org.contact_email || "",
          phone: org.contact_phone || "",
          companyName: org.name || "",
          address: org.address || "",
          city: org.city || "",
          postalCode: org.postal_code || "",
          taxId: org.tax_id || "",
        });
      }
    } catch (error) {
      console.error("Errore nel caricamento dati utente:", error);
    }
  }, []);

  // Query per indirizzi spedizione
  const { data: shippingAddresses = [], isLoading: shippingLoading } = useQuery(
    {
      queryKey: ["addresses", currentOrgId, "SHIPPING"],
      queryFn: () =>
        currentOrgId
          ? getAddresses(currentOrgId, "SHIPPING")
          : Promise.resolve([]),
      enabled: !!currentOrgId,
    },
  );

  // Query per indirizzi fatturazione
  const { data: billingAddresses = [], isLoading: billingLoading } = useQuery({
    queryKey: ["addresses", currentOrgId, "BILLING"],
    queryFn: () =>
      currentOrgId
        ? getAddresses(currentOrgId, "BILLING")
        : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  // Mutazioni per indirizzi
  const createAddressMutation = useMutation({
    mutationFn: (addressData: typeof addressForm) =>
      createAddress({ orgId: currentOrgId!, ...addressData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Indirizzo aggiunto con successo");
      resetAddressForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore nell'aggiunta dell'indirizzo");
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({
      addressId,
      updates,
    }: {
      addressId: string;
      updates: Partial<Address>;
    }) => updateAddress(addressId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Indirizzo aggiornato con successo");
      resetAddressForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore nell'aggiornamento dell'indirizzo");
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: string) => deleteAddress(addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Indirizzo eliminato con successo");
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore nell'eliminazione dell'indirizzo");
    },
  });

  const resetAddressForm = () => {
    setAddressForm({
      type: "SHIPPING",
      name: "",
      company: "",
      address_line: "",
      city: "",
      province: "",
      postal_code: "",
      country: "IT",
      phone: "",
      is_default: false,
    });
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const startEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      type: address.type,
      name: address.name,
      company: address.company || "",
      address_line: address.address_line,
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone || "",
      is_default: address.is_default,
    });
    setShowAddressForm(true);
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAddress) {
      updateAddressMutation.mutate({
        addressId: editingAddress.id,
        updates: addressForm,
      });
    } else {
      createAddressMutation.mutate(addressForm);
    }
  };

  const handleUserDataChange = (field: string, value: string) => {
    setUserData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      // Simulazione salvataggio
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Salva nel localStorage (in produzione andrebbe all'API)
      const orgData = localStorage.getItem("organization");
      if (orgData) {
        const org = JSON.parse(orgData);
        const updatedOrg = {
          ...org,
          name: userData.companyName,
          contact_first_name: userData.firstName,
          contact_last_name: userData.lastName,
          contact_email: userData.email,
          contact_phone: userData.phone,
          address: userData.address,
          city: userData.city,
          postal_code: userData.postalCode,
          tax_id: userData.taxId,
        };
        localStorage.setItem("organization", JSON.stringify(updatedOrg));
      }

      alert("Profilo aggiornato con successo!");
    } catch (error) {
      alert("Errore durante il salvataggio. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      // Simulazione salvataggio
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Salva nel localStorage (in produzione andrebbe all'API)
      localStorage.setItem(
        "buyer_notifications",
        JSON.stringify(notifications),
      );

      alert("Preferenze notifiche aggiornate!");
    } catch (error) {
      alert("Errore durante il salvataggio. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BuyerLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Impostazioni</h1>
          <p className="text-slate-600 mt-1">
            Gestisci il tuo profilo e le preferenze
          </p>
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Informazioni Personali
                </h2>
                <p className="text-slate-600">
                  Aggiorna i tuoi dati personali e aziendali
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dati Personali
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={userData.firstName}
                      onChange={(e) =>
                        handleUserDataChange("firstName", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cognome
                    </label>
                    <input
                      type="text"
                      value={userData.lastName}
                      onChange={(e) =>
                        handleUserDataChange("lastName", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="email"
                      value={userData.email}
                      onChange={(e) =>
                        handleUserDataChange("email", e.target.value)
                      }
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Telefono
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="tel"
                      value={userData.phone}
                      onChange={(e) =>
                        handleUserDataChange("phone", e.target.value)
                      }
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Dati Aziendali
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ragione Sociale
                  </label>
                  <input
                    type="text"
                    value={userData.companyName}
                    onChange={(e) =>
                      handleUserDataChange("companyName", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Indirizzo
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      value={userData.address}
                      onChange={(e) =>
                        handleUserDataChange("address", e.target.value)
                      }
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Città
                    </label>
                    <input
                      type="text"
                      value={userData.city}
                      onChange={(e) =>
                        handleUserDataChange("city", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CAP
                    </label>
                    <input
                      type="text"
                      value={userData.postalCode}
                      onChange={(e) =>
                        handleUserDataChange("postalCode", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Partita IVA / Codice Fiscale
                  </label>
                  <input
                    type="text"
                    value={userData.taxId}
                    onChange={(e) =>
                      handleUserDataChange("taxId", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={handleSaveProfile}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Preferenze Notifiche
                </h2>
                <p className="text-slate-600">
                  Scegli come ricevere gli aggiornamenti
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">
                  Preventivi e aggiornamenti
                </div>
                <div className="text-sm text-slate-600">
                  Ricevi email quando i tuoi preventivi vengono aggiornati
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.emailQuotes}
                  onChange={(e) =>
                    handleNotificationChange("emailQuotes", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">
                  Aggiornamenti di stato
                </div>
                <div className="text-sm text-slate-600">
                  Notifiche sui cambiamenti di stato delle missioni
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.emailUpdates}
                  onChange={(e) =>
                    handleNotificationChange("emailUpdates", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Avvisi SMS</div>
                <div className="text-sm text-slate-600">
                  Ricevi SMS per missioni urgenti o problemi
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.smsAlerts}
                  onChange={(e) =>
                    handleNotificationChange("smsAlerts", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">
                  Newsletter e promozioni
                </div>
                <div className="text-sm text-slate-600">
                  Ricevi aggiornamenti sui nuovi servizi e offerte
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.marketingEmails}
                  onChange={(e) =>
                    handleNotificationChange(
                      "marketingEmails",
                      e.target.checked,
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <button
                onClick={handleSaveNotifications}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salva Preferenze
              </button>
            </div>
          </div>
        </div>

        {/* Address Management */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Indirizzi
                  </h2>
                  <p className="text-slate-600">
                    Gestisci indirizzi di spedizione e fatturazione
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddressForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuovo Indirizzo
              </button>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Indirizzi Spedizione */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-slate-600" />
                Indirizzi di Spedizione
              </h3>
              {shippingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : shippingAddresses.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Nessun indirizzo di spedizione salvato</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shippingAddresses.map((address: Address) => (
                    <div
                      key={address.id}
                      className="border border-slate-200 rounded-lg p-4 relative"
                    >
                      {address.is_default && (
                        <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                          Predefinito
                        </div>
                      )}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-900">
                          {address.name}
                        </h4>
                        {address.company && (
                          <p className="text-slate-600">{address.company}</p>
                        )}
                        <p className="text-slate-700">{address.address_line}</p>
                        <p className="text-slate-700">
                          {address.postal_code} {address.city} (
                          {address.province})
                        </p>
                        <p className="text-slate-700">{address.country}</p>
                        {address.phone && (
                          <p className="text-slate-600 flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {address.phone}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => startEditAddress(address)}
                          className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200 transition-colors"
                        >
                          <Edit className="w-4 h-4 inline mr-1" />
                          Modifica
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Sei sicuro di voler eliminare questo indirizzo?",
                              )
                            ) {
                              deleteAddressMutation.mutate(address.id);
                            }
                          }}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Indirizzi Fatturazione */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Indirizzi di Fatturazione
              </h3>
              {billingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : billingAddresses.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Nessun indirizzo di fatturazione salvato</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {billingAddresses.map((address: Address) => (
                    <div
                      key={address.id}
                      className="border border-slate-200 rounded-lg p-4 relative"
                    >
                      {address.is_default && (
                        <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                          Predefinito
                        </div>
                      )}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-900">
                          {address.name}
                        </h4>
                        {address.company && (
                          <p className="text-slate-600">{address.company}</p>
                        )}
                        <p className="text-slate-700">{address.address_line}</p>
                        <p className="text-slate-700">
                          {address.postal_code} {address.city} (
                          {address.province})
                        </p>
                        <p className="text-slate-700">{address.country}</p>
                        {address.phone && (
                          <p className="text-slate-600 flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {address.phone}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => startEditAddress(address)}
                          className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200 transition-colors"
                        >
                          <Edit className="w-4 h-4 inline mr-1" />
                          Modifica
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Sei sicuro di voler eliminare questo indirizzo?",
                              )
                            ) {
                              deleteAddressMutation.mutate(address.id);
                            }
                          }}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address Form Modal */}
        {showAddressForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingAddress ? "Modifica Indirizzo" : "Nuovo Indirizzo"}
                  </h3>
                  <button
                    onClick={resetAddressForm}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddressSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tipo Indirizzo *
                    </label>
                    <select
                      value={addressForm.type}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          type: e.target.value as "SHIPPING" | "BILLING",
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="SHIPPING">Spedizione</option>
                      <option value="BILLING">Fatturazione</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nome Contatto *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.name}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Mario Rossi"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Azienda
                    </label>
                    <input
                      type="text"
                      value={addressForm.company}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          company: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Azienda Srl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      value={addressForm.phone}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="+39 123 456 7890"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Indirizzo *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.address_line}
                    onChange={(e) =>
                      setAddressForm((prev) => ({
                        ...prev,
                        address_line: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Via Roma 123"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      CAP *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.postal_code}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          postal_code: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="00100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Città *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.city}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Roma"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Provincia *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.province}
                      onChange={(e) =>
                        setAddressForm((prev) => ({
                          ...prev,
                          province: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="RM"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={addressForm.is_default}
                    onChange={(e) =>
                      setAddressForm((prev) => ({
                        ...prev,
                        is_default: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label
                    htmlFor="is_default"
                    className="text-sm text-slate-700"
                  >
                    Imposta come indirizzo predefinito
                  </label>
                </div>

                <div className="flex gap-4 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetAddressForm}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createAddressMutation.isPending ||
                      updateAddressMutation.isPending
                    }
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {(createAddressMutation.isPending ||
                      updateAddressMutation.isPending) && (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    )}
                    {editingAddress ? "Salva Modifiche" : "Aggiungi Indirizzo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Security Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Sicurezza</h2>
                <p className="text-slate-600">
                  Gestisci la sicurezza del tuo account
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="font-medium text-slate-900">
                  Cambia Password
                </div>
                <div className="text-sm text-slate-600">
                  Aggiorna la password del tuo account
                </div>
              </div>
              <button className="px-4 py-2 text-emerald-600 font-medium hover:bg-emerald-50 rounded-lg transition-colors">
                Cambia
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-t border-slate-200">
              <div>
                <div className="font-medium text-slate-900">
                  Autenticazione a due fattori
                </div>
                <div className="text-sm text-slate-600">
                  Aggiungi un ulteriore livello di sicurezza
                </div>
              </div>
              <button className="px-4 py-2 text-emerald-600 font-medium hover:bg-emerald-50 rounded-lg transition-colors">
                Attiva
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-t border-slate-200">
              <div>
                <div className="font-medium text-slate-900">
                  Sessioni attive
                </div>
                <div className="text-sm text-slate-600">
                  Visualizza e gestisci le tue sessioni
                </div>
              </div>
              <button className="px-4 py-2 text-emerald-600 font-medium hover:bg-emerald-50 rounded-lg transition-colors">
                Gestisci
              </button>
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
