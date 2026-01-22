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

export interface ImportState {
  step: ImportStep;
  file: File | null;
  parsedData: ParsedData | null;
  mappings: ColumnMapping[];
  validationResult: ValidationResult | null;
  importResult: ImportResult | null;
  isLoading: boolean;
  error: string | null;
}

// Database fields configuration
export const DB_FIELDS: MappingField[] = [
  { dbField: 'name', label: 'Full Name', required: false, confidence: 'None' },
  { dbField: 'email', label: 'Email Address', required: false, confidence: 'None' },
  { dbField: 'phone', label: 'Phone Number', required: true, confidence: 'None' },
  { dbField: 'vehicle', label: 'Vehicle Model', required: false, confidence: 'None' },
  { dbField: 'vehicle_year', label: 'Vehicle Year', required: false, confidence: 'None' },
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
                case 'vehicle':
                  client.vehicle = normalizeText(strValue);
                  break;
                case 'vehicle_year':
                  const year = parseInt(strValue);
                  if (!isNaN(year) && year >= 1900 && year <= new Date().getFullYear() + 1) {
                    client.vehicle_year = year;
                  }
                  break;
                case 'region':
                  client.region = normalizeText(strValue);
                  break;
                case 'center_name':
                  client.center_name = normalizeText(strValue);
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

          clientsToInsert.push(client);
        } catch (error) {
          failed++;
          errors.push(error instanceof Error ? error.message : `Row ${i + 2}: Unknown error`);
        }
      }

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
            // If due_date is within reminder window, send appropriate reminder immediately
            const remindersToInsert = [];
            const remindersToUpdate: Array<{ client_id: string; sent_at: string; status: string; current_step: number }> = [];
            
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
              // This applies to both future dates and overdue dates within the window
              let initialStatus: 'New' | 'Reminder1_sent' | 'Reminder2_sent' | 'Reminder3_sent' | 'To_be_called' = 'New';
              let currentStep = 0;
              let shouldSendNow = false;
              
              // If due_date is within 30 days (past or future), determine which reminder to send
              // Logic: J-30 to J-15 window applies to both future and overdue dates
              // For overdue: if within 30 days after due date, still in Reminder1 window
              if (daysUntilDue <= 30) {
                // J-30 to J-15: First reminder
                // This includes: future dates (15 < days <= 30) and overdue dates (if still within 30 days window)
                if (daysUntilDue > 15 || (daysUntilDue <= 0 && daysUntilDue >= -30)) {
                  // Future: J-30 to J-15, or Overdue: within 30 days after due date
                  initialStatus = 'Reminder1_sent';
                  currentStep = 1;
                  shouldSendNow = true;
                } else if (daysUntilDue > 7) {
                  // J-15 to J-7: Second reminder
                  initialStatus = 'Reminder2_sent';
                  currentStep = 2;
                  shouldSendNow = true;
                } else if (daysUntilDue > 3) {
                  // J-7 to J-3: Third reminder
                  initialStatus = 'Reminder3_sent';
                  currentStep = 3;
                  shouldSendNow = true;
                } else {
                  // J-3 or less: Call required (or overdue beyond 30 days)
                  initialStatus = 'To_be_called';
                  currentStep = 4;
                  shouldSendNow = false; // No WhatsApp, just mark for call
                }
              }
              
              // Create reminder record
              const reminderData = {
                client_id: client.id,
                due_date: dueDate,
                reminder_date: reminderDateStr,
                status: initialStatus,
                message_template: 'rappel_visite_technique_vf',
                current_step: currentStep,
                call_required: initialStatus === 'To_be_called',
              };
              
              remindersToInsert.push(reminderData);
              
              // If we need to send WhatsApp immediately, send it
              if (shouldSendNow && client.phone) {
                try {
                  // Format due date for message
                  const formattedDueDate = dueDateObj.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                  
                  // Send WhatsApp message
                  const whatsappResult = await sendRappelVisiteTechnique({
                    to: client.phone,
                    clientName: client.name || 'Client',
                    vehicleName: client.vehicle || 'Votre véhicule',
                    dateEcheance: formattedDueDate,
                  });
                  
                  if (whatsappResult.success) {
                    console.log(`✅ WhatsApp sent immediately for client ${client.id} (${initialStatus}, due in ${daysUntilDue} days)`);
                    // Store for update after reminder insertion
                    remindersToUpdate.push({
                      client_id: client.id,
                      sent_at: new Date().toISOString(),
                      status: initialStatus,
                      current_step: currentStep,
                    });
                  } else {
                    console.warn(`⚠️ Failed to send WhatsApp for client ${client.id}:`, whatsappResult.error);
                    // If send fails, change status back to 'New' so cron can retry
                    reminderData.status = 'New';
                    reminderData.current_step = 0;
                    reminderData.call_required = false;
                  }
                } catch (error) {
                  console.error(`❌ Error sending WhatsApp for client ${client.id}:`, error);
                  // If error, change status back to 'New'
                  reminderData.status = 'New';
                  reminderData.current_step = 0;
                  reminderData.call_required = false;
                }
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
              } else if (insertedReminders && remindersToUpdate.length > 0) {
                // Update reminders that had WhatsApp sent immediately
                for (const update of remindersToUpdate) {
                  const reminder = insertedReminders.find(r => r.client_id === update.client_id);
                  if (reminder) {
                    await (supabase
                      .from('reminders') as any)
                      .update({
                        sent_at: update.sent_at,
                        status: update.status,
                        current_step: update.current_step,
                      })
                      .eq('id', reminder.id);
                  }
                }
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
      isLoading: false,
      error: null,
    });
  }, []);

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
    vehicle: ['vehicle', 'car', 'voiture', 'model', 'modèle', 'marque', 'brand', 'auto'],
    vehicle_year: ['year', 'année', 'annee', 'model year'],
    last_visit: ['visit', 'date', 'last', 'dernier', 'visite', 'appointment', 'rdv', 'passage'],
    region: ['region', 'région', 'area', 'zone', 'sector', 'location', 'city', 'ville'],
    center_name: ['center', 'centre', 'visite', 'agence', 'point', 'garage', 'atelier', 'site', 'location'],
  };

  return keywordMap[dbField] || [dbField];
}

export default useImportProcess;
