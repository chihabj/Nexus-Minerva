import { useState, useCallback } from 'react';
import { parseExcelFile, ParsedData, getSampleValue } from '../utils/excelParser';
import { 
  normalizePhone, 
  normalizeDate, 
  normalizeEmail, 
  normalizeText,
  capitalizeWords,
  isValidPhone,
  isValidEmail,
  isValidDateString
} from '../utils/dataNormalizer';
import { supabase } from '../services/supabaseClient';
import { sendRappelVisiteTechnique } from '../services/whatsapp';
import { MappingField, MappingConfidence } from '../types';
import { matchCenter, loadCenters, invalidateCentersCache } from '../utils/centerMatcher';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Formate une date pour l'affichage dans le message WhatsApp (format DD/MM/YYYY)
 */
function formatDateForMessage(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr || 'N/A';
  }
}

/**
 * Parse le véhicule pour extraire la marque et le modèle
 * Format attendu: "Marque Modèle" ou "Marque Modèle Année"
 */
function parseVehicle(vehicle: string | null): { marque: string; modele: string } {
  if (!vehicle) return { marque: 'N/A', modele: 'N/A' };
  
  const parts = vehicle.trim().split(/\s+/);
  if (parts.length === 0) return { marque: 'N/A', modele: 'N/A' };
  if (parts.length === 1) return { marque: parts[0], modele: 'N/A' };
  
  // La première partie est généralement la marque
  const marque = parts[0];
  // Le reste est le modèle (peut inclure l'année, mais on prend tout sauf la dernière partie si c'est un nombre)
  const modele = parts.slice(1).join(' ');
  
  return { marque, modele };
}

// ============================================
// TYPES
// ============================================

export type ImportStep = 'upload' | 'mapping' | 'validation' | 'importing' | 'complete';

export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
  confidence: MappingConfidence;
}

export interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  validRecords: number;
  invalidRecords: number;
}

export interface ImportResult {
  success: boolean;
  inserted: number;
  failed: number;
  errors: string[];
}

export interface ClientForReminder {
  client_id: string;
  reminder_id: string;
  name: string;
  phone: string;
  vehicle: string | null;
  due_date: string;
  daysUntilDue: number;
  initialStatus: 'Reminder1_sent' | 'Reminder2_sent' | 'Reminder3_sent';
  currentStep: number;
}

export interface ImportState {
  step: ImportStep;
  file: File | null;
  parsedData: ParsedData | null;
  mappings: ColumnMapping[];
  validationResult: ValidationResult | null;
  importResult: ImportResult | null;
  clientsForReminder: ClientForReminder[];
  isLoading: boolean;
  error: string | null;
}

// Database fields configuration
export const DB_FIELDS: MappingField[] = [
  { dbField: 'name', label: 'Full Name', required: false, confidence: 'None' },
  { dbField: 'email', label: 'Email Address', required: false, confidence: 'None' },
  { dbField: 'phone', label: 'Phone Number', required: true, confidence: 'None' },
  { dbField: 'marque', label: 'Marque', required: false, confidence: 'None' },
  { dbField: 'modele', label: 'Modèle', required: false, confidence: 'None' },
  { dbField: 'vehicle', label: 'Véhicule (Marque + Modèle)', required: false, confidence: 'None' },
  { dbField: 'vehicle_year', label: 'Vehicle Year', required: false, confidence: 'None' },
  { dbField: 'immatriculation', label: 'Immatriculation', required: false, confidence: 'None' },
  { dbField: 'vin', label: 'VIN (Châssis)', required: false, confidence: 'None' },
  { dbField: 'last_visit', label: 'Last Visit Date', required: true, confidence: 'None' },
  { dbField: 'region', label: 'Region', required: false, confidence: 'None' },
  { dbField: 'center_name', label: 'Centre de visite', required: true, confidence: 'None' },
];

// ============================================
// HOOK
// ============================================

