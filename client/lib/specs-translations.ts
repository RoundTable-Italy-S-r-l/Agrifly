// Traduzioni italiane per tutte le chiavi degli specs

export const specsTranslations: { [key: string]: string } = {
  // Aircraft (Velivolo)
  'aircraft_weight_empty_kg': 'Peso a vuoto',
  'aircraft_weight_with_battery_kg': 'Peso con batteria',
  'aircraft_weight_lifting_kg': 'Peso con sistema sollevamento',
  'aircraft_weight_lifting_dual_battery_kg': 'Peso con sistema sollevamento doppia batteria',
  'aircraft_weight_spraying_2_nozzles_kg': 'Peso con sistema irrorazione (2 ugelli)',
  'aircraft_weight_spraying_4_nozzles_kg': 'Peso con sistema irrorazione (4 ugelli)',
  'aircraft_weight_spreading_kg': 'Peso con sistema spandimento',
  'aircraft_weight_with_db1580_battery_kg': 'Peso con batteria DB1580',
  'aircraft_weight_with_db2160_battery_kg': 'Peso con batteria DB2160',
  'aircraft_weight_net_g': 'Peso netto',
  'aircraft_diagonal_distance_mm': 'Distanza diagonale',
  'aircraft_wheelbase_diagonal_mm': 'Interasse diagonale',
  'aircraft_dimensions_folded': 'Dimensioni da ripiegato',
  'aircraft_dimensions_folded_mm': 'Dimensioni da ripiegato',
  'aircraft_dimensions_open_mm': 'Dimensioni da aperto',
  'aircraft_dimensions_unfolded_mm': 'Dimensioni da dispiegato',
  'flight_max_radius_m': 'Raggio massimo di volo',
  'flight_max_wind_resistance_ms': 'Resistenza massima al vento',
  'flight_max_speed_ms': 'Velocità massima',
  'flight_max_altitude_m': 'Quota massima',
  'flight_max_ascent_speed_ms': 'Velocità massima di salita',
  'flight_max_descent_speed_ms': 'Velocità massima di discesa',
  'flight_hover_accuracy_vertical_m': 'Precisione di hover verticale',
  'flight_hover_accuracy_horizontal_m': 'Precisione di hover orizzontale',
  'flight_max_flight_time_min': 'Autonomia massima',
  'flight_max_flight_distance_km': 'Distanza massima di volo',
  'flight_time_no_wind_minutes': 'Tempo di volo senza vento',
  'hover_time_no_wind_minutes': 'Tempo hover senza vento',
  'max_flight_distance_km': 'Distanza massima di volo',
  'max_ascend_speed_normal_ms': 'Velocità salita normale',
  'max_ascend_speed_sport_ms': 'Velocità salita sport',
  'max_descend_speed_ms': 'Velocità discesa massima',
  'max_horizontal_speed_normal_ms': 'Velocità orizzontale normale',
  'max_horizontal_speed_sport_forward_ms': 'Velocità orizzontale sport avanti',
  'max_service_ceiling_m': 'Quota di servizio massima',
  
  // Spray System (Sistema di irrorazione)
  'spray_tank_capacity_l': 'Capacità serbatoio di irrorazione',
  'spray_payload_max_kg': 'Carico massimo per irrorazione',
  'spray_effective_width_m': 'Larghezza effettiva di irrorazione',
  'spray_flow_rate_l_min': 'Portata di irrorazione',
  'spray_flow_rate_2_nozzles_l_min': 'Portata di irrorazione (2 ugelli)',
  'spray_flow_rate_4_nozzles_l_min': 'Portata di irrorazione (4 ugelli)',
  'spray_nozzle_count': 'Numero ugelli',
  'spray_nozzle_quantity': 'Quantità ugelli',
  'spray_nozzle_quantity_standard': 'Quantità ugelli standard',
  'spray_nozzle_quantity_optional': 'Quantità ugelli opzionali',
  'spray_nozzle_type': 'Tipo ugelli',
  'spray_nozzle_model': 'Modello ugelli',
  'spray_nozzle_model_standard': 'Modello ugelli standard',
  'spray_nozzle_model_optional': 'Modello ugelli opzionali',
  'spray_nozzle_spacing_mm': 'Distanza tra ugelli',
  'spray_droplet_size_range_um': 'Intervallo dimensione gocce',
  'spray_pump_type': 'Tipo pompa',
  'spray_pump_quantity': 'Quantità pompe',
  'spray_pump_flow_rate_l_min': 'Portata pompa',
  'spray_system_pressure_bar': 'Pressione sistema',
  'spray_system_model': 'Modello sistema irrorazione',
  'spray_system_dimensions_folded_mm': 'Dimensioni sistema da ripiegato',
  'spray_system_dimensions_extended_mm': 'Dimensioni sistema da esteso',
  'spray_tank_material': 'Materiale serbatoio',
  'spray_tank_cleaning_system': 'Sistema pulizia serbatoio',
  
  // Spreading System (Sistema di spandimento)
  'spreading_tank_capacity_l': 'Capacità serbatoio di spandimento',
  'spreading_payload_max_kg': 'Carico massimo per spandimento',
  'spreading_effective_width_m': 'Larghezza effettiva di spandimento',
  'spreading_flow_rate_kg_min': 'Portata di spandimento',
  'spreading_max_rate_kg_min': 'Velocità massima di spandimento',
  'spreading_system_type': 'Tipo sistema spandimento',
  'spreading_feed_system_type': 'Tipo sistema alimentazione',
  'spreading_material_diameter_range_mm': 'Intervallo diametro materiale',
  'spreading_system_dimensions_mm': 'Dimensioni sistema spandimento',
  'spreading_hopper_capacity_l': 'Capacità tramoggia',
  'spreading_disc_diameter_mm': 'Diametro disco di spandimento',
  'spreading_disc_speed_rpm': 'Velocità del disco',
  
  // Battery (Batteria)
  'battery_weight_kg': 'Peso batteria',
  'battery_capacity_mah': 'Capacità batteria',
  'battery_db1580_capacity_mah': 'Capacità batteria DB1580',
  'battery_db1580_weight_kg': 'Peso batteria DB1580',
  'battery_db2160_capacity_mah': 'Capacità batteria DB2160',
  'battery_db2160_weight_kg': 'Peso batteria DB2160',
  'battery_voltage_v': 'Tensione batteria',
  'battery_energy_wh': 'Energia batteria',
  'battery_model': 'Modello batteria',
  'battery_type': 'Tipo batteria',
  'battery_chemistry': 'Chimica batteria',
  'battery_charge_time_min': 'Tempo di ricarica',
  'battery_cycle_life': 'Cicli di vita',
  'battery_operating_temperature_c': 'Temperatura operativa',
  'battery_storage_temperature_c': 'Temperatura conservazione',
  'battery_smart_features': 'Funzionalità intelligenti',
  
  // Radar
  'radar_detection_range_m': 'Portata rilevamento radar',
  'radar_detection_angle_deg': 'Angolo rilevamento radar',
  'radar_type': 'Tipo radar',
  'radar_frequency_ghz': 'Frequenza radar',
  'radar_eirp_dbm': 'EIRP radar',
  'radar_front_model': 'Modello radar anteriore',
  'radar_rear_model': 'Modello radar posteriore',
  'radar_resolution_m': 'Risoluzione radar',
  'radar_obstacle_avoidance': 'Evitamento ostacoli radar',
  
  // Generator (Generatore)
  'generator_fuel_consumption_ml_kwh': 'Consumo carburante generatore',
  'generator_fuel_capacity_l': 'Capacità carburante generatore',
  'generator_oil_capacity_l': 'Capacità olio generatore',
  'generator_power_output_w': 'Potenza erogata generatore',
  'generator_power_max_w': 'Potenza massima generatore',
  'generator_fuel_tank_capacity_l': 'Capacità serbatoio carburante',
  'generator_runtime_h': 'Autonomia generatore',
  'generator_type': 'Tipo generatore',
  'generator_model': 'Modello generatore',
  'generator_noise_level_db': 'Livello rumore generatore',
  'generator_weight_kg': 'Peso generatore',
  
  // Charger (Caricatore)
  'charger_charge_time_min': 'Tempo di ricarica',
  'charger_charge_time_db1580_min': 'Tempo ricarica DB1580',
  'charger_charge_time_db2160_min': 'Tempo ricarica DB2160',
  'charger_power_w': 'Potenza caricatore',
  'charger_weight_kg': 'Peso caricatore',
  'charger_model': 'Modello caricatore',
  'charger_input_voltage_v': 'Tensione ingresso caricatore',
  'charger_output_voltage_v': 'Tensione uscita caricatore',
  'charger_type': 'Tipo caricatore',
  'charger_simultaneous_batteries': 'Batterie simultanee',
  'charger_cooling_system': 'Sistema raffreddamento',
  
  // Propulsion (Propulsione)
  'motor_stator_size_mm': 'Dimensioni statore motore',
  'motor_power_w': 'Potenza motore',
  'motor_power_per_rotor_w': 'Potenza per rotore',
  'motor_kv_rating': 'Rating KV motore',
  'motor_kv_rpm_per_v': 'KV motore (rpm/V)',
  'motor_model_number': 'Numero modello motore',
  'propeller_diameter_inch': 'Diametro elica',
  'propeller_diameter_inches': 'Diametro eliche',
  'propeller_pitch_inch': 'Passo elica',
  'propeller_material': 'Materiale elica',
  'propeller_count': 'Numero eliche',
  'propeller_quantity': 'Quantità eliche',
  'propeller_model_number': 'Numero modello elica',
  'propeller_rotation_diameter_mm': 'Diametro rotazione elica',
  
  // Camera/Sensors (Fotocamera/Sensori)
  'camera_resolution_mp': 'Risoluzione fotocamera',
  'camera_sensor_size': 'Dimensione sensore',
  'camera_fov_deg': 'Campo visivo fotocamera',
  'camera_video_resolution': 'Risoluzione video',
  'camera_frame_rate_fps': 'Frame rate video',
  'camera_gimbal_stabilization': 'Stabilizzazione gimbal',
  'camera_zoom_capability': 'Capacità zoom',
  'rgb_camera_resolution_mp': 'Risoluzione fotocamera RGB',
  'rgb_camera_sensor_type': 'Tipo sensore RGB',
  'rgb_camera_max_image_size_pixels': 'Dimensione massima immagine RGB',
  'rgb_camera_fov_degrees': 'Campo visivo fotocamera RGB',
  'rgb_camera_focal_length_mm': 'Lunghezza focale RGB',
  'rgb_camera_aperture_range': 'Intervallo apertura RGB',
  'rgb_camera_iso_range': 'Intervallo ISO RGB',
  'rgb_camera_video_resolution_4k': 'Risoluzione video 4K RGB',
  'rgb_camera_video_bitrate_4k_mbps': 'Bitrate video 4K RGB',
  'multispectral_camera_resolution_mp': 'Risoluzione fotocamera multispettrale',
  'multispectral_camera_sensor_type': 'Tipo sensore multispettrale',
  'multispectral_camera_max_image_size_pixels': 'Dimensione massima immagine multispettrale',
  'multispectral_camera_fov_degrees': 'Campo visivo fotocamera multispettrale',
  'multispectral_camera_bands': 'Bande fotocamera multispettrale',
  
  // GPS/Navigation
  'gps_accuracy_m': 'Precisione GPS',
  'gps_type': 'Tipo GPS',
  'gnss_supported_systems': 'Sistemi GNSS supportati',
  'rtk_enabled': 'RTK abilitato',
  'rtk_accuracy_cm': 'Precisione RTK',
  'rtk_accuracy_horizontal': 'Precisione RTK orizzontale',
  'rtk_accuracy_vertical': 'Precisione RTK verticale',
  'rtk_horizontal_accuracy': 'Precisione orizzontale RTK',
  'rtk_vertical_accuracy': 'Precisione verticale RTK',
  'rtk_module_power_w': 'Potenza modulo RTK',
  'rtk_module_weight_g': 'Peso modulo RTK',
  'compass_type': 'Tipo bussola',
  'imu_type': 'Tipo IMU',
  
  // Software/Control
  'software_version': 'Versione software',
  'app_compatibility': 'Compatibilità app',
  'remote_control_range_m': 'Portata radiocomando',
  'remote_control_frequency_ghz': 'Frequenza radiocomando',
  'remote_control_battery_life_h': 'Autonomia radiocomando',
  'controller_model': 'Modello radiocomando',
  'controller_battery_capacity_mah': 'Capacità batteria radiocomando',
  'controller_battery_voltage_v': 'Tensione batteria radiocomando',
  'controller_battery_internal_duration_h': 'Durata batteria interna',
  'controller_battery_external_duration_h': 'Durata batteria esterna',
  'controller_internal_storage_gb': 'Memoria interna radiocomando',
  'controller_screen_size_inches': 'Dimensione schermo radiocomando',
  'controller_screen_resolution_px': 'Risoluzione schermo radiocomando',
  'controller_screen_brightness_nit': 'Luminosità schermo radiocomando',
  'controller_operating_time_hours': 'Tempo operativo radiocomando',
  'controller_operating_temp_min_c': 'Temperatura operativa minima',
  'controller_operating_temp_max_c': 'Temperatura operativa massima',
  'controller_charging_temp_min_c': 'Temperatura ricarica minima',
  'controller_charging_temp_max_c': 'Temperatura ricarica massima',
  'controller_transmission_range_ce_m': 'Portata trasmissione CE',
  'controller_transmission_range_fcc_m': 'Portata trasmissione FCC',
  'controller_transmission_range_srrc_m': 'Portata trasmissione SRRC',
  'transmission_system_model': 'Modello sistema trasmissione',
  'transmission_max_range_ce_m': 'Portata massima trasmissione CE',
  'transmission_max_range_fcc_m': 'Portata massima trasmissione FCC',
  'transmission_latency_ms': 'Latenza trasmissione',
  
  // Safety/Compliance
  'ce_certification': 'Certificazione CE',
  'ip_rating': 'Classe protezione IP',
  'operating_temperature_range_c': 'Intervallo temperatura operativa',
  'operating_temperature_min_c': 'Temperatura operativa minima',
  'operating_temperature_max_c': 'Temperatura operativa massima',
  'storage_temperature_range_c': 'Intervallo temperatura conservazione',
  'max_operating_altitude_m': 'Quota operativa massima',
  'safety_distance_m': 'Distanza di sicurezza',
  'obstacle_avoidance_max_speed_ms': 'Velocità massima evitamento ostacoli',
  'obstacle_avoidance_min_height_m': 'Altezza minima evitamento ostacoli',
  
  // Performance
  'efficiency_ha_per_hour': 'Efficienza (ettari/ora)',
  'coverage_rate_ha_h': 'Velocità copertura',
  'spray_precision_mm': 'Precisione di irrorazione',
  'spreading_precision_mm': 'Precisione di spandimento',
  'work_efficiency_improvement_percent': 'Miglioramento efficienza lavoro',
  
  // Additional Features
  'smart_operation_mode': 'Modalità operativa intelligente',
  'autonomous_flight': 'Volo autonomo',
  'terrain_following': 'Seguimento terreno',
  'obstacle_avoidance': 'Evitamento ostacoli',
  'return_to_home': 'Ritorno automatico',
  'failsafe_system': 'Sistema failsafe',
  
  // Dimensions/Weight
  'dimensions_length_mm': 'Lunghezza',
  'dimensions_width_mm': 'Larghezza',
  'dimensions_height_mm': 'Altezza',
  'weight_total_kg': 'Peso totale',
  'weight_payload_kg': 'Peso carico utile',
  
  // Power System
  'power_system_type': 'Tipo sistema alimentazione',
  'power_consumption_w': 'Consumo energetico',
  'power_efficiency_percent': 'Efficienza energetica',
  
  // Communication
  'communication_protocol': 'Protocollo comunicazione',
  'data_link_range_m': 'Portata collegamento dati',
  'video_transmission_range_m': 'Portata trasmissione video',
  'video_transmission_quality': 'Qualità trasmissione video',
  
  // Vision System
  'vision_system_type': 'Tipo sistema visione',
  'vision_forward_detection_range_m': 'Portata rilevamento anteriore',
  'vision_backward_detection_range_m': 'Portata rilevamento posteriore',
  'vision_lateral_detection_range_m': 'Portata rilevamento laterale',
  'vision_upward_detection_range_m': 'Portata rilevamento superiore',
  'vision_downward_detection_range_m': 'Portata rilevamento inferiore',
  'vision_measurement_range_m': 'Portata misurazione visione',
  'vision_fov_horizontal_deg': 'Campo visivo orizzontale',
  'vision_fov_vertical_deg': 'Campo visivo verticale',
  
  // Gimbal
  'gimbal_mechanical_range_pitch': 'Intervallo meccanico pitch gimbal',
  'gimbal_mechanical_range_roll': 'Intervallo meccanico roll gimbal',
  'gimbal_mechanical_range_yaw': 'Intervallo meccanico yaw gimbal',
  'gimbal_vibration_range_degrees': 'Intervallo vibrazione gimbal',
  
  // Lifting System
  'lifting_system_capacity_kg': 'Capacità sistema sollevamento',
  'lifting_system_capacity_dual_battery_kg': 'Capacità sistema sollevamento doppia batteria',
  'lifting_system_capacity_standard_kg': 'Capacità sistema sollevamento standard',
  'lifting_system_cable_length_m': 'Lunghezza cavo sollevamento',
  'lifting_system_cable_recommended_length_m': 'Lunghezza cavo consigliata',
  'lifting_system_dimensions_standard_mm': 'Dimensioni sistema standard',
  'lifting_system_dimensions_dual_battery_mm': 'Dimensioni sistema doppia batteria',
  
  // MTOW (Maximum Take-Off Weight)
  'mtow': 'Peso massimo al decollo',
  'mtow_lifting': 'Peso massimo al decollo per sollevamento',
  'mtow_lifting_db1580_kg': 'Peso massimo al decollo per sollevamento (DB1580)',
  'mtow_lifting_db2160_kg': 'Peso massimo al decollo per sollevamento (DB2160)',
  'mtow_lifting_dual_battery': 'Peso massimo al decollo per sollevamento (doppia batteria)',
  'mtow_spraying_kg': 'Peso massimo al decollo per irrorazione',
  'mtow_spraying_2_nozzles_kg': 'Peso massimo al decollo per irrorazione (2 ugelli)',
  'mtow_spraying_2_nozzles_db1580_kg': 'Peso massimo al decollo per irrorazione (2 ugelli, DB1580)',
  'mtow_spraying_2_nozzles_db2160_kg': 'Peso massimo al decollo per irrorazione (2 ugelli, DB2160)',
  'mtow_spraying_4_nozzles_kg': 'Peso massimo al decollo per irrorazione (4 ugelli)',
  'mtow_spraying_4_nozzles_db1580_kg': 'Peso massimo al decollo per irrorazione (4 ugelli, DB1580)',
  'mtow_spraying_4_nozzles_db2160_kg': 'Peso massimo al decollo per irrorazione (4 ugelli, DB2160)',
  'mtow_spreading_kg': 'Peso massimo al decollo per spandimento',
  'mtow_spreading_db1580_kg': 'Peso massimo al decollo per spandimento (DB1580)',
  'mtow_spreading_db2160_kg': 'Peso massimo al decollo per spandimento (DB2160)',
};

