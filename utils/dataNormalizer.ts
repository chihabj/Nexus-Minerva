import { parsePhoneNumberFromString, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

// ============================================
// PHONE NORMALIZATION
// ============================================

/**
 * Normalize a phone number to E.164 format
 * @param phone - Raw phone number string
 * @param defaultCountry - Default country code (e.g., 'FR' for France)
 * @returns E.164 formatted phone number (e.g., +33612345678) or original if invalid
 */
export function normalizePhone(phone: string, defaultCountry: CountryCode = 'FR'): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Clean the input
  const cleaned = phone.trim();
  if (!cleaned) {
    return '';
  }

  try {
    // Try to parse the phone number
    const phoneNumber = parsePhoneNumberFromString(cleaned, defaultCountry);
    
    if (phoneNumber && phoneNumber.isValid()) {
      // Return E.164 format
      return phoneNumber.format('E.164');
    }

    // If parsing failed, try with different approaches
    // Remove all non-digit characters except +
    const digitsOnly = cleaned.replace(/[^\d+]/g, '');
    
    // If starts with country code, try parsing directly
    if (digitsOnly.startsWith('+')) {
      const retryPhone = parsePhoneNumberFromString(digitsOnly);
      if (retryPhone && retryPhone.isValid()) {
        return retryPhone.format('E.164');
      }
    }

    // For French numbers starting with 0, convert to +33
    if (defaultCountry === 'FR' && digitsOnly.startsWith('0') && digitsOnly.length === 10) {
      const frenchNumber = '+33' + digitsOnly.substring(1);
      const frPhone = parsePhoneNumberFromString(frenchNumber, 'FR');
      if (frPhone && frPhone.isValid()) {
        return frPhone.format('E.164');
      }
    }

    // Return cleaned version if we can't normalize
    return digitsOnly || cleaned;
  } catch (error) {
    console.warn(`Failed to normalize phone: ${phone}`, error);
    return cleaned;
  }
}

/**
 * Validate if a phone number is valid
 */
export function isValidPhone(phone: string, defaultCountry: CountryCode = 'FR'): boolean {
  if (!phone) return false;
  
  try {
    return isValidPhoneNumber(phone, defaultCountry);
  } catch {
    return false;
  }
}

/**
 * Format phone for display (national format)
 */
export function formatPhoneDisplay(phone: string, defaultCountry: CountryCode = 'FR'): string {
  if (!phone) return '';
  
  try {
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    if (phoneNumber) {
      return phoneNumber.formatNational();
    }
  } catch {
    // Ignore
  }
  
  return phone;
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
