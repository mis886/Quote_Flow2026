// New Product / Edit Product — shared form page.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import { PageHeader } from '../components/table';
import { upsertProduct, listCompounds, getProduct } from '../lib/db';
import type { Compound } from '../lib/types';

export function NewProduct() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();   // id present = edit mode
  const isEdit = !!id;

  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [code, setCode]             = useState('');
  const [name, setName]             = useState('');
  const [customerName, setCustomerName] = useState('');
  const [compoundId, setCompoundId] = useState('');
  const [mouldCode, setMouldCode]   = useState('');
  const [cavities, setCavities]     = useState('');
  const [tonnage, setTonnage]       = useState('');
  const [cureTempC, setCureTempC]   = useState('');
  const [cureTimeMin, setCureTimeMin] = useState('');
  const [shotWeightG, setShotWeightG] = useState('');
  const [setupTimeHrs, setSetupTimeHrs] = useState('0.5');
  const [finishRate, setFinishRate] = useState('');
  const [inspRate, setInspRate]     = useState('');
  const [pdiTimeHrs, setPdiTimeHrs] = useState('0.25');
  const [drawRef, setDrawRef]       = useState('');
  const [revision, setRevision]     = useState('R1');
  const [unitCost, setUnitCost]     = useState('');
  const [notes, setNotes]           = useState('');

  useEffect(() => {
    listCompounds().then(setCompounds);
    if (isEdit && id) {
      getProduct(id).then(p => {
        if (!p) return;
        setCode(p.code); setName(p.name);
        setCustomerName(p.customer_name || '');
        setCompoundId(p.compound_id || '');
        setMouldCode(p.mould_code || '');
        setCavities(p.cavities != null ? String(p.cavities) : '');
        setTonnage(p.tonnage != null ? String(p.tonnage) : '');
        setCureTempC(p.cure_temp_c != null ? String(p.cure_temp_c) : '');
        setCureTimeMin(p.cure_time_min != null ? String(p.cure_time_min) : '');
        setShotWeightG(p.shot_weight_g != null ? String(p.shot_weight_g) : '');
        setSetupTimeHrs(p.setup_time_hrs != null ? String(p.setup_time_hrs) : '0.5');
        setFinishRate(p.finish_rate != null ? String(p.finish_rate) : '');
        setInspRate(p.insp_rate != null ? String(p.insp_rate) : '');
        setPdiTimeHrs(p.pdi_time_hrs != null ? String(p.pdi_time_hrs) : '0.25');
        setDrawRef(p.draw_ref || ''); setRevision(p.revision || 'R1');
        setUnitCost(p.unit_cost != null ? String(p.unit_cost) : '');
        setNotes(p.notes || '');
      });
    }
  }, [isEdit, id]);

  const mouldRate = cureTimeMin && cavities
    ? ((60 / parseFloat(cureTimeMin)) * parseFloat(cavities)).toFixed(1)
    : null;

  const save = async () => {
    if (!code.trim() || !name.trim()) {
      alert('Code and Name are required.');
      return;
    }
    setSaving(true);
    try {
      const prodId = id || `P${Date.now().toString(36).toUpperCase()}`;
      const saved = await upsertProduct({
        id: prodId, code: code.trim(), name: name.trim(),
        customer_name: customerName.trim() || null,
        compound_id: compoundId || null,
        mould_code: mouldCode.trim() || null,
        cavities: cavities ? parseInt(cavities) : null,
        tonnage: tonnage ? parseInt(tonnage) : null,
        cure_temp_c: cureTempC ? parseInt(cureTempC) : null,
        cure_time_min: cureTimeMin ? parseInt(cureTimeMin) : null,
        shot_weight_g: shotWeightG ? parseInt(shotWeightG) : null,
        setup_time_hrs: parseFloat(setupTimeHrs) || 0.5,
        finish_rate: finishRate ? parseFloat(finishRate) : null,
        insp_rate: inspRate ? parseFloat(inspRate) : null,
        pdi_time_hrs: parseFloat(pdiTimeHrs) || 0.25,
        draw_ref: drawRef.trim() || null,
        revision: revision.trim() || 'R1',
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        notes: notes.trim() || null,
        is_active: true,
      });
      navigate(`/production/products/${saved.id}`);
    } catch (e) {
      console.error(e);
      alert('Save failed. See console.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <PageHeader
        module={isEdit ? `Production · Products · Edit` : 'Production · Products'}
        title={isEdit ? 'Edit Product' : 'New Product'}
        subtitle="Mould, cure, production rates, BOM linkage."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/production/products')} className="gap-1">
              <ArrowLeft size={12} /> Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={saving} className="gap-2">
              <Save size={13} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </>
        }
      />

      <div className="px-6 pb-7 pt-[14px] flex-1 overflow-y-auto">
        <div className="max-w-[780px] space-y-5">
          {/* Identity */}
          <Card title="Identity">
            <Grid2>
              <F label="Product Code *"><input className={inp} value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. PHE-M10-E70" title="Product code" /></F>
              <F label="Product Name *"><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PHE Gasket M10 EPDM" title="Product name" /></F>
              <F label="Primary Customer"><input className={inp} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" title="Customer" /></F>
              <F label="Drawing Reference"><input className={inp} value={drawRef} onChange={e => setDrawRef(e.target.value)} placeholder="DRW-PHE-M10-E70-R3" title="Drawing reference" /></F>
              <F label="Revision"><input className={inp} value={revision} onChange={e => setRevision(e.target.value)} placeholder="R1" title="Revision" /></F>
              <F label="Unit Cost (₹)"><input type="number" step="0.01" className={inp} value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" title="Unit cost" /></F>
            </Grid2>
          </Card>

          {/* Compound */}
          <Card title="Compound & Material">
            <F label="Compound">
              <select className={inp} value={compoundId} onChange={e => setCompoundId(e.target.value)} title="Compound">
                <option value="">— None selected —</option>
                {compounds.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </F>
          </Card>

          {/* Mould & Press */}
          <Card title="Mould & Press">
            <Grid2>
              <F label="Mould Code"><input className={inp} value={mouldCode} onChange={e => setMouldCode(e.target.value)} placeholder="M-018" title="Mould code" /></F>
              <F label="Cavities"><input type="number" className={inp} value={cavities} onChange={e => setCavities(e.target.value)} placeholder="2" title="Cavities" /></F>
              <F label="Press Tonnage (T)"><input type="number" className={inp} value={tonnage} onChange={e => setTonnage(e.target.value)} placeholder="100" title="Tonnage" /></F>
              <F label="Shot Weight (g)"><input type="number" className={inp} value={shotWeightG} onChange={e => setShotWeightG(e.target.value)} placeholder="85" title="Shot weight" /></F>
            </Grid2>
          </Card>

          {/* Cure */}
          <Card title="Cure Parameters">
            <Grid2>
              <F label="Cure Temperature (°C)"><input type="number" className={inp} value={cureTempC} onChange={e => setCureTempC(e.target.value)} placeholder="165" title="Cure temp" /></F>
              <F label="Cure Time (min)"><input type="number" className={inp} value={cureTimeMin} onChange={e => setCureTimeMin(e.target.value)} placeholder="18" title="Cure time" /></F>
            </Grid2>
            {mouldRate && (
              <div className="mt-2 bg-[#FAFAFA] border border-[#E4E5E6] rounded-[3px] px-3 py-2 text-[12px] text-[#666]">
                Moulding rate (auto): <strong className="text-[#0A6ED1]">{mouldRate} pcs/hr</strong>
                <span className="text-[#555] ml-1">(60 ÷ {cureTimeMin}) × {cavities} cav</span>
              </div>
            )}
          </Card>

          {/* Production rates */}
          <Card title="Production Rates (TAT / LSD Basis)">
            <Grid2>
              <F label="Setup Time (hrs/job)"><input type="number" step="0.25" className={inp} value={setupTimeHrs} onChange={e => setSetupTimeHrs(e.target.value)} placeholder="0.5" title="Setup time" /></F>
              <F label="Finishing Rate (pcs/person/hr)">
                <input type="number" step="0.5" className={inp} value={finishRate} onChange={e => setFinishRate(e.target.value)} placeholder="9" title="Finishing rate" />
                <Hint>From PMS sheet</Hint>
              </F>
              <F label="Inspection Rate (pcs/inspector/hr)">
                <input type="number" step="1" className={inp} value={inspRate} onChange={e => setInspRate(e.target.value)} placeholder="39" title="Inspection rate" />
              </F>
              <F label="PDI Time (hrs/job)"><input type="number" step="0.25" className={inp} value={pdiTimeHrs} onChange={e => setPdiTimeHrs(e.target.value)} placeholder="0.25" title="PDI time" /></F>
            </Grid2>
          </Card>

          {/* Notes */}
          <Card title="Notes">
            <textarea
              className={`${inp} resize-none h-[72px]`}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes…"
              title="Notes"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full font-sans text-[12.5px] text-[#111] bg-white border border-[#CCC] rounded-[3px] px-2.5 py-1.5 outline-none focus:border-[#0A6ED1] focus:ring-2 focus:ring-red-lt';
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E4E5E6] rounded-[3px]">
      <div className="px-4 py-2.5 border-b border-[#E4E5E6]">
        <div className="font-mono text-[9px] font-bold tracking-[2.5px] uppercase text-[#333]">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-mono font-bold tracking-wider uppercase text-[#333] mb-1">{label}</label>
      {children}
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-[#333] mt-1">{children}</div>;
}
