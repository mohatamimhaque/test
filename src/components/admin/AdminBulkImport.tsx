import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Member } from '../../types';
import { getMembers, createMember, updateMember } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { FileUp, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';

interface ImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export const AdminBulkImport: React.FC = () => {
  const { user } = useAuth();

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Mapping configuration
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    name: '',
    email: '',
    student_id: '',
    mobile: '',
    blood: '',
    designation: '',
    organization: '',
    location: '',
  });

  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('update');
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1 });

        if (data.length < 2) {
          alert('Uploaded file contains no data rows.');
          return;
        }

        const rawHeaders = (data[0] as string[]).map(h => String(h || '').trim());
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        setHeaders(rawHeaders);
        setParsedRows(rawRows);

        // Auto-guess column mappings
        const autoMap: Record<string, string> = {
          name: rawHeaders.find(h => /name/i.test(h)) || '',
          email: rawHeaders.find(h => /email/i.test(h)) || '',
          student_id: rawHeaders.find(h => /student|id|roll/i.test(h)) || '',
          mobile: rawHeaders.find(h => /mobile|phone|contact/i.test(h)) || '',
          blood: rawHeaders.find(h => /blood/i.test(h)) || '',
          designation: rawHeaders.find(h => /designation|role|title/i.test(h)) || '',
          organization: rawHeaders.find(h => /org|company|work/i.test(h)) || '',
          location: rawHeaders.find(h => /location|city|address/i.test(h)) || '',
        };

        setColumnMap(autoMap);
        setStep('mapping');
      } catch (err: any) {
        alert('Failed to parse file: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleRunImport = () => {
    const existingMembers = getMembers();
    const existingEmailMap = new Map<string, Member>();
    const existingStudentIdMap = new Map<string, Member>();

    for (const m of existingMembers) {
      if (m.email) existingEmailMap.set(m.email.toLowerCase(), m);
      if (m.student_id) existingStudentIdMap.set(m.student_id, m);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of parsedRows) {
      const name = String(row[columnMap.name] || '').trim();
      const email = String(row[columnMap.email] || '').trim();
      const student_id = String(row[columnMap.student_id] || '').trim();
      const mobile = String(row[columnMap.mobile] || '').trim();
      const blood = String(row[columnMap.blood] || '').trim();
      const designation = String(row[columnMap.designation] || '').trim();
      const organization = String(row[columnMap.organization] || '').trim();
      const location = String(row[columnMap.location] || '').trim();

      if (!name) {
        failed++;
        continue;
      }

      // Check duplicates
      const match = (email && existingEmailMap.get(email.toLowerCase())) || (student_id && existingStudentIdMap.get(student_id));

      if (match) {
        if (duplicateAction === 'skip') {
          skipped++;
        } else {
          updateMember(match.id, {
            name,
            email: email || match.email,
            mobile: mobile || match.mobile,
            student_id: student_id || match.student_id,
            blood: blood || match.blood,
            designation: designation || match.designation,
            organization: organization || match.organization,
            location: location || match.location,
          }, user?.email);
          updated++;
        }
      } else {
        createMember({
          name,
          email,
          mobile,
          student_id,
          blood,
          designation,
          organization,
          location,
          photo_key: '',
          photo_url: '',
          visible: true,
        }, user?.email);
        inserted++;
      }
    }

    setImportSummary({ inserted, updated, skipped, failed });
    setStep('result');
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setImportSummary(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
          <FileUp className="w-5 h-5 text-primary-500" />
          Bulk Alumni Member Import
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Import multiple CSE alumni records from CSV or Excel (.xlsx) spreadsheets with duplicate detection.
        </p>
      </div>

      {step === 'upload' && (
        <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-4 hover:border-primary-500 transition-colors">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-primary-500" />
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Upload CSV or Excel Spreadsheet (.xlsx)
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports column mapping for Name, Student ID, Email, Phone, Designation, Organization, Location.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-colors">
            Select Spreadsheet File
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-400">File:</span>{' '}
              <span className="font-bold text-slate-900 dark:text-white">{fileName}</span> ({parsedRows.length} rows found)
            </div>
            <button onClick={handleReset} className="text-rose-500 font-semibold hover:underline">
              Cancel & Upload Different File
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Map Spreadsheet Columns to CSE Archive Fields
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {[
                { key: 'name', label: 'Full Name *' },
                { key: 'student_id', label: 'Student / Alumni ID' },
                { key: 'email', label: 'Email Address' },
                { key: 'mobile', label: 'Mobile Phone' },
                { key: 'designation', label: 'Designation' },
                { key: 'organization', label: 'Organization / Company' },
                { key: 'location', label: 'Location' },
                { key: 'blood', label: 'Blood Group' },
              ].map(field => (
                <div key={field.key} className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">{field.label}</label>
                  <select
                    value={columnMap[field.key] || ''}
                    onChange={e => setColumnMap({ ...columnMap, [field.key]: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="">-- Do not map --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs">
            <label className="block font-bold text-slate-800 dark:text-slate-200">
              Duplicate Handling Strategy:
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="dupAction"
                  checked={duplicateAction === 'update'}
                  onChange={() => setDuplicateAction('update')}
                />
                Update existing member details if duplicate email/ID match
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="dupAction"
                  checked={duplicateAction === 'skip'}
                  onChange={() => setDuplicateAction('skip')}
                />
                Skip duplicate records
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleRunImport}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              Confirm & Execute Import ({parsedRows.length} Rows)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'result' && importSummary && (
        <div className="space-y-6">
          <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-base font-outfit">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Bulk Import Completed Successfully!
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Operational summary of processed member records:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-center">
                <div className="text-xl font-bold text-emerald-600">{importSummary.inserted}</div>
                <div className="text-[10px] font-semibold text-slate-400">Newly Inserted</div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-center">
                <div className="text-xl font-bold text-blue-600">{importSummary.updated}</div>
                <div className="text-[10px] font-semibold text-slate-400">Updated</div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-center">
                <div className="text-xl font-bold text-amber-600">{importSummary.skipped}</div>
                <div className="text-[10px] font-semibold text-slate-400">Skipped</div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-center">
                <div className="text-xl font-bold text-rose-600">{importSummary.failed}</div>
                <div className="text-[10px] font-semibold text-slate-400">Failed (No Name)</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Perform Another Import
          </button>
        </div>
      )}

    </div>
  );
};