// Funzione helper per tradurre una chiave
export function translateSpecKey(key: string): string {
  // Se esiste traduzione diretta, usala
  if (specsTranslations[key]) {
    return specsTranslations[key];
  }
  
  // Altrimenti prova a tradurre parti comuni
  const parts = key.split('_');
  const translatedParts: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Salta unità di misura e numeri
    if (['kg', 'l', 'm', 'mm', 'cm', 'km', 'min', 'h', 's', 'ms', 'w', 'v', 'mah', 'mp', 'fps', 'rpm', 'bar', 'db', 'ghz', 'deg', 'inch', 'percent', 'ha'].includes(part.toLowerCase())) {
      continue;
    }
    
    // Traduci parti comuni
    const partTranslations: { [key: string]: string } = {
      'aircraft': 'Velivolo',
      'spray': 'Irrorazione',
      'spreading': 'Spandimento',
      'battery': 'Batteria',
      'radar': 'Radar',
      'generator': 'Generatore',
      'charger': 'Caricatore',
      'motor': 'Motore',
      'propeller': 'Elica',
      'camera': 'Fotocamera',
      'gps': 'GPS',
      'rtk': 'RTK',
      'flight': 'Volo',
      'max': 'Massimo',
      'min': 'Minimo',
      'effective': 'Effettivo',
      'capacity': 'Capacità',
      'weight': 'Peso',
      'dimensions': 'Dimensioni',
      'power': 'Potenza',
      'speed': 'Velocità',
      'range': 'Portata',
      'radius': 'Raggio',
      'altitude': 'Quota',
      'temperature': 'Temperatura',
      'pressure': 'Pressione',
      'flow': 'Portata',
      'rate': 'Velocità',
      'time': 'Tempo',
      'distance': 'Distanza',
      'width': 'Larghezza',
      'height': 'Altezza',
      'length': 'Lunghezza',
      'diameter': 'Diametro',
      'precision': 'Precisione',
      'accuracy': 'Precisione',
      'resistance': 'Resistenza',
      'consumption': 'Consumo',
      'efficiency': 'Efficienza',
      'type': 'Tipo',
      'system': 'Sistema',
      'tank': 'Serbatoio',
      'payload': 'Carico',
      'empty': 'Vuoto',
      'with': 'Con',
      'without': 'Senza',
      'folded': 'Ripiegato',
      'unfolded': 'Dispiegato',
      'operating': 'Operativo',
      'storage': 'Conservazione',
      'material': 'Materiale',
      'count': 'Numero',
      'size': 'Dimensione',
      'enabled': 'Abilitato',
      'disabled': 'Disabilitato',
    };
    
    if (partTranslations[part.toLowerCase()]) {
      translatedParts.push(partTranslations[part.toLowerCase()]);
    } else {
      // Capitalizza la prima lettera se non trovato
      translatedParts.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }
  
  // Se abbiamo traduzioni, uniscile
  if (translatedParts.length > 0) {
    return translatedParts.join(' ');
  }
  
  // Fallback: capitalizza e sostituisci underscore
  return key.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// Funzione per tradurre la sezione
export function translateSection(section: string): string {
  const sectionTranslations: { [key: string]: string } = {
    'aircraft': 'Velivolo',
    'spray_system': 'Sistema Irrorazione',
    'spreading_system': 'Sistema Spandimento',
    'battery': 'Batteria',
    'radar': 'Radar',
    'generator': 'Generatore',
    'charger': 'Caricatore',
    'propulsion': 'Propulsione',
    'camera': 'Fotocamera',
    'sensors': 'Sensori',
    'gps': 'GPS/Navigazione',
    'software': 'Software',
    'safety': 'Sicurezza',
    'performance': 'Prestazioni',
    'dimensions': 'Dimensioni',
    'power': 'Alimentazione',
    'communication': 'Comunicazione',
    'vision': 'Sistema Visione',
    'controller': 'Radiocomando',
  };
  
  return sectionTranslations[section] || section.charAt(0).toUpperCase() + section.slice(1);
}

