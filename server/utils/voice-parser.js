// Parser semplice per testi vocali senza AI - fallback quando Grok è bloccato
function parseVoiceTextSimple(text) {
  const lowerText = text.toLowerCase();
  
  let result = {
    field_name: null,
    service_type: null,
    crop_type: null,
    treatment_type: null,
    terrain_conditions: null,
    notes: null,
    confidence: 0.0,
    explanation: "parsed with simple rules"
  };

  // Pattern matching per service_type
  if (lowerText.includes('irror') || lowerText.includes('spray') || lowerText.includes('tratt')) {
    result.service_type = 'SPRAY';
    result.confidence += 0.3;
  } else if (lowerText.includes('spand') || lowerText.includes('spread') || lowerText.includes('distribu')) {
    result.service_type = 'SPREAD';
    result.confidence += 0.3;
  } else if (lowerText.includes('mappa') || lowerText.includes('mapping') || lowerText.includes('termo') || lowerText.includes('thermal')) {
    result.service_type = 'MAPPING';
    result.confidence += 0.3;
  }

  // Pattern matching per crop_type
  if (lowerText.includes('vign') || lowerText.includes('uva') || lowerText.includes('vite')) {
    result.crop_type = 'VINEYARD';
    result.confidence += 0.2;
  } else if (lowerText.includes('oliv') || lowerText.includes('olivo')) {
    result.crop_type = 'OLIVE_GROVE';
    result.confidence += 0.2;
  } else if (lowerText.includes('cereal') || lowerText.includes('grano') || lowerText.includes('mais')) {
    result.crop_type = 'CEREAL';
    result.confidence += 0.2;
  } else if (lowerText.includes('ortagg') || lowerText.includes('verdura')) {
    result.crop_type = 'VEGETABLES';
    result.confidence += 0.2;
  } else if (lowerText.includes('frutt') || lowerText.includes('melo') || lowerText.includes('pero')) {
    result.crop_type = 'FRUIT';
    result.confidence += 0.2;
  }

  // Pattern matching per treatment_type basato su service_type
  if (result.service_type === 'SPRAY') {
    if (lowerText.includes('funghi') || lowerText.includes('fung')) {
      result.treatment_type = 'FUNGICIDE';
      result.confidence += 0.2;
    } else if (lowerText.includes('inset') || lowerText.includes('parassit')) {
      result.treatment_type = 'INSECTICIDE';
      result.confidence += 0.2;
    } else if (lowerText.includes('erb') || lowerText.includes('diserb')) {
      result.treatment_type = 'HERBICIDE';
      result.confidence += 0.2;
    } else if (lowerText.includes('nutrien') || lowerText.includes('fertil') || lowerText.includes('concim')) {
      result.treatment_type = 'FERTILIZER';
      result.confidence += 0.2;
    }
  } else if (result.service_type === 'SPREAD') {
    if (lowerText.includes('organic') || lowerText.includes('organico')) {
      result.treatment_type = 'ORGANIC_FERTILIZER';
      result.confidence += 0.2;
    } else if (lowerText.includes('chimic') || lowerText.includes('chemical')) {
      result.treatment_type = 'CHEMICAL_FERTILIZER';
      result.confidence += 0.2;
    } else if (lowerText.includes('calce') || lowerText.includes('lime')) {
      result.treatment_type = 'LIME';
      result.confidence += 0.2;
    }
  } else if (result.service_type === 'MAPPING') {
    if (lowerText.includes('ndvi') || lowerText.includes('vegeta')) {
      result.treatment_type = 'NDVI';
      result.confidence += 0.2;
    } else if (lowerText.includes('term') || lowerText.includes('thermal') || lowerText.includes('temperatura')) {
      result.treatment_type = 'THERMAL';
      result.confidence += 0.2;
    } else if (lowerText.includes('spett') || lowerText.includes('multisp')) {
      result.treatment_type = 'MULTISPECTRAL';
      result.confidence += 0.2;
    } else if (lowerText.includes('foto') || lowerText.includes('ortho')) {
      result.treatment_type = 'ORTHOPHOTO';
      result.confidence += 0.2;
    }
  }

  // Pattern matching per terrain_conditions
  if (lowerText.includes('collin') || lowerText.includes('collina')) {
    result.terrain_conditions = 'HILLY';
    result.confidence += 0.2;
  } else if (lowerText.includes('monta') || lowerText.includes('mountain')) {
    result.terrain_conditions = 'MOUNTAINOUS';
    result.confidence += 0.2;
  } else if (lowerText.includes('pian') || lowerText.includes('flat')) {
    result.terrain_conditions = 'FLAT';
    result.confidence += 0.2;
  }

  // Estrai field_name se presente
  const fieldPatterns = [
    /campo\s+(.+?)(?:\s+con|\s+e|\s+per|$)/i,
    /appezzamento\s+(.+?)(?:\s+con|\s+e|\s+per|$)/i,
    /terreno\s+(.+?)(?:\s+con|\s+e|\s+per|$)/i
  ];

  for (const pattern of fieldPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.field_name = match[1].trim();
      result.confidence += 0.1;
      break;
    }
  }

  // Estrai note aggiuntive
  if (lowerText.includes('settimana') || lowerText.includes('prossima') || lowerText.includes('urgen')) {
    result.notes = "Richiesta urgenza per settimana prossima";
    result.confidence += 0.1;
  }

  return result;
}

export { parseVoiceTextSimple };
