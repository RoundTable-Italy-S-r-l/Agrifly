// Dati geografici italiani per menu a tendina
export interface ProvinceData {
  code: string;
  name: string;
  region: string;
}

export interface CityData {
  name: string;
  province: string;
  postalCodes: string[];
}

// Province italiane con relativa regione
export const provinces: ProvinceData[] = [
  // Abruzzo
  { code: 'CH', name: 'Chieti', region: 'Abruzzo' },
  { code: 'AQ', name: 'L\'Aquila', region: 'Abruzzo' },
  { code: 'PE', name: 'Pescara', region: 'Abruzzo' },
  { code: 'TE', name: 'Teramo', region: 'Abruzzo' },

  // Basilicata
  { code: 'MT', name: 'Matera', region: 'Basilicata' },
  { code: 'PZ', name: 'Potenza', region: 'Basilicata' },

  // Calabria
  { code: 'CS', name: 'Cosenza', region: 'Calabria' },
  { code: 'CZ', name: 'Catanzaro', region: 'Calabria' },
  { code: 'RC', name: 'Reggio Calabria', region: 'Calabria' },
  { code: 'KR', name: 'Crotone', region: 'Calabria' },
  { code: 'VV', name: 'Vibo Valentia', region: 'Calabria' },

  // Campania
  { code: 'AV', name: 'Avellino', region: 'Campania' },
  { code: 'BN', name: 'Benevento', region: 'Campania' },
  { code: 'CE', name: 'Caserta', region: 'Campania' },
  { code: 'NA', name: 'Napoli', region: 'Campania' },
  { code: 'SA', name: 'Salerno', region: 'Campania' },

  // Emilia-Romagna
  { code: 'BO', name: 'Bologna', region: 'Emilia-Romagna' },
  { code: 'FE', name: 'Ferrara', region: 'Emilia-Romagna' },
  { code: 'FC', name: 'Forlì-Cesena', region: 'Emilia-Romagna' },
  { code: 'MO', name: 'Modena', region: 'Emilia-Romagna' },
  { code: 'PR', name: 'Parma', region: 'Emilia-Romagna' },
  { code: 'PC', name: 'Piacenza', region: 'Emilia-Romagna' },
  { code: 'RA', name: 'Ravenna', region: 'Emilia-Romagna' },
  { code: 'RE', name: 'Reggio Emilia', region: 'Emilia-Romagna' },
  { code: 'RN', name: 'Rimini', region: 'Emilia-Romagna' },

  // Friuli-Venezia Giulia
  { code: 'GO', name: 'Gorizia', region: 'Friuli-Venezia Giulia' },
  { code: 'PN', name: 'Pordenone', region: 'Friuli-Venezia Giulia' },
  { code: 'TS', name: 'Trieste', region: 'Friuli-Venezia Giulia' },
  { code: 'UD', name: 'Udine', region: 'Friuli-Venezia Giulia' },

  // Lazio
  { code: 'FR', name: 'Frosinone', region: 'Lazio' },
  { code: 'LT', name: 'Latina', region: 'Lazio' },
  { code: 'RI', name: 'Rieti', region: 'Lazio' },
  { code: 'RM', name: 'Roma', region: 'Lazio' },
  { code: 'VT', name: 'Viterbo', region: 'Lazio' },

  // Liguria
  { code: 'GE', name: 'Genova', region: 'Liguria' },
  { code: 'IM', name: 'Imperia', region: 'Liguria' },
  { code: 'SP', name: 'La Spezia', region: 'Liguria' },
  { code: 'SV', name: 'Savona', region: 'Liguria' },

  // Lombardia
  { code: 'BG', name: 'Bergamo', region: 'Lombardia' },
  { code: 'BS', name: 'Brescia', region: 'Lombardia' },
  { code: 'CO', name: 'Como', region: 'Lombardia' },
  { code: 'CR', name: 'Cremona', region: 'Lombardia' },
  { code: 'LC', name: 'Lecco', region: 'Lombardia' },
  { code: 'LO', name: 'Lodi', region: 'Lombardia' },
  { code: 'MN', name: 'Mantova', region: 'Lombardia' },
  { code: 'MI', name: 'Milano', region: 'Lombardia' },
  { code: 'MB', name: 'Monza e Brianza', region: 'Lombardia' },
  { code: 'PV', name: 'Pavia', region: 'Lombardia' },
  { code: 'SO', name: 'Sondrio', region: 'Lombardia' },
  { code: 'VA', name: 'Varese', region: 'Lombardia' },

  // Marche
  { code: 'AN', name: 'Ancona', region: 'Marche' },
  { code: 'AP', name: 'Ascoli Piceno', region: 'Marche' },
  { code: 'FM', name: 'Fermo', region: 'Marche' },
  { code: 'MC', name: 'Macerata', region: 'Marche' },
  { code: 'PU', name: 'Pesaro e Urbino', region: 'Marche' },

  // Molise
  { code: 'CB', name: 'Campobasso', region: 'Molise' },
  { code: 'IS', name: 'Isernia', region: 'Molise' },

  // Piemonte
  { code: 'AL', name: 'Alessandria', region: 'Piemonte' },
  { code: 'AT', name: 'Asti', region: 'Piemonte' },
  { code: 'BI', name: 'Biella', region: 'Piemonte' },
  { code: 'CN', name: 'Cuneo', region: 'Piemonte' },
  { code: 'NO', name: 'Novara', region: 'Piemonte' },
  { code: 'TO', name: 'Torino', region: 'Piemonte' },
  { code: 'VB', name: 'Verbano-Cusio-Ossola', region: 'Piemonte' },
  { code: 'VC', name: 'Vercelli', region: 'Piemonte' },

  // Puglia
  { code: 'BA', name: 'Bari', region: 'Puglia' },
  { code: 'BT', name: 'Barletta-Andria-Trani', region: 'Puglia' },
  { code: 'BR', name: 'Brindisi', region: 'Puglia' },
  { code: 'FG', name: 'Foggia', region: 'Puglia' },
  { code: 'LE', name: 'Lecce', region: 'Puglia' },
  { code: 'TA', name: 'Taranto', region: 'Puglia' },

  // Sardegna
  { code: 'CA', name: 'Cagliari', region: 'Sardegna' },
  { code: 'CI', name: 'Carbonia-Iglesias', region: 'Sardegna' },
  { code: 'NU', name: 'Nuoro', region: 'Sardegna' },
  { code: 'OG', name: 'Ogliastra', region: 'Sardegna' },
  { code: 'OR', name: 'Olbia-Tempio', region: 'Sardegna' },
  { code: 'OT', name: 'Olbia-Tempio', region: 'Sardegna' },
  { code: 'SS', name: 'Sassari', region: 'Sardegna' },
  { code: 'SU', name: 'Sud Sardegna', region: 'Sardegna' },

  // Sicilia
  { code: 'AG', name: 'Agrigento', region: 'Sicilia' },
  { code: 'CL', name: 'Caltanissetta', region: 'Sicilia' },
  { code: 'CT', name: 'Catania', region: 'Sicilia' },
  { code: 'EN', name: 'Enna', region: 'Sicilia' },
  { code: 'ME', name: 'Messina', region: 'Sicilia' },
  { code: 'PA', name: 'Palermo', region: 'Sicilia' },
  { code: 'RG', name: 'Ragusa', region: 'Sicilia' },
  { code: 'SR', name: 'Siracusa', region: 'Sicilia' },
  { code: 'TP', name: 'Trapani', region: 'Sicilia' },

  // Toscana
  { code: 'AR', name: 'Arezzo', region: 'Toscana' },
  { code: 'FI', name: 'Firenze', region: 'Toscana' },
  { code: 'GR', name: 'Grosseto', region: 'Toscana' },
  { code: 'LI', name: 'Livorno', region: 'Toscana' },
  { code: 'LU', name: 'Lucca', region: 'Toscana' },
  { code: 'MS', name: 'Massa-Carrara', region: 'Toscana' },
  { code: 'PI', name: 'Pisa', region: 'Toscana' },
  { code: 'PT', name: 'Pistoia', region: 'Toscana' },
  { code: 'PO', name: 'Prato', region: 'Toscana' },
  { code: 'SI', name: 'Siena', region: 'Toscana' },

  // Trentino-Alto Adige
  { code: 'BZ', name: 'Bolzano', region: 'Trentino-Alto Adige' },
  { code: 'TN', name: 'Trento', region: 'Trentino-Alto Adige' },

  // Umbria
  { code: 'PG', name: 'Perugia', region: 'Umbria' },
  { code: 'TR', name: 'Terni', region: 'Umbria' },

  // Valle d'Aosta
  { code: 'AO', name: 'Aosta', region: 'Valle d\'Aosta' },

  // Veneto
  { code: 'BL', name: 'Belluno', region: 'Veneto' },
  { code: 'PD', name: 'Padova', region: 'Veneto' },
  { code: 'RO', name: 'Rovigo', region: 'Veneto' },
  { code: 'TV', name: 'Treviso', region: 'Veneto' },
  { code: 'VE', name: 'Venezia', region: 'Veneto' },
  { code: 'VI', name: 'Vicenza', region: 'Veneto' },
  { code: 'VR', name: 'Verona', region: 'Veneto' },
];

