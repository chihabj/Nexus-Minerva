import ExcelJS from 'exceljs';

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  totalRows: number;
}

/**
 * Parse an Excel (.xlsx) or CSV file from the browser
 * Uses ExcelJS with workbook.xlsx.load(arrayBuffer) for browser compatibility
 * 
 * @param file - File object from input[type="file"]
 * @returns ParsedData with headers and rows as JSON objects
 */
export async function parseExcelFile(file: File): Promise<ParsedData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  
  // Determine file type and load accordingly
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    // For CSV files, convert to text and parse
    const text = await file.text();
    return parseCSVText(text, file.name);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // For Excel files, use xlsx.load
    await workbook.xlsx.load(arrayBuffer);
  } else {
    throw new Error(`Unsupported file format: ${fileName}. Please upload .xlsx, .xls, or .csv files.`);
  }

  // Get the first worksheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const headers: string[] = [];
  const rows: Record<string, any>[] = [];

  // Extract headers from the first row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const headerValue = getCellValue(cell);
    headers[colNumber - 1] = headerValue ? String(headerValue).trim() : `Column ${colNumber}`;
  });

  // Filter out empty headers and create column mapping
  const validHeaders = headers.filter(h => h && h.trim() !== '');
  
  // Extract data rows (starting from row 2)
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const rowData: Record<string, any> = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        const value = getCellValue(cell);
        rowData[header] = value;
        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
        }
      }
    });

    // Only add rows that have at least some data
    if (hasData) {
      rows.push(rowData);
    }
  });

  return {
    headers: validHeaders,
    rows,
    fileName: file.name,
    totalRows: rows.length
  };
}

/**
 * Parse CSV text content
 */
function parseCSVText(text: string, fileName: string): ParsedData {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const rowData: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      rowData[header] = values[index] || '';
    });
    
    rows.push(rowData);
  }

  return {
    headers,
    rows,
    fileName,
    totalRows: rows.length
  };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Extract value from an ExcelJS cell
 */
function getCellValue(cell: ExcelJS.Cell): any {
  if (cell.value === null || cell.value === undefined) {
    return '';
  }

  // Handle different cell value types
  if (typeof cell.value === 'object') {
    // Rich text
    if ('richText' in cell.value) {
      return (cell.value as ExcelJS.CellRichTextValue).richText
        .map(rt => rt.text)
        .join('');
    }
    // Hyperlink
    if ('hyperlink' in cell.value) {
      return (cell.value as ExcelJS.CellHyperlinkValue).text || 
             (cell.value as ExcelJS.CellHyperlinkValue).hyperlink;
    }
    // Formula
    if ('formula' in cell.value) {
      return (cell.value as ExcelJS.CellFormulaValue).result;
    }
    // Date
    if (cell.value instanceof Date) {
      return cell.value.toISOString().split('T')[0];
    }
    // Error
    if ('error' in cell.value) {
      return '';
    }
  }

  return cell.value;
}

/**
 * Get a preview of the parsed data (first N rows)
 */
export function getPreviewData(data: ParsedData, maxRows: number = 5): ParsedData {
  return {
    ...data,
    rows: data.rows.slice(0, maxRows),
    totalRows: data.totalRows
  };
}

/**
 * Get sample value for a specific column
 */
export function getSampleValue(data: ParsedData, header: string): string {
  for (const row of data.rows) {
    const value = row[header];
    if (value !== null && value !== undefined && value !== '') {
      return String(value);
    }
  }
  return '';
}
