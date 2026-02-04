import React, { useRef, useCallback } from 'react';
import { useImportProcess, DB_FIELDS, ImportStep } from '../hooks/useImportProcess';
import { getSmartMappingSuggestions } from '../services/geminiService';

export default function ImportData() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    step,
    file,
    parsedData,
    mappings,
    validationResult,
    importResult,
    clientsForReminder,
    isLoading,
    error,
    parseFile,
    updateMapping,
    autoMatchColumns,
    validateData,
    uploadToSupabase,
    sendRemindersBatch,
    skipReminders,
    goToStep,
    reset,
    clearError,
    getSampleValueForColumn,
    dbFields,
  } = useImportProcess();

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      try {
        await parseFile(selectedFile);
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    }
  }, [parseFile]);

  // Handle drag and drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      try {
        await parseFile(droppedFile);
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    }
  }, [parseFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Auto-match with AI (using Gemini service if available, fallback to local matching)
  const handleAutoMatch = useCallback(async () => {
    if (!parsedData) return;

    try {
      // Try AI matching first
      const suggestions = await getSmartMappingSuggestions(
        parsedData.headers,
        dbFields.map(f => f.dbField)
      );

      // Update mappings with AI suggestions
      suggestions.forEach((suggestion: any) => {
        if (suggestion.csvColumn && suggestion.dbField) {
          updateMapping(suggestion.dbField, suggestion.csvColumn, suggestion.confidence || 'Low');
        }
      });
    } catch (err) {
      // Fallback to local auto-matching
      console.log('AI matching unavailable, using local matching');
      await autoMatchColumns();
    }
  }, [parsedData, dbFields, updateMapping, autoMatchColumns]);

  // Handle validation and import
  const handleValidateAndImport = useCallback(async () => {
    try {
      if (step === 'mapping') {
        const result = await validateData();
        if (result.valid || result.errors.length === 0) {
          // Auto-proceed to import if no errors
        }
      } else if (step === 'validation') {
        await uploadToSupabase();
      }
    } catch (err) {
      console.error('Import process error:', err);
    }
  }, [step, validateData, uploadToSupabase]);

  // Get step status for stepper
  const getStepStatus = (stepId: number): 'complete' | 'active' | 'pending' => {
    const stepMap: Record<ImportStep, number> = {
      upload: 1,
      mapping: 2,
      validation: 3,
      importing: 4,
      complete: 4,
    };
    const currentStepNum = stepMap[step];
    
    if (stepId < currentStepNum) return 'complete';
    if (stepId === currentStepNum) return 'active';
    return 'pending';
  };

  // Render upload step
  const renderUploadStep = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="w-full max-w-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center hover:border-primary transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <span className="material-symbols-outlined text-6xl text-slate-400 mb-4">cloud_upload</span>
        <h3 className="text-xl font-bold mb-2">Upload your file</h3>
        <p className="text-slate-500 mb-4">Drag and drop or click to select</p>
        <p className="text-xs text-slate-400">Supports .xlsx, .xls, and .csv files</p>
        
        {isLoading && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="size-5 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
            <span className="text-sm text-slate-500">Parsing file...</span>
          </div>
        )}
        
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 text-sm">
            <span className="material-symbols-outlined text-sm align-middle mr-1">error</span>
            {error}
          </div>
        )}
      </div>
    </div>
  );

  // Render mapping step
  const renderMappingStep = () => (
    <div className="flex-1 overflow-hidden p-8 max-w-[1400px] w-full mx-auto">
      <div className="flex h-full gap-8">
        {/* Source Preview */}
        <section className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">table_view</span>
              Source File Preview
            </h3>
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
              {file?.name || 'No file'}
            </span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            {parsedData && (
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-surface-dark shadow-sm">
                  <tr>
                    <th className="p-4 border-b border-slate-100 dark:border-slate-800 text-slate-400 text-center w-12">#</th>
                    {parsedData.headers.map(h => (
                      <th key={h} className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {parsedData.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center text-slate-400 text-xs">{i + 1}</td>
                      {parsedData.headers.map(h => (
                        <td key={h} className="p-4 whitespace-nowrap max-w-[200px] truncate">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {parsedData && parsedData.totalRows > 10 && (
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Showing 10 of {parsedData.totalRows} rows
            </div>
          )}
        </section>

        {/* Mapping Engine */}
        <section className="w-[480px] bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Data Mapping</h3>
              <p className="text-xs text-slate-500">Match columns to database fields.</p>
            </div>
            <button
              onClick={handleAutoMatch}
              disabled={isLoading}
              className="text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <div className="size-3 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
              ) : (
                <span className="material-symbols-outlined text-[16px]">magic_button</span>
              )}
              Auto-Match
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {dbFields.map((field) => {
              const mapping = mappings.find(m => m.dbField === field.dbField);
              const sampleValue = mapping?.csvColumn ? getSampleValueForColumn(mapping.csvColumn) : '';

              return (
                <div key={field.dbField} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {mapping?.confidence && mapping.confidence !== 'None' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        mapping.confidence === 'High' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {mapping.confidence} Confidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <select
                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm py-2.5 focus:ring-2 focus:ring-primary/20 ${
                          mapping?.confidence === 'High' ? 'ring-2 ring-green-500/30' : ''
                        }`}
                        value={mapping?.csvColumn || ''}
                        onChange={(e) => updateMapping(field.dbField, e.target.value, 'None')}
                      >
                        <option value="">Select Column...</option>
                        {parsedData?.headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      {mapping?.confidence === 'High' && (
                        <span className="material-symbols-outlined absolute right-8 top-1/2 -translate-y-1/2 text-green-500 text-[18px]">
                          check_circle
                        </span>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-slate-300">arrow_right_alt</span>
                    <div className="w-28 h-10 flex items-center px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] text-slate-500 font-mono truncate">
                      {sampleValue || 'Sample Value'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed">
              <span className="material-symbols-outlined text-[14px] text-primary">info</span>
              Nexus AI uses semantic analysis to suggest column matches. Please review all mappings before proceeding.
            </p>
          </div>
        </section>
      </div>
    </div>
  );

  // Render validation step
  const renderValidationStep = () => (
    <div className="flex-1 overflow-auto p-8 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg">Validation Results</h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <span className="material-symbols-outlined text-green-500 text-3xl">check_circle</span>
              <p className="text-2xl font-bold text-green-700 mt-2">{validationResult?.validRecords || 0}</p>
              <p className="text-xs text-green-600">Valid Records</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
              <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
              <p className="text-2xl font-bold text-red-700 mt-2">{validationResult?.errors.length || 0}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <span className="material-symbols-outlined text-amber-500 text-3xl">warning</span>
              <p className="text-2xl font-bold text-amber-700 mt-2">{validationResult?.warnings.length || 0}</p>
              <p className="text-xs text-amber-600">Warnings</p>
            </div>
          </div>

          {/* Errors List */}
          {validationResult?.errors && validationResult.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-red-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                Errors (must be fixed)
              </h4>
              <div className="max-h-48 overflow-auto bg-red-50 dark:bg-red-900/20 rounded-lg p-4 space-y-2">
                {validationResult.errors.slice(0, 20).map((err, i) => (
                  <div key={i} className="text-sm text-red-700 flex gap-2">
                    <span className="font-mono text-xs bg-red-100 px-1 rounded">Row {err.row}</span>
                    <span>{err.field}: {err.message}</span>
                  </div>
                ))}
                {validationResult.errors.length > 20 && (
                  <p className="text-xs text-red-500">... and {validationResult.errors.length - 20} more errors</p>
                )}
              </div>
            </div>
          )}

          {/* Warnings List */}
          {validationResult?.warnings && validationResult.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-amber-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                Warnings (will be normalized)
              </h4>
              <div className="max-h-32 overflow-auto bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 space-y-2">
                {validationResult.warnings.slice(0, 10).map((warn, i) => (
                  <div key={i} className="text-sm text-amber-700 flex gap-2">
                    <span className="font-mono text-xs bg-amber-100 px-1 rounded">Row {warn.row}</span>
                    <span>{warn.field}: {warn.message}</span>
                  </div>
                ))}
                {validationResult.warnings.length > 10 && (
                  <p className="text-xs text-amber-500">... and {validationResult.warnings.length - 10} more warnings</p>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {validationResult?.valid && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <span className="material-symbols-outlined text-green-500 text-4xl">task_alt</span>
              <p className="text-green-700 font-bold mt-2">All records are valid!</p>
              <p className="text-sm text-green-600">Click "Import Data" to proceed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render complete step
  const renderCompleteStep = () => {
    // If there are clients for reminder confirmation, show confirmation screen
    if (clientsForReminder.length > 0) {
      return (
        <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto">
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20">
              <h3 className="font-bold text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <span className="material-symbols-outlined">notifications_active</span>
                Confirmation d'envoi des relances
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                {clientsForReminder.length} client{clientsForReminder.length > 1 ? 's' : ''} {clientsForReminder.length > 1 ? 'sont' : 'est'} à moins de 30 jours de l'échéance. 
                Souhaitez-vous envoyer les relances maintenant ?
              </p>
            </div>

            <div className="p-6">
              <div className="max-h-96 overflow-auto mb-6 space-y-2">
                {clientsForReminder.map((client) => (
                  <div
                    key={client.client_id}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {client.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {client.phone}
                        </span>
                        {client.vehicle && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            • {client.vehicle}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <span>
                          Échéance: {new Date(client.due_date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <span className={`font-bold ${
                          client.daysUntilDue < 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : client.daysUntilDue <= 7 
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {client.daysUntilDue < 0 
                            ? `${Math.abs(client.daysUntilDue)} jour${Math.abs(client.daysUntilDue) > 1 ? 's' : ''} de retard`
                            : `J-${client.daysUntilDue}`
                          }
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Relance: {client.initialStatus === 'Reminder1_sent' ? 'J-30' : client.initialStatus === 'Reminder2_sent' ? 'J-15' : 'J-7'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={async () => {
                    const allClientIds = clientsForReminder.map(c => c.client_id);
                    await skipReminders(allClientIds);
                  }}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ne pas envoyer
                </button>
                <button
                  onClick={async () => {
                    const allClientIds = clientsForReminder.map(c => c.client_id);
                    await sendRemindersBatch(allClientIds);
                  }}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="size-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      Envoyer les relances ({clientsForReminder.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Standard complete screen
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-12 text-center max-w-lg">
          {importResult?.success ? (
            <>
              <span className="material-symbols-outlined text-green-500 text-6xl">celebration</span>
              <h3 className="text-2xl font-bold mt-4">Import terminé !</h3>
              <p className="text-slate-500 mt-2">{importResult.inserted} clients importés avec succès.</p>
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  Les relances non envoyées sont disponibles dans la <strong>To-do List</strong>
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-red-500 text-6xl">error</span>
              <h3 className="text-2xl font-bold mt-4">Échec de l'import</h3>
              <p className="text-slate-500 mt-2">
                {importResult?.inserted || 0} importés, {importResult?.failed || 0} échoués.
              </p>
              {importResult?.errors && importResult.errors.length > 0 && (
                <div className="mt-4 text-left bg-red-50 rounded-lg p-4 max-h-32 overflow-auto">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-sm text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </>
          )}
          <button
            onClick={reset}
            className="mt-6 px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold"
          >
            Nouvel Import
          </button>
        </div>
      </div>
    );
  };

  // Get current step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return renderUploadStep();
      case 'mapping':
        return renderMappingStep();
      case 'validation':
        return renderValidationStep();
      case 'importing':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="size-12 border-4 border-primary border-t-transparent animate-spin rounded-full mx-auto"></div>
              <p className="mt-4 text-slate-500">Importing data to Supabase...</p>
            </div>
          </div>
        );
      case 'complete':
        return renderCompleteStep();
      default:
        return renderUploadStep();
    }
  };

  // Get action button text
  const getActionButtonText = () => {
    switch (step) {
      case 'upload':
        return 'Upload File';
      case 'mapping':
        return 'Validate Data';
      case 'validation':
        return validationResult?.valid ? 'Import Data' : 'Fix Errors & Retry';
      case 'importing':
        return 'Importing...';
      case 'complete':
        return 'Done';
      default:
        return 'Next';
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'upload':
        return false; // Upload handles itself
      case 'mapping':
        // Check if required fields are mapped
        return dbFields
          .filter(f => f.required)
          .every(f => mappings.find(m => m.dbField === f.dbField)?.csvColumn);
      case 'validation':
        return validationResult?.errors.length === 0;
      default:
        return false;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header with Stepper */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                Import New Client Data
                {file && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {parsedData?.totalRows || 0} rows
                  </span>
                )}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {step === 'upload' && 'Upload an Excel or CSV file to import client data.'}
                {step === 'mapping' && 'Match your file columns to database fields.'}
                {step === 'validation' && 'Review validation results before importing.'}
                {step === 'importing' && 'Please wait while data is being imported.'}
                {step === 'complete' && 'Import process completed.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {step !== 'upload' && step !== 'complete' && (
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
              )}
              {step !== 'upload' && step !== 'complete' && step !== 'importing' && (
                <button
                  onClick={handleValidateAndImport}
                  disabled={!canProceed() || isLoading}
                  className={`px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all ${
                    canProceed() && !isLoading
                      ? 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="size-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                      Processing...
                    </span>
                  ) : (
                    getActionButtonText()
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2">
            {[
              { id: 1, label: 'Upload', stepKey: 'upload' },
              { id: 2, label: 'Map Columns', stepKey: 'mapping' },
              { id: 3, label: 'Validation', stepKey: 'validation' },
              { id: 4, label: 'Finish', stepKey: 'complete' },
            ].map((s, idx) => {
              const status = getStepStatus(s.id);
              return (
                <React.Fragment key={s.id}>
                  <div className={`flex items-center gap-3 ${status === 'pending' ? 'opacity-40' : ''}`}>
                    <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      status === 'complete' ? 'bg-green-500 border-green-500 text-white' :
                      status === 'active' ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-110' :
                      'border-slate-200 dark:border-slate-700'
                    }`}>
                      {status === 'complete' ? (
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      ) : (
                        s.id
                      )}
                    </div>
                    <span className={`text-sm font-bold ${
                      status === 'active' ? 'text-primary' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      getStepStatus(s.id + 1) !== 'pending' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`}></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && step !== 'upload' && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-8 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </p>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Step Content */}
      {renderStepContent()}
    </div>
  );
}