// Alcune città principali per provincia (esempio parziale)
export const majorCities: { [provinceCode: string]: string[] } = {
  // Emilia-Romagna
  'BO': ['Bologna', 'Imola', 'San Lazzaro di Savena', 'Casalecchio di Reno', 'Zola Predosa'],
  'MO': ['Modena', 'Carpi', 'Sassuolo', 'Formigine', 'Castelfranco Emilia'],
  'RE': ['Reggio Emilia', 'Scandiano', 'Correggio', 'Rubiara', 'Cavriago'],
  'PR': ['Parma', 'Fidenza', 'Salsomaggiore Terme', 'Collecchio', 'Montechiarugolo'],
  'PC': ['Piacenza', 'Fiorenzuola d\'Arda', 'Castelsangiovanni', 'Rottofreno', 'Pontenure'],
  'RA': ['Ravenna', 'Faenza', 'Lugo', 'Cervia', 'Russi'],
  'FC': ['Forlì', 'Cesena', 'Cesenatico', 'Gambettola', 'Savignano sul Rubicone'],
  'RN': ['Rimini', 'Riccone', 'Bellaria-Igea Marina', 'Cattolica', 'Misano Adriatico'],

  // Lombardia
  'MI': ['Milano', 'Sesto San Giovanni', 'Cinisello Balsamo', 'Cologno Monzese', 'Bresso'],
  'BG': ['Bergamo', 'Dalmine', 'Alzano Lombardo', 'Seriate', 'Trescore Balneario'],
  'BS': ['Brescia', 'Desenzano del Garda', 'Montichiari', 'Lumezzane', 'Ghedi'],
  'CO': ['Como', 'Cantù', 'Mariano Comense', 'Fino Mornasco', 'Lurate Caccivio'],

  // Lazio
  'RM': ['Roma', 'Fiumicino', 'Tivoli', 'Velletri', 'Anzio'],

  // Campania
  'NA': ['Napoli', 'Pozzuoli', 'Casoria', 'Giugliano in Campania', 'Torre del Greco'],

  // Sicilia
  'PA': ['Palermo', 'Bagheria', 'Monreale', 'Partinico', 'Termini Imerese'],
  'CT': ['Catania', 'Acireale', 'Caltagirone', 'Gravina di Catania', 'Misterbianco'],

  // Piemonte
  'TO': ['Torino', 'Moncalieri', 'Nichelino', 'Beinasco', 'Grugliasco'],

  // Veneto
  'VE': ['Venezia', 'Mestre', 'Marghera', 'Porto Marghera', 'Murano'],
  'PD': ['Padova', 'Abano Terme', 'Albignasego', 'Cadoneghe', 'Rubano'],
  'VR': ['Verona', 'Villafranca di Verona', 'San Bonifacio', 'Bussolengo', 'Sona'],

  // Toscana
  'FI': ['Firenze', 'Scandicci', 'Sesto Fiorentino', 'Campi Bisenzio', 'Bagno a Ripoli'],

  // Puglia
  'BA': ['Bari', 'Bitonto', 'Molfetta', 'Corato', 'Ruvo di Puglia'],
  'LE': ['Lecce', 'Nardò', 'Gallipoli', 'Casarano', 'Copertino'],
};

// Funzioni helper
export function getProvincesByRegion(region: string): ProvinceData[] {
  return provinces.filter(p => p.region === region);
}

export function getCitiesByProvince(provinceCode: string): string[] {
  return majorCities[provinceCode] || [];
}

export function getProvinceName(code: string): string {
  const province = provinces.find(p => p.code === code);
  return province ? province.name : code;
}

export function getProvinceCode(name: string): string {
  const province = provinces.find(p => p.name === name);
  return province ? province.code : name;
}
