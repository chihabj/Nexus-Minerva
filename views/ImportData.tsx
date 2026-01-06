
import React, { useState } from 'react';
import { getSmartMappingSuggestions } from '../services/geminiService';
import { MappingField } from '../types';

const dbFields = [
  { dbField: 'full_name', label: 'Full Name', required: true },
  { dbField: 'email', label: 'Email Address', required: true },
  { dbField: 'phone', label: 'Phone Number', required: false },
  { dbField: 'vehicle', label: 'Vehicle Model', required: false },
  { dbField: 'last_visit', label: 'Last Visit Date', required: false },
];

const mockCsvHeaders = ['Col A: Name', 'Col B: Email Address', 'Col C: Mobile', 'Col D: Region', 'Col F: Date'];

export default function ImportData() {
  const [step, setStep] = useState(2);
  const [mappings, setMappings] = useState<MappingField[]>(
    dbFields.map(f => ({ ...f, confidence: 'None' }))
  );
  const [isLoading, setIsLoading] = useState(false);

  const autoMatch = async () => {
    setIsLoading(true);
    try {
      const suggestions = await getSmartMappingSuggestions(mockCsvHeaders, dbFields.map(d => d.dbField));
      const newMappings = mappings.map(m => {
        const suggestion = suggestions.find((s: any) => s.dbField === m.dbField);
        return {
          ...m,
          mappedColumn: suggestion?.csvColumn || '',
          confidence: suggestion?.confidence || 'None'
        };
      });
      setMappings(newMappings);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
      {/* Stepper */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                Import New Client Data
                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">BATCH #2023-10-24</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1">Match your uploaded file columns to our system fields.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20">Validate & Import</button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {[
              { id: 1, label: 'Upload', status: 'complete' },
              { id: 2, label: 'Map Columns', status: 'active' },
              { id: 3, label: 'Validation', status: 'pending' },
              { id: 4, label: 'Finish', status: 'pending' },
            ].map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-3 ${s.status === 'pending' ? 'opacity-40' : ''}`}>
                  <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    s.status === 'complete' ? 'bg-green-500 border-green-500 text-white' : 
                    s.status === 'active' ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-110' : 
                    'border-slate-200 dark:border-slate-700'
                  }`}>
                    {s.status === 'complete' ? <span className="material-symbols-outlined text-[18px]">check</span> : s.id}
                  </div>
                  <span className={`text-sm font-bold ${s.status === 'active' ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>{s.label}</span>
                </div>
                {idx < 3 && <div className={`flex-1 h-0.5 mx-4 ${idx < step - 1 ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8 max-w-[1400px] w-full mx-auto">
        <div className="flex h-full gap-8">
          {/* Source Preview */}
          <section className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">table_view</span>
                Source File Preview
              </h3>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">client_list_oct23.xlsx</span>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-surface-dark shadow-sm">
                  <tr>
                    <th className="p-4 border-b border-slate-100 dark:border-slate-800 text-slate-400 text-center w-12">#</th>
                    {mockCsvHeaders.map(h => (
                      <th key={h} className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {[1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center text-slate-400 text-xs">{i}</td>
                      <td className="p-4 whitespace-nowrap">Sarah Jenkins</td>
                      <td className="p-4 whitespace-nowrap">sarah.j@example.com</td>
                      <td className="p-4 whitespace-nowrap">555-0123</td>
                      <td className="p-4 whitespace-nowrap">North</td>
                      <td className="p-4 whitespace-nowrap">2023-10-01</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Mapping Engine */}
          <section className="w-[480px] bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Data Mapping</h3>
                <p className="text-xs text-slate-500">Match columns to database fields.</p>
              </div>
              <button 
                onClick={autoMatch}
                disabled={isLoading}
                className="text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                {isLoading ? <div className="size-3 border-2 border-primary border-t-transparent animate-spin rounded-full"></div> : <span className="material-symbols-outlined text-[16px]">magic_button</span>}
                Auto-Match
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {mappings.map((field) => (
                <div key={field.dbField} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold flex items-center gap-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.confidence !== 'None' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        field.confidence === 'High' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {field.confidence} Confidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <select 
                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm py-2.5 focus:ring-2 focus:ring-primary/20 ${field.confidence === 'High' ? 'ring-2 ring-green-500/30' : ''}`}
                        value={field.mappedColumn || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMappings(mappings.map(m => m.dbField === field.dbField ? { ...m, mappedColumn: val, confidence: 'None' } : m));
                        }}
                      >
                        <option value="">Select Column...</option>
                        {mockCsvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {field.confidence === 'High' && <span className="material-symbols-outlined absolute right-8 top-1/2 -translate-y-1/2 text-green-500 text-[18px]">check_circle</span>}
                    </div>
                    <span className="material-symbols-outlined text-slate-300">arrow_right_alt</span>
                    <div className="w-24 h-10 flex items-center px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] text-slate-400 font-mono truncate">
                      Sample Value
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed">
                <span className="material-symbols-outlined text-[14px] text-primary">info</span>
                Nexus AI uses semantic analysis to suggest column matches. Please review all High Confidence mappings before proceeding to the validation step.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
