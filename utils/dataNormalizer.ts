import { parsePhoneNumberFromString, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

// ============================================
// PHONE NORMALIZATION
// ============================================

/**
 * Normalize a phone number to E.164 format
 * Handles mixed data from Excel:
 * - Moroccan: 212660703622 (starts with 212, no +)
 * - French: 33661934506 (starts with 33, no +)
 * - Local: 061159033 (needs default country)
 * 
 * @param phone - Raw phone number (string or number from Excel)
 * @param defaultCountry - Default country code (e.g., 'FR' for France)
 * @returns E.164 formatted phone number (e.g., +212660703622)
 */
export function normalizePhone(phone: string | number, defaultCountry: CountryCode = 'FR'): string {
  // Step 1: Convert to string and clean
  if (phone === null || phone === undefined) {
    return '';
  }
  
  // Convert to string (handles numbers from Excel)
  let cleaned = String(phone).trim();
  if (!cleaned) {
    return '';
  }

  // Step 2: Remove all non-digit characters except +
  let digits = cleaned.replace(/[^\d+]/g, '');
  
  if (!digits) {
    return '';
  }

  try {
    // Step 3: Apply heuristic rules to add country code prefix
    let normalizedNumber = applyCountryCodeHeuristics(digits);

    // Step 4: Try to parse with libphonenumber-js
    let phoneNumber = parsePhoneNumberFromString(normalizedNumber, defaultCountry);
    
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164');
    }

    // Step 5: Fallback - try with Morocco (MA) as alternative country
    if (defaultCountry !== 'MA') {
      phoneNumber = parsePhoneNumberFromString(normalizedNumber, 'MA');
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.format('E.164');
      }
    }

    // Step 6: Fallback - try with France (FR) if not already tried
    if (defaultCountry !== 'FR') {
      phoneNumber = parsePhoneNumberFromString(normalizedNumber, 'FR');
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.format('E.164');
      }
    }

    // Step 7: If still no valid parse, try local number formats
    // Moroccan local number (0 + 9 digits)
    if (digits.startsWith('0') && digits.length === 10) {
      // Try as Moroccan local number first
      const moroccanNumber = '+212' + digits.substring(1);
      phoneNumber = parsePhoneNumberFromString(moroccanNumber, 'MA');
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.format('E.164');
      }
      
      // Try as French local number
      const frenchNumber = '+33' + digits.substring(1);
      phoneNumber = parsePhoneNumberFromString(frenchNumber, 'FR');
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.format('E.164');
      }
    }

    // Return the best normalized version we have
    return normalizedNumber.startsWith('+') ? normalizedNumber : '+' + normalizedNumber;
  } catch (error) {
    console.warn(`Failed to normalize phone: ${phone}`, error);
    return digits;
  }
}

/**
 * Apply heuristic rules to detect and add country code prefix
 */
function applyCountryCodeHeuristics(digits: string): string {
  // Already has + prefix, keep as is
  if (digits.startsWith('+')) {
    return digits;
  }

  // Rule 1: Starts with '00' -> Replace with '+'
  // Example: 00212660703622 -> +212660703622
  if (digits.startsWith('00')) {
    return '+' + digits.substring(2);
  }

  // Rule 2: Starts with '212' and more than 9 digits -> Moroccan number
  // Example: 212660703622 -> +212660703622
  if (digits.startsWith('212') && digits.length > 9) {
    return '+' + digits;
  }

  // Rule 3: Starts with '33' and more than 9 digits -> French number
  // Example: 33661934506 -> +33661934506
  if (digits.startsWith('33') && digits.length > 9) {
    return '+' + digits;
  }

  // Rule 4: Starts with '0' and exactly 10 digits -> Local number (handled later with country)
  // Example: 0661934506 -> needs country context
  
  // Rule 5: Other country codes that might appear without +
  const countryPrefixes = ['1', '44', '49', '34', '39', '31', '32', '41'];
  for (const prefix of countryPrefixes) {
    if (digits.startsWith(prefix) && digits.length > 9) {
      return '+' + digits;
    }
  }

  // No transformation needed, return as is
  return digits;
}

/**
 * Validate if a phone number is valid
 * Applies the same normalization rules before validation
 */
export function isValidPhone(phone: string | number, defaultCountry: CountryCode = 'FR'): boolean {
  if (!phone) return false;
  
  try {
    // Normalize first, then validate
    const normalized = normalizePhone(phone, defaultCountry);
    if (!normalized) return false;
    
    const phoneNumber = parsePhoneNumberFromString(normalized);
    return phoneNumber ? phoneNumber.isValid() : false;
  } catch {
    return false;
  }
}

/**
 * Format phone for display (national format)
 */
export function formatPhoneDisplay(phone: string | number, defaultCountry: CountryCode = 'FR'): string {
  if (!phone) return '';
  
  try {
    // Normalize first
    const normalized = normalizePhone(phone, defaultCountry);
    if (!normalized) return String(phone);
    
    const phoneNumber = parsePhoneNumberFromString(normalized);
    if (phoneNumber) {
      return phoneNumber.formatNational();
    }
  } catch {
    // Ignore
  }
  
  return String(phone);
}

// ============================================
// DATE NORMALIZATION
// ============================================

/**
 * Supported date formats for parsing
 */
