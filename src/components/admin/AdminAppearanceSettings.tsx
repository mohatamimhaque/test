import React, { useState } from 'react';
import { getSiteSettings, updateSiteSettings } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { Palette, Save, Check } from 'lucide-react';

export const AdminAppearanceSettings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => getSiteSettings());
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(settings, user?.email);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" />
          Dynamic Site Settings & Appearance
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure CSE Archive branding, headings, contact info, and public registration state.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-500" />
          Site settings saved successfully across the entire portal!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Site Main Title</label>
            <input
              type="text"
              value={settings.title}
              onChange={e => setSettings({ ...settings, title: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subtitle</label>
            <input
              type="text"
              value={settings.subtitle}
              onChange={e => setSettings({ ...settings, subtitle: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Header Title Banner</label>
            <input
              type="text"
              value={settings.header_title}
              onChange={e => setSettings({ ...settings, header_title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Portal Description</label>
            <textarea
              rows={2}
              value={settings.description}
              onChange={e => setSettings({ ...settings, description: e.target.value })}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={settings.contact_email}
              onChange={e => setSettings({ ...settings, contact_email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Phone</label>
            <input
              type="text"
              value={settings.contact_phone}
              onChange={e => setSettings({ ...settings, contact_phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Footer Copyright Text</label>
            <input
              type="text"
              value={settings.footer_text}
              onChange={e => setSettings({ ...settings, footer_text: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
          <div>
            <div className="font-bold text-slate-900 dark:text-white">Public Join System</div>
            <div className="text-[11px] text-slate-400">Allow public alumni users to submit self-registration join requests.</div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.join_enabled}
              onChange={e => setSettings({ ...settings, join_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Site Settings
          </button>
        </div>
      </form>
    </div>
  );
};