export function useImportProcess() {
  const [state, setState] = useState<ImportState>({
    step: 'upload',
    file: null,
    parsedData: null,
    mappings: [],
    validationResult: null,
    importResult: null,
    clientsForReminder: [],
    isLoading: false,
    error: null,
  });

  // ==========================================
  // STEP 1: PARSING
  // ==========================================

  const parseFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const parsedData = await parseExcelFile(file);

      if (parsedData.rows.length === 0) {
        throw new Error('The file contains no data rows');
      }

      // Initialize mappings with empty values
      const initialMappings: ColumnMapping[] = DB_FIELDS.map(field => ({
        csvColumn: '',
        dbField: field.dbField,
        confidence: 'None' as MappingConfidence,
      }));

      setState(prev => ({
        ...prev,
        step: 'mapping',
        file,
        parsedData,
        mappings: initialMappings,
        isLoading: false,
      }));

      return parsedData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse file';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  // ==========================================
  // STEP 2: MAPPING
  // ==========================================

  const updateMapping = useCallback((dbField: string, csvColumn: string, confidence: MappingConfidence = 'None') => {
    setState(prev => ({
      ...prev,
      mappings: prev.mappings.map(m =>
        m.dbField === dbField
          ? { ...m, csvColumn, confidence }
          : m
      ),
    }));
  }, []);

  const setMappings = useCallback((mappings: ColumnMapping[]) => {
    setState(prev => ({ ...prev, mappings }));
  }, []);

  const autoMatchColumns = useCallback(async () => {
    if (!state.parsedData) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const headers = state.parsedData.headers;
      const newMappings: ColumnMapping[] = [];

      for (const field of DB_FIELDS) {
        let bestMatch = '';
        let confidence: MappingConfidence = 'None';

        // Simple keyword matching
        const fieldKeywords = getFieldKeywords(field.dbField);

        for (const header of headers) {
          const headerLower = header.toLowerCase();
          
          // Check for exact or partial matches
          for (const keyword of fieldKeywords) {
            if (headerLower.includes(keyword)) {
              bestMatch = header;
              // Determine confidence based on match quality
              if (headerLower === keyword || headerLower.includes(field.dbField)) {
                confidence = 'High';
              } else {
                confidence = 'Low';
              }
              break;
            }
          }

          if (confidence === 'High') break;
        }

        newMappings.push({
          dbField: field.dbField,
          csvColumn: bestMatch,
          confidence,
        });
      }

      setState(prev => ({
        ...prev,
        mappings: newMappings,
        isLoading: false,
      }));

      return newMappings;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [state.parsedData]);

  // ==========================================
  // STEP 3: VALIDATION
  // ==========================================

  const validateData = useCallback(async () => {
    if (!state.parsedData || state.mappings.length === 0) {
      throw new Error('No data to validate');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];
      let validRecords = 0;
      let invalidRecords = 0;

      const { rows } = state.parsedData;
      const mappingMap = new Map(state.mappings.map(m => [m.dbField, m.csvColumn]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed
        let rowValid = true;

        // Validate required fields
        for (const field of DB_FIELDS) {
          const csvColumn = mappingMap.get(field.dbField);
          const value = csvColumn ? row[csvColumn] : '';

          // Check required fields
          if (field.required && (!value || String(value).trim() === '')) {
            errors.push({
              row: rowNum,
              field: field.label,
              value: '',
              message: `${field.label} is required`,
            });
            rowValid = false;
          }

          // Validate specific field formats
          if (value && String(value).trim() !== '') {
            const strValue = String(value).trim();

            switch (field.dbField) {
              case 'email':
                if (!isValidEmail(strValue)) {
                  errors.push({
                    row: rowNum,
                    field: field.label,
                    value: strValue,
                    message: 'Invalid email format',
                  });
                  rowValid = false;
                }
                break;

              case 'phone':
                if (!isValidPhone(strValue, 'FR')) {
                  warnings.push({
                    row: rowNum,
                    field: field.label,
                    value: strValue,
                    message: 'Phone number may be invalid or will be normalized',
                  });
                }
                break;

              case 'last_visit':
                if (!isValidDateString(strValue)) {
                  warnings.push({
                    row: rowNum,
                    field: field.label,
                    value: strValue,
                    message: 'Date format may not be recognized',
                  });
                }
                break;

              case 'vehicle_year':
                const year = parseInt(strValue);
                if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
                  warnings.push({
                    row: rowNum,
                    field: field.label,
                    value: strValue,
                    message: 'Invalid vehicle year',
                  });
                }
                break;
            }
          }
        }

        if (rowValid) {
          validRecords++;
        } else {
          invalidRecords++;
        }
      }

      const validationResult: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
        validRecords,
        invalidRecords,
      };

      setState(prev => ({
        ...prev,
        step: 'validation',
        validationResult,
        isLoading: false,
      }));

      return validationResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, [state.parsedData, state.mappings]);

  // ==========================================
  // STEP 4: UPLOAD TO SUPABASE
  // ==========================================

  const uploadToSupabase = useCallback(async () => {
    if (!state.parsedData || state.mappings.length === 0) {
      throw new Error('No data to upload');
    }

    setState(prev => ({ ...prev, step: 'importing', isLoading: true, error: null }));

    try {
      // Précharger les centres dans le cache pour le matching
      console.log('📋 Chargement des centres pour le matching...');
      await loadCenters(true); // Force reload pour avoir les données fraîches
      
      const { rows } = state.parsedData;
      const mappingMap = new Map(state.mappings.map(m => [m.dbField, m.csvColumn]));

      const clientsToInsert: any[] = [];
      const errors: string[] = [];
      let inserted = 0;
      let failed = 0;

      // Transform and normalize data
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          const client: any = {
            // Status will default to 'New' in database if not provided
            // Explicitly set it to ensure consistency
            status: 'New' as const,
          };

          // Map each field
          for (const field of DB_FIELDS) {
            const csvColumn = mappingMap.get(field.dbField);
            let value = csvColumn ? row[csvColumn] : null;

            if (value !== null && value !== undefined && String(value).trim() !== '') {
              const strValue = String(value).trim();

              // Normalize based on field type
              switch (field.dbField) {
                case 'name':
                  client.name = capitalizeWords(strValue);
                  break;
                case 'email':
                  client.email = normalizeEmail(strValue);
                  break;
                case 'phone':
                  client.phone = normalizePhone(strValue, 'FR');
                  break;
                case 'last_visit':
                  const normalizedDate = normalizeDate(strValue);
                  if (normalizedDate) {
                    client.last_visit = normalizedDate;
                  }
                  break;
                case 'marque':
                  client.marque = normalizeText(strValue);
                  break;
                case 'modele':
                  client.modele = normalizeText(strValue);
                  break;
                case 'vehicle':
                  client.vehicle = normalizeText(strValue);
                  break;
                case 'vehicle_year':
                  const year = parseInt(strValue);
                  if (!isNaN(year) && year >= 1900 && year <= new Date().getFullYear() + 1) {
                    client.vehicle_year = year;
                  }
                  break;
                case 'immatriculation':
                  // Normaliser l'immatriculation (majuscules, format standard)
                  client.immatriculation = strValue.toUpperCase().replace(/\s+/g, '-').trim();
                  break;
                case 'vin':
                  // VIN en majuscules (17 caractères standard)
                  client.vin = strValue.toUpperCase().replace(/\s+/g, '').trim();
                  break;
                case 'region':
                  client.region = normalizeText(strValue);
                  break;
                case 'center_name':
                  // Stocker temporairement le nom brut, sera matché après
                  client.center_name = normalizeText(strValue);
                  client._raw_center_name = strValue; // Pour le matching ultérieur
                  break;
              }
            }
          }

          // Validate required fields (phone, last_visit, center_name)
          if (!client.phone) {
            throw new Error(`Row ${i + 2}: Phone number is required`);
          }
          if (!client.last_visit) {
            throw new Error(`Row ${i + 2}: Last visit date is required`);
          }
          if (!client.center_name) {
            throw new Error(`Row ${i + 2}: Centre de visite is required`);
          }

          // If name is empty/missing, use phone number as default name
          if (!client.name || client.name.trim() === '') {
            client.name = client.phone;
          }

          // Matcher le centre avec la base de données
          if (client._raw_center_name || client.center_name) {
            const centerMatch = await matchCenter(client._raw_center_name || client.center_name);
            if (centerMatch) {
              client.center_id = centerMatch.center_id;
              client.center_name = centerMatch.center_name; // Utilise le nom normalisé de la base
              console.log(`🔗 Centre matché: "${client._raw_center_name}" → "${centerMatch.center_name}" (${centerMatch.confidence})`);
            }
          }
          // Supprimer le champ temporaire avant l'insertion
          delete client._raw_center_name;

          clientsToInsert.push(client);
        } catch (error) {
          failed++;
          errors.push(error instanceof Error ? error.message : `Row ${i + 2}: Unknown error`);
        }
      }

      // Accumulate clients for reminder across all batches
      const allClientsForReminder: ClientForReminder[] = [];
      
      // Batch insert to Supabase
      if (clientsToInsert.length > 0) {
        // Insert in batches of 100
        const batchSize = 100;
        
        for (let i = 0; i < clientsToInsert.length; i += batchSize) {
          const batch = clientsToInsert.slice(i, i + batchSize);
          
          const { data: insertedClients, error } = await supabase
            .from('clients')
            .insert(batch)
            .select();

          if (error) {
            failed += batch.length;
            errors.push(`Batch insert error: ${error.message}`);
          } else if (insertedClients && insertedClients.length > 0) {
            inserted += insertedClients.length;
            
            // Create reminders for each inserted client (2-year rule)
            // If due_date is within 30 days, store for confirmation screen instead of sending immediately
            const remindersToInsert = [];
            const batchClientsForReminder: ClientForReminder[] = [];
            
            for (const client of insertedClients) {
              const lastVisit = new Date(client.last_visit);
              
              // Calculate next visit = last_visit + 2 years
              const nextVisit = new Date(lastVisit);
              nextVisit.setFullYear(nextVisit.getFullYear() + 2);
              
              // due_date = next_visit (date limite de visite technique)
              const dueDate = nextVisit.toISOString().split('T')[0];
              
              // reminder_date = due_date - 30 days (date d'envoi de la relance)
              const reminderDate = new Date(nextVisit);
              reminderDate.setDate(reminderDate.getDate() - 30);
              const reminderDateStr = reminderDate.toISOString().split('T')[0];
              
              // Check if due_date is within the reminder window
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dueDateObj = new Date(dueDate);
              dueDateObj.setHours(0, 0, 0, 0);
              const daysUntilDue = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              // Determine which reminder step to send based on days until due
              // Logic: 
              // - J-30 to J-15: Send Reminder1 (first reminder)
              // - J-15 to J-7: Send Reminder2 (second reminder)  
              // - J-7 to J-3: Send Reminder3 (third reminder)
              // - J-3 or less: Mark as To_be_called (call required)
              let initialStatus: 'New' | 'Reminder1_sent' | 'Reminder2_sent' | 'Reminder3_sent' | 'To_be_called' = 'New';
              let currentStep = 0;
              let needsReminder = false;
              
              // If due_date is within 30 days (past or future), determine which reminder to send
              if (daysUntilDue <= 30) {
                // J-30 to J-15: First reminder
                if (daysUntilDue > 15 || (daysUntilDue <= 0 && daysUntilDue >= -30)) {
                  initialStatus = 'Reminder1_sent';
                  currentStep = 1;
                  needsReminder = true;
                } else if (daysUntilDue > 7) {
                  // J-15 to J-7: Second reminder
                  initialStatus = 'Reminder2_sent';
                  currentStep = 2;
                  needsReminder = true;
                } else if (daysUntilDue > 3) {
                  // J-7 to J-3: Third reminder
                  initialStatus = 'Reminder3_sent';
                  currentStep = 3;
                  needsReminder = true;
                } else {
                  // J-3 or less: Call required (or overdue beyond 30 days)
                  initialStatus = 'To_be_called';
                  currentStep = 4;
                  needsReminder = false;
                }
              }
              
              // Create reminder record with 'Pending' status initially if needs reminder (will be updated after confirmation)
              // Using 'Pending' instead of 'New' to prevent cron job from processing immediately
              const reminderData = {
                client_id: client.id,
                due_date: dueDate,
                reminder_date: reminderDateStr,
                status: needsReminder ? 'Pending' : initialStatus, // Use 'Pending' to prevent cron from processing
                message_template: 'rappel_visite_technique_vf',
                current_step: needsReminder ? 0 : currentStep,
                call_required: initialStatus === 'To_be_called',
              };
              
              remindersToInsert.push(reminderData);
              
              // Store client for reminder confirmation screen if within 30 days window
              if (needsReminder && client.phone) {
                batchClientsForReminder.push({
                  client_id: client.id,
                  reminder_id: '', // Will be set after reminder insertion
                  name: client.name || client.phone,
                  phone: client.phone,
                  vehicle: client.vehicle || null,
                  due_date: dueDate,
                  daysUntilDue,
                  initialStatus: initialStatus as 'Reminder1_sent' | 'Reminder2_sent' | 'Reminder3_sent',
                  currentStep,
                });
              }
            }
            
            // Insert reminders
            if (remindersToInsert.length > 0) {
              const { data: insertedReminders, error: reminderError } = await supabase
                .from('reminders')
                .insert(remindersToInsert)
                .select();
              
              if (reminderError) {
                console.warn('Failed to create reminders:', reminderError.message);
                // Don't fail the whole import for reminder creation errors
              } else if (insertedReminders && batchClientsForReminder.length > 0) {
                // Update reminder_id in batchClientsForReminder
                for (const clientForReminder of batchClientsForReminder) {
                  const reminder = insertedReminders.find(r => r.client_id === clientForReminder.client_id);
                  if (reminder) {
                    clientForReminder.reminder_id = reminder.id;
                  }
                }
                // Accumulate into allClientsForReminder
                allClientsForReminder.push(...batchClientsForReminder);
              }
            }
          }
        }
      }

      const importResult: ImportResult = {
        success: failed === 0,
        inserted,
        failed,
        errors,
      };

      setState(prev => ({
        ...prev,
        step: 'complete',
        importResult,
        clientsForReminder: allClientsForReminder,
        isLoading: false,
      }));

      return importResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: message,
        importResult: {
          success: false,
          inserted: 0,
          failed: state.parsedData?.rows.length || 0,
          errors: [message],
        }
      }));
      throw error;
    }
  }, [state.parsedData, state.mappings]);

  // ==========================================
  // NAVIGATION & UTILITIES
  // ==========================================

  const goToStep = useCallback((step: ImportStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 'upload',
      file: null,
      parsedData: null,
      mappings: [],
      validationResult: null,
      importResult: null,
      clientsForReminder: [],
      isLoading: false,
      error: null,
    });
  }, []);

  // ==========================================
  // SEND REMINDERS IN BATCH
  // ==========================================

  const sendRemindersBatch = useCallback(async (clientIds: string[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const clientsToSend = state.clientsForReminder.filter(c => clientIds.includes(c.client_id));
      const remindersToUpdate: Array<{ reminder_id: string; sent_at: string; status: string; current_step: number }> = [];
      let successCount = 0;
      let failCount = 0;

      for (const client of clientsToSend) {
        try {
          // Récupérer les informations complètes du client depuis la base de données
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id, name, phone, vehicle, vehicle_year, marque, modele, immatriculation, last_visit, center_name, center_id')
            .eq('id', client.client_id)
            .single();

          if (clientError || !clientData) {
            console.error(`❌ Error fetching client ${client.client_id}:`, clientError);
            failCount++;
            continue;
          }

          // Récupérer les informations du centre technique
          let techCenter: { name: string; phone: string | null; short_url: string | null; network: string | null; template_name: string | null } | null = null;
          
          if (clientData.center_name || clientData.center_id) {
            const centerQuery = clientData.center_id 
              ? supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('id', clientData.center_id).single()
              : supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('name', clientData.center_name).single();
            
            const { data: centerData, error: centerError } = await centerQuery;
            
            if (!centerError && centerData) {
              techCenter = centerData;
            }
          }

          // Valeurs par défaut si le centre n'est pas trouvé
          const nomCentre = techCenter?.name || clientData.center_name || 'Notre centre';
          const typeCentre = techCenter?.network || 'AUTOSUR'; // Valeur par défaut
          const shortUrlRendezVous = techCenter?.short_url || '';
          const numeroAppelCentre = techCenter?.phone || '';
          const templateName = techCenter?.template_name || undefined; // Utilise le template du centre ou le défaut

          // Préparer les variables du template simplifié (2 variables)
          // Combiner le nom du centre avec le réseau: "Bourg-la-Reine - Autosur"
          const centreComplet = typeCentre ? `${nomCentre} - ${typeCentre}` : nomCentre;
          const dateProchVis = formatDateForMessage(client.due_date);
          
          // Send WhatsApp message avec le template du centre
          console.log(`📤 Envoi avec template: ${templateName || 'rappel_visite_technique_vf (défaut)'}`);
          const whatsappResult = await sendRappelVisiteTechnique({
            to: client.phone,
            templateName,
            nomCentre: centreComplet,
            dateProchVis,
            shortUrlRendezVous,
            numeroAppelCentre,
          });
          
          if (whatsappResult.success) {
            successCount++;
            const sentAt = new Date().toISOString();
            
            remindersToUpdate.push({
              reminder_id: client.reminder_id,
              sent_at: sentAt,
              status: client.initialStatus,
              current_step: client.currentStep,
            });

            // Créer ou récupérer la conversation pour ce client
            try {
              // Vérifier si une conversation existe déjà pour ce client
              const { data: existingConv } = await supabase
                .from('conversations')
                .select('id')
                .eq('client_id', client.client_id)
                .single();

              let conversationId: string;

              if (existingConv) {
                conversationId = existingConv.id;
                // Mettre à jour la conversation existante
                await supabase
                  .from('conversations')
                  .update({
                    last_message: `[Relance automatique] Template: ${templateName || 'rappel_visite_technique_vf'}`,
                    last_message_at: sentAt,
                    status: 'open',
                  })
                  .eq('id', conversationId);
              } else {
                // Créer une nouvelle conversation
                const { data: newConv, error: convError } = await supabase
                  .from('conversations')
                  .insert({
                    client_id: client.client_id,
                    client_phone: client.phone,
                    client_name: clientData.name,
                    last_message: `[Relance automatique] Template: ${templateName || 'rappel_visite_technique_vf'}`,
                    last_message_at: sentAt,
                    unread_count: 0,
                    status: 'open',
                  })
                  .select('id')
                  .single();

                if (convError || !newConv) {
                  console.error('❌ Erreur création conversation:', convError);
                } else {
                  conversationId = newConv.id;
                }
              }

              // Créer le message outbound dans la conversation
              if (conversationId!) {
                const messageContent = `Madame, Monsieur,\n• Le ${datePrecedentVisite}, nous avons eu le plaisir de contrôler, dans notre centre ${nomCentre}, votre véhicule ${marque} ${modele}, immatriculé ${immat}.\n• La validité de ce contrôle technique arrivant bientôt à échéance, le prochain devra s'effectuer avant le : ${dateProchVis}.\n• N'hésitez pas à prendre rendez-vous en ligne ou par téléphone.`;
                
                await supabase
                  .from('messages')
                  .insert({
                    conversation_id: conversationId,
                    wa_message_id: whatsappResult.messageId || null,
                    from_phone: '33767668396', // Numéro d'envoi WhatsApp Business
                    to_phone: client.phone,
                    direction: 'outbound',
                    message_type: 'template',
                    content: messageContent,
                    template_name: templateName || 'rappel_visite_technique_vf',
                    status: 'sent',
                  });
              }
            } catch (convError) {
              console.error('❌ Erreur création conversation/message:', convError);
              // On ne fail pas l'envoi si la création de conversation échoue
            }
          } else {
            failCount++;
            console.warn(`⚠️ Failed to send WhatsApp for client ${client.client_id}:`, whatsappResult.error);
          }
        } catch (error) {
          failCount++;
          console.error(`❌ Error sending WhatsApp for client ${client.client_id}:`, error);
        }
      }

      // Update reminders that had WhatsApp sent successfully
      if (remindersToUpdate.length > 0) {
        for (const update of remindersToUpdate) {
          await supabase
            .from('reminders')
            .update({
              sent_at: update.sent_at,
              status: update.status,
              current_step: update.current_step,
            })
            .eq('id', update.reminder_id);
        }
      }

      // Update remaining clients that weren't sent - set their status based on daysUntilDue
      const clientsNotSent = state.clientsForReminder.filter(c => 
        clientIds.includes(c.client_id) && 
        !remindersToUpdate.find(u => u.reminder_id === c.reminder_id)
      );

      for (const client of clientsNotSent) {
        let finalStatus: 'New' | 'To_be_called' = 'New';
        let finalStep = 0;
        if (client.daysUntilDue <= 3) {
          finalStatus = 'To_be_called';
          finalStep = 4;
        }
        
        await supabase
          .from('reminders')
          .update({
            status: finalStatus,
            current_step: finalStep,
            call_required: finalStatus === 'To_be_called',
          })
          .eq('id', client.reminder_id);
      }

      setState(prev => ({
        ...prev,
        clientsForReminder: prev.clientsForReminder.filter(c => !clientIds.includes(c.client_id)),
        isLoading: false,
      }));

      return { successCount, failCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reminders';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, [state.clientsForReminder]);

  const skipReminders = useCallback(async (clientIds: string[]) => {
    // Update reminders to set their status to 'Pending' so they appear in the TodoList
    // unless daysUntilDue <= 3, then set to 'To_be_called'
    const clientsToSkip = state.clientsForReminder.filter(c => clientIds.includes(c.client_id));

    for (const client of clientsToSkip) {
      let finalStatus: 'Pending' | 'To_be_called' = 'Pending';
      let finalStep = 0;
      
      if (client.daysUntilDue <= 3) {
        // Urgent: needs call immediately
        finalStatus = 'To_be_called';
        finalStep = 4;
      }
      // Otherwise: keep as 'Pending' so agents can send manually from TodoList
      
      await supabase
        .from('reminders')
        .update({
          status: finalStatus,
          current_step: finalStep,
          call_required: finalStatus === 'To_be_called',
        })
        .eq('id', client.reminder_id);
    }

    setState(prev => ({
      ...prev,
      clientsForReminder: prev.clientsForReminder.filter(c => !clientIds.includes(c.client_id)),
    }));
  }, [state.clientsForReminder]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const getSampleValueForColumn = useCallback((csvColumn: string) => {
    if (!state.parsedData || !csvColumn) return '';
    return getSampleValue(state.parsedData, csvColumn);
  }, [state.parsedData]);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    // State
    ...state,
    
    // Step 1: Parsing
    parseFile,
    
    // Step 2: Mapping
    updateMapping,
    setMappings,
    autoMatchColumns,
    
    // Step 3: Validation
    validateData,
    
    // Step 4: Upload
    uploadToSupabase,
    
    // Reminder confirmation
    sendRemindersBatch,
    skipReminders,
    
    // Utilities
    goToStep,
    reset,
    clearError,
    getSampleValueForColumn,
    
    // Constants
    dbFields: DB_FIELDS,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getFieldKeywords(dbField: string): string[] {
  const keywordMap: Record<string, string[]> = {
    name: ['name', 'nom', 'full name', 'client', 'customer', 'prénom', 'firstname', 'lastname'],
    email: ['email', 'mail', 'e-mail', 'courriel', 'address'],
    phone: ['phone', 'mobile', 'tel', 'telephone', 'téléphone', 'cell', 'number', 'numéro', 'gsm'],
    marque: ['marque', 'brand', 'make', 'constructeur', 'fabricant'],
    modele: ['modele', 'modèle', 'model', 'type', 'version'],
    vehicle: ['vehicle', 'car', 'voiture', 'véhicule', 'auto'],
    vehicle_year: ['year', 'année', 'annee', 'model year', 'mise en circulation'],
    immatriculation: ['immat', 'immatriculation', 'plaque', 'plate', 'license', 'registration', 'reg'],
    vin: ['vin', 'chassis', 'châssis', 'serie', 'série', 'vehicle identification', 'numéro série'],
    last_visit: ['visit', 'date', 'last', 'dernier', 'visite', 'appointment', 'rdv', 'passage', 'controle', 'contrôle'],
    region: ['region', 'région', 'area', 'zone', 'sector', 'location', 'city', 'ville'],
    center_name: ['center', 'centre', 'visite', 'agence', 'point', 'garage', 'atelier', 'site', 'location'],
  };

  return keywordMap[dbField] || [dbField];
}

export default useImportProcess;