const DATE_FORMATS = [
  // ISO formats
  /^(\d{4})-(\d{2})-(\d{2})$/,                    // 2023-10-15
  /^(\d{4})\/(\d{2})\/(\d{2})$/,                  // 2023/10/15
  // European formats (DD/MM/YYYY)
  /^(\d{2})\/(\d{2})\/(\d{4})$/,                  // 15/10/2023
  /^(\d{2})-(\d{2})-(\d{4})$/,                    // 15-10-2023
  /^(\d{2})\.(\d{2})\.(\d{4})$/,                  // 15.10.2023
  // US formats (MM/DD/YYYY)
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,             // 10/15/2023 or 1/5/2023
  // Short year formats
  /^(\d{2})\/(\d{2})\/(\d{2})$/,                  // 15/10/23
  // Text formats
  /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})$/i,
];

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Normalize a date string to ISO format (YYYY-MM-DD)
 * @param dateStr - Raw date string
 * @param preferDMY - If true, prefer DD/MM/YYYY format; if false, prefer MM/DD/YYYY
 * @returns ISO date string (YYYY-MM-DD) or empty string if invalid
 */
export function normalizeDate(dateStr: string, preferDMY: boolean = true): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return '';
  }

  const cleaned = dateStr.trim();
  if (!cleaned) {
    return '';
  }

  // Try to parse as Date object first (handles Excel date serials)
  if (!isNaN(Number(cleaned))) {
    // Excel serial date (days since 1900-01-01)
    const serial = Number(cleaned);
    if (serial > 1 && serial < 100000) {
      // Excel date serial
      const date = excelSerialToDate(serial);
      return formatDateISO(date);
    }
  }

  // Try ISO format first
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isValidDate(parseInt(year), parseInt(month), parseInt(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try European format (DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY)
  const euroMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (euroMatch) {
    let [, first, second, yearStr] = euroMatch;
    let year = parseInt(yearStr);
    
    // Handle 2-digit year
    if (year < 100) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }

    const firstNum = parseInt(first);
    const secondNum = parseInt(second);

    if (preferDMY) {
      // DD/MM/YYYY
      if (isValidDate(year, secondNum, firstNum)) {
        return formatDateISO(new Date(year, secondNum - 1, firstNum));
      }
    } else {
      // MM/DD/YYYY
      if (isValidDate(year, firstNum, secondNum)) {
        return formatDateISO(new Date(year, firstNum - 1, secondNum));
      }
    }

    // Try the other format if first didn't work
    if (preferDMY && isValidDate(year, firstNum, secondNum)) {
      return formatDateISO(new Date(year, firstNum - 1, secondNum));
    } else if (!preferDMY && isValidDate(year, secondNum, firstNum)) {
      return formatDateISO(new Date(year, secondNum - 1, firstNum));
    }
  }

  // Try text format (e.g., "15 October 2023")
  const textMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textMatch) {
    const [, dayStr, monthStr, yearStr] = textMatch;
    const day = parseInt(dayStr);
    const month = MONTH_NAMES[monthStr.toLowerCase().substring(0, 3)];
    const year = parseInt(yearStr);
    
    if (month && isValidDate(year, month, day)) {
      return formatDateISO(new Date(year, month - 1, day));
    }
  }

  // Try parsing with Date constructor as fallback
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return formatDateISO(date);
    }
  } catch {
    // Ignore
  }

  return '';
}

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelSerialToDate(serial: number): Date {
  // Excel's epoch is January 1, 1900
  // But Excel incorrectly considers 1900 as a leap year, so we subtract 1 for dates after Feb 28, 1900
  const utcDays = Math.floor(serial - 25569); // Days since Unix epoch
  const utcValue = utcDays * 86400 * 1000;
  return new Date(utcValue);
}

/**
 * Format a Date to ISO string (YYYY-MM-DD)
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is valid
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

/**
 * Validate if a date string can be parsed
 */
export function isValidDateString(dateStr: string): boolean {
  return normalizeDate(dateStr) !== '';
}

// ============================================
// EMAIL NORMALIZATION
// ============================================

/**
 * Normalize an email address
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  
  return email.trim().toLowerCase();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// ============================================
// TEXT NORMALIZATION
// ============================================

/**
 * Normalize a text field (trim and clean whitespace)
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
  if (!text) return '';
  
  return normalizeText(text)
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================
// RECORD NORMALIZER
// ============================================

export interface NormalizationConfig {
  phone?: {
    field: string;
    defaultCountry?: CountryCode;
  };
  date?: {
    fields: string[];
    preferDMY?: boolean;
  };
  email?: {
    field: string;
  };
  name?: {
    field: string;
    capitalize?: boolean;
  };
}

/**
 * Normalize a full record based on configuration
 */
export function normalizeRecord(
  record: Record<string, any>,
  config: NormalizationConfig
): Record<string, any> {
  const normalized = { ...record };

  // Normalize phone
  if (config.phone && record[config.phone.field]) {
    normalized[config.phone.field] = normalizePhone(
      record[config.phone.field],
      config.phone.defaultCountry || 'FR'
    );
  }

  // Normalize dates
  if (config.date?.fields) {
    for (const field of config.date.fields) {
      if (record[field]) {
        normalized[field] = normalizeDate(record[field], config.date.preferDMY ?? true);
      }
    }
  }

  // Normalize email
  if (config.email && record[config.email.field]) {
    normalized[config.email.field] = normalizeEmail(record[config.email.field]);
  }

  // Normalize name
  if (config.name && record[config.name.field]) {
    normalized[config.name.field] = config.name.capitalize
      ? capitalizeWords(record[config.name.field])
      : normalizeText(record[config.name.field]);
  }

  return normalized;
}
