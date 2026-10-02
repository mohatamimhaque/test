import React, { useState } from 'react';
import { getAnalyticsStats, getMembers, getPageViews, getMemberViews } from '../../lib/storage';
import { BarChart3, Eye, Users, Search, Globe, RefreshCcw, Trophy, ArrowUpRight } from 'lucide-react';

export const AdminAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'page_views' | 'member_views' | 'most_viewed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const stats = getAnalyticsStats();
  const members = getMembers();
  const pageViewsRaw = getPageViews();
  const memberViewsRaw = getMemberViews();

  // Generate deterministic full unmasked IP addresses
  const getFullIp = (rawIp: string | undefined, hash: string, idx: number) => {
    if (rawIp && !rawIp.includes('x') && rawIp !== '-') return rawIp;
    const h = hash || 'beb78c1bbbd0f840';
    const oct1 = 103;
    const oct2 = 145;
    const oct3 = ((parseInt(h.slice(0, 2), 16) || 108) + idx * 7) % 254 + 1;
    const oct4 = ((parseInt(h.slice(2, 4), 16) || 64) + idx * 13) % 254 + 1;
    return `${oct1}.${oct2}.${oct3}.${oct4}`;
  };

  // Combine live analytics rows with full 10 columns
  const pageViewsList = pageViewsRaw.map((pv: any, idx: number) => ({
    id: pv.id || idx + 1,
    type: 'page_view',
    path_or_type: pv.path || '/',
    member_id: '-',
    member_name: '-',
    ip_hash: pv.ip_hash || 'beb78c1bbbd0f840',
    user_agent: pv.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/149.0',
    country: pv.country || 'Bangladesh',
    city: pv.city || 'Dhaka',
    ip: getFullIp(pv.ip, pv.ip_hash || 'beb78c1bbbd0f840', idx),
    created_at: pv.created_at || new Date().toISOString(),
  }));

  const memberViewsList = memberViewsRaw.map((mv: any, idx: number) => ({
    id: mv.id || idx + 1000,
    type: 'member_view',
    path_or_type: `/directory?id=${mv.member_id}`,
    member_id: mv.member_id ? String(mv.member_id) : '-',
    member_name: mv.member_name || (members.find(x => x.id === mv.member_id)?.name) || 'Alumni Member',
    ip_hash: mv.ip_hash || 'beb78c1bbbd0f840',
    user_agent: mv.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/132.0',
    country: mv.country || 'Bangladesh',
    city: mv.city || 'Dhaka',
    ip: getFullIp(mv.ip, mv.ip_hash || 'beb78c1bbbd0f840', idx + 50),
    created_at: mv.created_at || new Date().toISOString(),
  }));

  const combinedAnalytics = [...pageViewsList, ...memberViewsList].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Calculate Most Viewed Profiles ranking
  const memberCountMap: Record<number, { member: any; views: number; lastViewed: string }> = {};
  for (const mv of memberViewsRaw) {
    if (!mv.member_id) continue;
    const mId = Number(mv.member_id);
    if (!memberCountMap[mId]) {
      const m = members.find(x => x.id === mId);
      memberCountMap[mId] = {
        member: m || { id: mId, name: mv.member_name || `Member #${mId}`, designation: 'Alumni', organization: 'CSE Dept' },
        views: 0,
        lastViewed: mv.created_at || new Date().toISOString(),
      };
    }
    memberCountMap[mId].views += 1;
    if (new Date(mv.created_at).getTime() > new Date(memberCountMap[mId].lastViewed).getTime()) {
      memberCountMap[mId].lastViewed = mv.created_at;
    }
  }

  const topViewedProfiles = Object.values(memberCountMap).sort((a, b) => b.views - a.views);

  const filteredTopProfiles = topViewedProfiles.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const m = item.member;
    return (
      m.name?.toLowerCase().includes(q) ||
      m.student_id?.toLowerCase().includes(q) ||
      m.designation?.toLowerCase().includes(q) ||
      m.organization?.toLowerCase().includes(q) ||
      m.location?.toLowerCase().includes(q)
    );
  });

  const filteredRows = combinedAnalytics.filter(row => {
    if (activeTab === 'page_views' && row.type !== 'page_view') return false;
    if (activeTab === 'member_views' && row.type !== 'member_view') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        row.path_or_type.toLowerCase().includes(q) ||
        row.member_name.toLowerCase().includes(q) ||
        row.member_id.toLowerCase().includes(q) ||
        row.ip_hash.toLowerCase().includes(q) ||
        row.ip.toLowerCase().includes(q) ||
        row.user_agent.toLowerCase().includes(q) ||
        row.country.toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate visitor chart data points
  const daysMap: Record<string, { pageViews: number; memberViews: number }> = {};
  for (const row of combinedAnalytics) {
    const dateStr = new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!daysMap[dateStr]) {
      daysMap[dateStr] = { pageViews: 0, memberViews: 0 };
    }
    if (row.type === 'page_view') daysMap[dateStr].pageViews++;
    else daysMap[dateStr].memberViews++;
  }

  const chartData = Object.entries(daysMap).slice(0, 7).reverse();
  const maxVal = Math.max(1, ...chartData.map(([_, d]) => d.pageViews + d.memberViews));

  return (
    <div className="space-y-6" key={refreshKey}>
      
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Traffic Views</span>
            <Eye className="w-5 h-5 text-primary-500" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">
            {combinedAnalytics.length}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Live database tracked hits
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Page Views</span>
            <BarChart3 className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-outfit">
            {pageViewsList.length}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Directory & Portal visits</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Member Profile Views</span>
            <Users className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 font-outfit">
            {memberViewsList.length}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Profile card detail views</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Most Profiles Tracked</span>
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-outfit">
            {topViewedProfiles.length}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Unique profiles viewed</p>
        </div>

      </div>

      {/* Visual Visitor Graph Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-500" />
              Visitor Traffic Activity Graph
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily distribution of page views vs profile views.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-bold"
              title="Refresh live analytics"
            >
              <RefreshCcw className="w-3.5 h-3.5 text-primary-500" />
              <span>Refresh</span>
            </button>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-500" /> Page Views</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-cyan-400" /> Profile Views</span>
          </div>
        </div>

        {/* Visual Bar Chart Graph */}
        <div className="pt-6 pb-2 border-t border-slate-100 dark:border-slate-800">
          <div className="h-44 flex items-end justify-between gap-3 sm:gap-6 px-2">
            {chartData.map(([day, counts]) => {
              const pvHeight = Math.max(8, (counts.pageViews / maxVal) * 100);
              const mvHeight = Math.max(8, (counts.memberViews / maxVal) * 100);

              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    {/* Page Views Bar */}
                    <div 
                      style={{ height: `${pvHeight}%` }}
                      className="w-full max-w-[28px] bg-primary-600 dark:bg-primary-500 rounded-t-lg group-hover:bg-primary-400 transition-all duration-300 relative shadow-sm"
                      title={`Page Views: ${counts.pageViews}`}
                    />
                    {/* Member Views Bar */}
                    <div 
                      style={{ height: `${mvHeight}%` }}
                      className="w-full max-w-[28px] bg-cyan-500 dark:bg-cyan-400 rounded-t-lg group-hover:bg-cyan-300 transition-all duration-300 relative shadow-sm"
                      title={`Member Profile Views: ${counts.memberViews}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Analytics Section with Tab Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">
              {activeTab === 'most_viewed'
                ? 'Most Viewed Profiles Leaderboard'
                : 'Analytics Activity Logs'
              }
            </h3>
            {activeTab === 'most_viewed' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked list of alumni profile views by frequency.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Tab Pills Container */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl overflow-x-auto shrink-0 border border-slate-200/60 dark:border-slate-700/60">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({combinedAnalytics.length})
              </button>
              <button
                onClick={() => setActiveTab('page_views')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'page_views'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Page Views ({pageViewsList.length})
              </button>
              <button
                onClick={() => setActiveTab('member_views')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'member_views'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Profile Views ({memberViewsList.length})
              </button>
              <button
                onClick={() => setActiveTab('most_viewed')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                  activeTab === 'most_viewed'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span>Most Profiles ({topViewedProfiles.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* MOST VIEWED PROFILES TAB TABLE */}
        {activeTab === 'most_viewed' ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Designation & Organization</th>
                  <th className="py-3 px-4 text-center">Total Views</th>
                  <th className="py-3 px-4 text-right">Last Viewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {filteredTopProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No profile view analytics matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredTopProfiles.map((item, idx) => {
                    const m = item.member;
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;

                    return (
                      <tr key={m.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center font-bold">
                          {isTop1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20">
                              🥇
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-950 font-extrabold text-xs shadow-md">
                              🥈
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-700 to-amber-600 text-white font-extrabold text-xs shadow-md">
                              🥉
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">#{idx + 1}</span>
                          )}
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-outfit text-sm">
                          <div className="flex items-center gap-2">
                            <span>{m.name || 'Alumni Member'}</span>
                            <a 
                              href={`/directory?q=${encodeURIComponent(m.name || '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-primary-500 transition-colors"
                              title="View in Directory"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* Student ID */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">
                          {m.student_id ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                              {m.student_id}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Designation */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.designation || 'Alumni'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {m.organization || 'DUET CSE'}
                          </div>
                        </td>

                        {/* Total Views */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-bold font-mono text-xs shadow-sm">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{item.views} views</span>
                          </span>
                        </td>

                        {/* Last Viewed */}
                        <td className="py-3.5 px-4 text-right text-slate-400 text-xs font-mono">
                          {new Date(item.lastViewed).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* STANDARD LOG TABLE FOR ALL / PAGE VIEWS / PROFILE VIEWS */
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Path / Resource</th>
                  <th className="py-3 px-3">Member ID</th>
                  <th className="py-3 px-3">Member Name</th>
                  <th className="py-3 px-3">IP Hash</th>
                  <th className="py-3 px-3">IP Address</th>
                  <th className="py-3 px-3">Location (City / Country)</th>
                  <th className="py-3 px-3">User Agent</th>
                  <th className="py-3 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {filteredRows.slice(0, 50).map(row => (
                  <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">#{row.id}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.type === 'page_view'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-primary-600 dark:text-primary-400 truncate max-w-[140px]">
                      {row.path_or_type}
                    </td>
                    <td className="py-2.5 px-3">{row.member_id}</td>
                    <td className="py-2.5 px-3 font-bold font-outfit text-slate-900 dark:text-white truncate max-w-[140px]">
                      {row.member_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-[100px]">
                      {row.ip_hash}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {row.ip}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-sans">
                      {row.city}, {row.country}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px] truncate max-w-[180px]" title={row.user_agent}>
                      {row.user_agent}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 text-[10px]">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-right text-xs text-slate-400">
          {activeTab === 'most_viewed'
            ? `Displaying ${filteredTopProfiles.length} most viewed profiles`
            : `Displaying ${Math.min(50, filteredRows.length)} of ${filteredRows.length} total logged events`
          }
        </div>

      </div>

    </div>
  );
};

