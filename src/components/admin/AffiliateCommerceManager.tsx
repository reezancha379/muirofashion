import React, { useEffect, useState } from 'react';
import { AffiliateProgram, Merchant, RecordStatus } from '@/types';
import { api } from '@/lib/api';
import { Plus, Save, Trash2, Pencil, ExternalLink } from 'lucide-react';

interface Props { onChanged: () => void; }

export const AffiliateCommerceManager: React.FC<Props> = ({ onChanged }) => {
  const [programs, setPrograms] = useState<AffiliateProgram[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [editingProgram, setEditingProgram] = useState<AffiliateProgram | null>(null);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [programForm, setProgramForm] = useState({ name: '', network: '', website: '', defaultCommissionRate: 8, disclosure: '', status: 'active' as RecordStatus });
  const [merchantForm, setMerchantForm] = useState({ name: '', website: '', affiliateProgramId: '', status: 'active' as RecordStatus });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, m] = await Promise.all([api.getAffiliatePrograms(), api.getMerchants()]);
      setPrograms(p); setMerchants(m); setError(null);
    } catch (e: any) { setError(e.message || 'Failed to load affiliate configuration'); }
  };
  useEffect(() => { load(); }, []);

  const saveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProgram) await api.updateAffiliateProgram(editingProgram.id, programForm);
      else await api.createAffiliateProgram(programForm);
      setEditingProgram(null);
      setProgramForm({ name: '', network: '', website: '', defaultCommissionRate: 8, disclosure: '', status: 'active' });
      await load(); onChanged();
    } catch (e: any) { setError(e.message); }
  };

  const saveMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMerchant) await api.updateMerchant(editingMerchant.id, merchantForm);
      else await api.createMerchant(merchantForm);
      setEditingMerchant(null);
      setMerchantForm({ name: '', website: '', affiliateProgramId: '', status: 'active' });
      await load(); onChanged();
    } catch (e: any) { setError(e.message); }
  };

  const editProgram = (p: AffiliateProgram) => {
    setEditingProgram(p);
    setProgramForm({ name: p.name, network: p.network, website: p.website, defaultCommissionRate: p.defaultCommissionRate, disclosure: p.disclosure || '', status: p.status });
  };
  const editMerchant = (m: Merchant) => {
    setEditingMerchant(m);
    setMerchantForm({ name: m.name, website: m.website, affiliateProgramId: m.affiliateProgramId || '', status: m.status });
  };

  const removeProgram = async (id: string) => {
    if (!confirm('Delete this affiliate program?')) return;
    try { await api.deleteAffiliateProgram(id); await load(); onChanged(); } catch (e: any) { setError(e.message); }
  };
  const removeMerchant = async (id: string) => {
    if (!confirm('Delete this merchant?')) return;
    try { await api.deleteMerchant(id); await load(); onChanged(); } catch (e: any) { setError(e.message); }
  };

  const field = 'w-full rounded-xl border border-[#e8e2dc] px-3 py-2 text-sm outline-none focus:border-[#181512]';
  return <div className="space-y-8">
    <div>
      <h2 className="text-xl font-bold text-[#181512]">Affiliate Programs & Merchants</h2>
      <p className="text-xs text-[#6e6761] mt-1">Create partner programs once, then reuse their merchants across every product and lookbook.</p>
    </div>
    {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

    <section className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={saveProgram} className="bg-white border border-[#e8e2dc] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold">Affiliate program</h3>{editingProgram && <button type="button" onClick={() => setEditingProgram(null)} className="text-xs underline">Cancel</button>}</div>
        <input className={field} placeholder="Program name" value={programForm.name} onChange={e => setProgramForm({...programForm,name:e.target.value})} required />
        <input className={field} placeholder="Network / platform" value={programForm.network} onChange={e => setProgramForm({...programForm,network:e.target.value})} required />
        <input className={field} type="url" placeholder="Program website" value={programForm.website} onChange={e => setProgramForm({...programForm,website:e.target.value})} required />
        <input className={field} type="number" min="0" step="0.1" placeholder="Default commission %" value={programForm.defaultCommissionRate} onChange={e => setProgramForm({...programForm,defaultCommissionRate:Number(e.target.value)})} />
        <input className={field} placeholder="Disclosure text" value={programForm.disclosure} onChange={e => setProgramForm({...programForm,disclosure:e.target.value})} />
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#181512] text-white px-4 py-2 text-sm font-bold"><Save className="w-4 h-4" />{editingProgram ? 'Update program' : 'Add program'}</button>
      </form>

      <form onSubmit={saveMerchant} className="bg-white border border-[#e8e2dc] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold">Merchant</h3>{editingMerchant && <button type="button" onClick={() => setEditingMerchant(null)} className="text-xs underline">Cancel</button>}</div>
        <input className={field} placeholder="Merchant name" value={merchantForm.name} onChange={e => setMerchantForm({...merchantForm,name:e.target.value})} required />
        <input className={field} type="url" placeholder="Merchant website" value={merchantForm.website} onChange={e => setMerchantForm({...merchantForm,website:e.target.value})} required />
        <select className={field} value={merchantForm.affiliateProgramId} onChange={e => setMerchantForm({...merchantForm,affiliateProgramId:e.target.value})}>
          <option value="">No affiliate program</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#181512] text-white px-4 py-2 text-sm font-bold"><Save className="w-4 h-4" />{editingMerchant ? 'Update merchant' : 'Add merchant'}</button>
      </form>
    </section>

    <section className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white border border-[#e8e2dc] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#e8e2dc] font-bold">Programs ({programs.length})</div>
        {programs.map(p => <div key={p.id} className="p-4 border-b border-[#f0ece8] flex justify-between gap-3">
          <div><div className="font-semibold">{p.name}</div><div className="text-xs text-[#6e6761]">{p.network} · {p.defaultCommissionRate}%</div><a className="text-xs underline inline-flex items-center gap-1" href={p.website} target="_blank" rel="noreferrer">Website <ExternalLink className="w-3 h-3"/></a></div>
          <div className="flex gap-2"><button onClick={() => editProgram(p)} aria-label="Edit program"><Pencil className="w-4 h-4"/></button><button onClick={() => removeProgram(p.id)} aria-label="Delete program"><Trash2 className="w-4 h-4"/></button></div>
        </div>)}
      </div>
      <div className="bg-white border border-[#e8e2dc] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#e8e2dc] font-bold">Merchants ({merchants.length})</div>
        {merchants.map(m => <div key={m.id} className="p-4 border-b border-[#f0ece8] flex justify-between gap-3">
          <div><div className="font-semibold">{m.name}</div><div className="text-xs text-[#6e6761]">{programs.find(p => p.id === m.affiliateProgramId)?.name || 'No program'}</div><a className="text-xs underline inline-flex items-center gap-1" href={m.website} target="_blank" rel="noreferrer">Website <ExternalLink className="w-3 h-3"/></a></div>
          <div className="flex gap-2"><button onClick={() => editMerchant(m)} aria-label="Edit merchant"><Pencil className="w-4 h-4"/></button><button onClick={() => removeMerchant(m.id)} aria-label="Delete merchant"><Trash2 className="w-4 h-4"/></button></div>
        </div>)}
      </div>
    </section>
  </div>;
};
