import React, { useState } from 'react';
import { Member } from '../../types';
import { getMembers, updateMember, createMember, deleteMember } from '../../lib/storage';
import { getPhotoUrl, processPhotoUpload, getDefaultAvatar } from '../../lib/r2';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  Upload, 
  Loader2, 
  Building2, 
  MapPin, 
  Mail, 
  Phone,
} from 'lucide-react';
import { Pagination } from '../common/Pagination';

export const AdminMembersManager: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>(() => getMembers());
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Edit / Add Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    student_id: '',
    blood: '',
    designation: '',
    organization: '',
    location: '',
    photo_key: '',
    photo_url: '',
    visible: true,
  });

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const refreshMembers = () => {
    setMembers(getMembers());
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
  };

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.student_id?.toLowerCase().includes(q) ||
      m.organization?.toLowerCase().includes(q) ||
      m.location?.toLowerCase().includes(q) ||
      m.designation?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize);

  const handleToggleVisibility = (m: Member) => {
    updateMember(m.id, { visible: !m.visible }, user?.email);
    refreshMembers();
  };

  const handleDelete = (m: Member) => {
    if (window.confirm(`Are you sure you want to delete ${m.name}? This operation is logged.`)) {
      deleteMember(m.id, user?.email);
      refreshMembers();
    }
  };

  const openAddModal = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      student_id: '',
      blood: '',
      designation: '',
      organization: '',
      location: '',
      photo_key: '',
      photo_url: '',
      visible: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (m: Member) => {
    setEditingMember(m);
    setFormData({
      name: m.name || '',
      email: m.email || '',
      mobile: m.mobile || '',
      student_id: m.student_id || '',
      blood: m.blood || '',
      designation: m.designation || '',
      organization: m.organization || '',
      location: m.location || '',
      photo_key: m.photo_key || '',
      photo_url: m.photo_url || '',
      visible: m.visible !== false,
    });
    setModalOpen(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const res = await processPhotoUpload(file);
      setFormData(prev => ({
        ...prev,
        photo_key: res.photo_key,
        photo_url: res.photo_url,
      }));
    } catch (err: any) {
      alert(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Name is required');
      return;
    }

    if (editingMember) {
      updateMember(editingMember.id, formData, user?.email);
    } else {
      createMember(formData, user?.email);
    }

    setModalOpen(false);
    refreshMembers();
  };

  return (
    <div className="space-y-4">
      
      {/* Action Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search member by name, ID, email, company..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
          />
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New Member
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4">Designation & Org</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Blood</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {paginatedMembers.length > 0 ? (
                paginatedMembers.map((m) => {
                  const photoUrl = getPhotoUrl(m.photo_url || m.photo_key);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={photoUrl || getDefaultAvatar(undefined, m.name)}
                            alt={m.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getDefaultAvatar(undefined, m.name);
                            }}
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white font-outfit">{m.name}</div>
                            <div className="text-[11px] text-slate-400">ID #{m.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold">
                        {m.student_id || '-'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{m.designation || '-'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{m.organization || '-'}</div>
                      </td>

                      <td className="py-3 px-4 space-y-0.5 text-[11px]">
                        {m.email && (
                          <a 
                            href={`mailto:${m.email}`}
                            className="block truncate max-w-[180px] text-primary-600 dark:text-primary-400 hover:underline font-medium"
                            title={`Email ${m.email}`}
                          >
                            {m.email}
                          </a>
                        )}
                        {m.mobile && (
                          <a 
                            href={`tel:${m.mobile}`}
                            className="block text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:underline font-mono"
                            title={`Call ${m.mobile}`}
                          >
                            {m.mobile}
                          </a>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {m.blood ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            {m.blood}
                          </span>
                        ) : '-'}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleVisibility(m)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors ${
                            m.visible
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {m.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {m.visible ? 'Public' : 'Hidden'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Member"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No member records found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">
                {editingMember ? `Edit Member: ${editingMember.name}` : 'Add New Alumni Member'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              
              {/* Photo Upload Section */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <img
                  src={getPhotoUrl(formData.photo_url || formData.photo_key)}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="flex-1 space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Member Profile Photo</label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                    {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload Photo
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Student / Alumni ID</label>
                  <input
                    type="text"
                    value={formData.student_id}
                    onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Organization / Company</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={e => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                  <select
                    value={formData.blood}
                    onChange={e => setFormData({ ...formData, blood: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">Select Blood Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="visibleToggle"
                  checked={formData.visible}
                  onChange={e => setFormData({ ...formData, visible: e.target.checked })}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="visibleToggle" className="font-semibold text-slate-700 dark:text-slate-300">
                  Visible publicly on member directory
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md"
                >
                  {editingMember ? 'Save Changes' : 'Create Member'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
