import React, { useState } from 'react';
import { Member } from '../../types';
import { getMembers, updateMember } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { Layers, CheckSquare, Square, Search, RefreshCw, AlertCircle, Check } from 'lucide-react';

export const AdminBulkUpdate: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>(() => getMembers());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk Field values
  const [bulkFields, setBulkFields] = useState({
    organization: '',
    location: '',
    designation: '',
    blood: '',
  });

  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.student_id?.toLowerCase().includes(q) ||
      m.organization?.toLowerCase().includes(q) ||
      m.location?.toLowerCase().includes(q)
    );
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map(m => m.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleApplyBulkUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      alert('Please select at least one member to bulk update.');
      return;
    }

    const updatesToApply: Partial<Member> = {};
    if (bulkFields.organization.trim()) updatesToApply.organization = bulkFields.organization.trim();
    if (bulkFields.location.trim()) updatesToApply.location = bulkFields.location.trim();
    if (bulkFields.designation.trim()) updatesToApply.designation = bulkFields.designation.trim();
    if (bulkFields.blood.trim()) updatesToApply.blood = bulkFields.blood.trim();

    if (Object.keys(updatesToApply).length === 0) {
      alert('Please enter at least one field value to update.');
      return;
    }

    if (window.confirm(`Are you sure you want to update ${selectedIds.length} selected members with these changes?`)) {
      for (const id of selectedIds) {
        updateMember(id, updatesToApply, user?.email);
      }
      setAppliedCount(selectedIds.length);
      setMembers(getMembers());
      setSelectedIds([]);
      setBulkFields({ organization: '', location: '', designation: '', blood: '' });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          Bulk Member Batch Operations
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select multiple alumni members and update specific attributes simultaneously.
        </p>
      </div>

      {appliedCount !== null && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            Bulk update applied to {appliedCount} members successfully!
          </div>
          <button onClick={() => setAppliedCount(null)} className="text-xs underline font-bold">Dismiss</button>
        </div>
      )}

      {/* Bulk Update Fields Form */}
      <form onSubmit={handleApplyBulkUpdate} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-4 text-xs border border-slate-200 dark:border-slate-700">
        <div className="font-bold text-slate-800 dark:text-slate-200">
          Fields to Update across ({selectedIds.length} selected members):
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Set Organization</label>
            <input
              type="text"
              value={bulkFields.organization}
              onChange={e => setBulkFields({ ...bulkFields, organization: e.target.value })}
              placeholder="Leave blank to keep current"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Set Location</label>
            <input
              type="text"
              value={bulkFields.location}
              onChange={e => setBulkFields({ ...bulkFields, location: e.target.value })}
              placeholder="Leave blank to keep current"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Set Designation</label>
            <input
              type="text"
              value={bulkFields.designation}
              onChange={e => setBulkFields({ ...bulkFields, designation: e.target.value })}
              placeholder="Leave blank to keep current"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Set Blood Group</label>
            <select
              value={bulkFields.blood}
              onChange={e => setBulkFields({ ...bulkFields, blood: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">Leave blank to keep current</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={selectedIds.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:opacity-40 transition-colors"
          >
            Apply Bulk Update ({selectedIds.length} Selected)
          </button>
        </div>
      </form>

      {/* Select Members Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter list..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            {selectedIds.length === filteredMembers.length ? 'Deselect All' : 'Select All Filtered'}
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold sticky top-0">
              <tr>
                <th className="p-3 w-10 text-center">Select</th>
                <th className="p-3">Member Name</th>
                <th className="p-3">Student ID</th>
                <th className="p-3">Current Organization</th>
                <th className="p-3">Current Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMembers.slice(0, 100).map(m => {
                const isSelected = selectedIds.includes(m.id);
                return (
                  <tr 
                    key={m.id} 
                    onClick={() => toggleSelect(m.id)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      isSelected ? 'bg-primary-50/60 dark:bg-primary-950/30' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary-600 mx-auto" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white font-outfit">{m.name}</td>
                    <td className="p-3 font-mono">{m.student_id || '-'}</td>
                    <td className="p-3">{m.organization || '-'}</td>
                    <td className="p-3">{m.location || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
