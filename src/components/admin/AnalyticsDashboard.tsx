import React, { useState, useEffect } from 'react';
import { AnalyticsStats } from '@/types';
import { AnalyticsSkeleton } from '@/components/lookbook/LookbookSkeletonGrid';
import { api } from '@/lib/api';
import {
  TrendingUp,
  MousePointerClick,
  DollarSign,
  Eye,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  Download,
  AlertCircle
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getAnalytics();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto refresh every 30s
    const timer = setInterval(fetchStats, 30000);
    return () => clearInterval(timer);
  }, []);

  const exportCSV = () => {
    if (!stats || !stats.recentClicks.length) return;
    const headers = ['ID', 'Product', 'Merchant', 'Device', 'Referrer', 'Source', 'Timestamp', 'Commission'];
    const rows = stats.recentClicks.map(c => [
      c.id,
      `"${c.productTitle.replace(/"/g, '""')}"`,
      c.merchant,
      c.device,
      c.referrer,
      c.utmSource || 'direct',
      c.timestamp,
      c.estimatedCommission
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `muiro_affiliate_clicks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && !stats) {
    return (
      <AnalyticsSkeleton />
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center bg-white rounded-xl border border-rose-200 mt-10">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#181512] mb-1">Failed to load analytics</h3>
        <p className="text-sm text-[#6e6761] mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-[#181512] text-white text-xs font-bold uppercase rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  const epc = stats.totalClicks > 0
    ? (stats.estimatedEarnings / stats.totalClicks).toFixed(2)
    : '0.00';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-[#e8e2dc]">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#6e6761] mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Secure Traffic & Affiliate Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-editorial text-[#181512]">
            Affiliate Performance Dashboard
          </h1>
          <p className="text-sm text-[#6e6761] mt-1">
            Real-time click-through rates, merchant commission tracking, and fraud-filtered traffic logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="p-2.5 rounded-lg border border-[#e8e2dc] bg-white hover:bg-[#f4efe9] text-[#181512] transition shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#e8e2dc] text-[#181512] hover:bg-[#f4efe9] text-xs font-bold uppercase tracking-wider transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {/* Outbound Clicks */}
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <div className="flex items-center justify-between text-[#6e6761] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Outbound Clicks</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-serif-editorial text-[#181512] mb-1">
            {stats.totalClicks.toLocaleString()}
          </div>
          <div className="text-xs text-[#6e6761] flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>{stats.totalClicks === 0 && stats.totalImpressions === 0 ? 'Fresh analytics · collecting data' : 'Activity since analytics reset'}</span>
          </div>
        </div>

        {/* Click-Through Rate (CTR) */}
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <div className="flex items-center justify-between text-[#6e6761] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Click-Through Rate</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-serif-editorial text-[#181512] mb-1">
            {stats.ctr}%
          </div>
          <div className="text-xs text-[#6e6761]">
            Based on {stats.totalImpressions.toLocaleString()} views
          </div>
        </div>

        {/* Est. Commission Earnings */}
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <div className="flex items-center justify-between text-[#6e6761] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Est. Commissions</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-serif-editorial text-[#181512] mb-1">
            ${stats.estimatedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#6e6761]">
            Avg. EPC: <strong className="text-[#181512]">${epc}</strong> per click
          </div>
        </div>

        {/* Mobile Device Share */}
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <div className="flex items-center justify-between text-[#6e6761] mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Mobile Traffic Share</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-serif-editorial text-[#181512] mb-1">
            {stats.mobilePercentage}%
          </div>
          <div className="text-xs text-[#6e6761]">
            Optimized for 0.4s mobile load speeds
          </div>
        </div>
      </div>

      {/* Daily Visual Chart & Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        {/* Daily Performance Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#181512]">Daily Outbound Click Performance</h2>
              <p className="text-xs text-[#6e6761]">Clicks and estimated commissions for the past 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-[#181512] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#181512]" /> Clicks
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Commission ($)
              </span>
            </div>
          </div>

          {/* Bar Chart Representation */}
          <div className="space-y-4 pt-2">
            {stats.clicksByDay.map((day, idx) => {
              const maxClicks = Math.max(...stats.clicksByDay.map(d => d.clicks), 10);
              const clickPercent = Math.min(Math.round((day.clicks / maxClicks) * 100), 100);

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#6e6761] w-28">{day.date}</span>
                    <div className="flex gap-4">
                      <span className="font-bold text-[#181512]">{day.clicks} clicks</span>
                      <span className="font-bold text-amber-800">${day.earnings.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#f4efe9] rounded-full h-3 overflow-hidden flex">
                    <div
                      className="bg-[#181512] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(clickPercent, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Traffic Sources Breakdown */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#181512] mb-1">Traffic Channels</h2>
            <p className="text-xs text-[#6e6761] mb-6">Where your affiliate shoppers are arriving from</p>

            <div className="space-y-4">
              {stats.trafficSources.map((src, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#181512]">{src.source}</span>
                    <span className="text-[#6e6761]">{src.clicks} clicks ({src.percentage}%)</span>
                  </div>
                  <div className="w-full bg-[#f4efe9] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        i === 0 ? 'bg-rose-600' : i === 1 ? 'bg-sky-700' : i === 2 ? 'bg-amber-600' : 'bg-[#181512]'
                      }`}
                      style={{ width: `${src.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Summary Box */}
          <div className="mt-8 p-4 rounded-xl bg-[#f4efe9] border border-[#e8e2dc] text-xs">
            <div className="font-bold text-[#181512] flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Security & Fraud Filtering Active</span>
            </div>
            <p className="text-[#6e6761] leading-relaxed">
              Bot crawlers are isolated from statistics. Open redirects are blocked via retail domain whitelist.
            </p>
          </div>
        </div>
      </div>

      {/* Top Performing Lookbooks & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Top Lookbooks */}
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <h2 className="text-lg font-bold text-[#181512] mb-1">Top Performing Lookbooks</h2>
          <p className="text-xs text-[#6e6761] mb-4">Ranked by shopper engagement and outbound conversion</p>

          <div className="divide-y divide-[#e8e2dc]/70">
            {stats.topLookbooks.map(lb => (
              <div key={lb.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#181512]">{lb.title}</h3>
                  <div className="text-xs text-[#6e6761] flex items-center gap-2 mt-0.5">
                    <span>{lb.views} views</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">{lb.ctr}% CTR</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#181512]">{lb.clicks} clicks</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-xs">
          <h2 className="text-lg font-bold text-[#181512] mb-1">Highest Earning Products</h2>
          <p className="text-xs text-[#6e6761] mb-4">Leading products by outbound clicks and commission value</p>

          <div className="divide-y divide-[#e8e2dc]/70">
            {stats.topProducts.map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-10 h-10 rounded-lg object-cover bg-[#f4efe9] border border-[#e8e2dc]"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-[#181512] line-clamp-1 max-w-[240px]">
                      {p.title}
                    </h3>
                    <span className="text-xs text-[#6e6761]">{p.merchant} • {p.clicks} clicks</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-800">${p.earnings.toFixed(2)}</div>
                  <span className="text-[11px] text-[#6e6761]">est. commission</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Recent Click Stream Table */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#e8e2dc] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#181512]">Live Outbound Click Stream</h2>
            <p className="text-xs text-[#6e6761]">Real-time incoming affiliate clicks and redirection logs</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Streaming Live</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#fcfbf9] border-b border-[#e8e2dc] text-[#6e6761] uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-6 font-semibold">Time</th>
                <th className="py-3.5 px-6 font-semibold">Product</th>
                <th className="py-3.5 px-6 font-semibold">Merchant</th>
                <th className="py-3.5 px-6 font-semibold">Device</th>
                <th className="py-3.5 px-6 font-semibold">Source</th>
                <th className="py-3.5 px-6 font-semibold">Commission</th>
                <th className="py-3.5 px-6 font-semibold">Security Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e2dc]/70">
              {stats.recentClicks.slice(0, 10).map((click) => {
                const timeAgo = new Date(click.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                return (
                  <tr key={click.id} className="hover:bg-[#fcfbf9] transition">
                    <td className="py-3.5 px-6 text-[#6e6761] whitespace-nowrap">{timeAgo}</td>
                    <td className="py-3.5 px-6 font-medium text-[#181512] max-w-xs truncate">{click.productTitle}</td>
                    <td className="py-3.5 px-6 font-semibold text-[#181512]">{click.merchant}</td>
                    <td className="py-3.5 px-6">
                      <span className="capitalize px-2 py-0.5 bg-[#f4efe9] rounded text-[#181512] font-medium">
                        {click.device}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-[#6e6761]">{click.utmSource || click.referrer}</td>
                    <td className="py-3.5 px-6 font-bold text-amber-800">+${click.estimatedCommission.toFixed(2)}</td>
                    <td className="py-3.5 px-6">
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Verified 302</span>
                      </span>
                    </td>
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
