'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Building2,
  Briefcase,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  Save,
  Lock,
  AlertCircle,
  CheckCircle2,
  Phone,
  Calendar,
  CreditCard,
  FileText,
  Cigarette,
} from 'lucide-react';

export interface EditWorkerData {
  id: string;
  code: string;
  name: string;
  nickname: string;
  phone: string;
  nationalId: string;
  birthDate: string;
  gender: string;
  siteId: string | null;
  siteName: string;
  jobTitle: string;
  jobTitleId: string | null;
  status: string;
  contractType: string;
  basicSalary?: number;
  dailyWage?: number;
  fixedAllowances?: number;
  canteenCigarettePolicy: string;
  cigaretteBrand: string;
  insuranceNumber: string;
  insuranceStatus: string;
  medicalNotes: string;
}

interface EditWorkerClientProps {
  initialWorker: EditWorkerData;
  sites: { id: string; name: string }[];
  jobs: { id: string; name: string }[];
  isSuperAdmin: boolean;
  canViewFinances: boolean;
}

type TabType = 'basic' | 'job' | 'compensation' | 'insurance';

export function EditWorkerClient({
  initialWorker,
  sites,
  jobs,
  isSuperAdmin,
  canViewFinances,
}: EditWorkerClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(initialWorker.name);
  const [nickname, setNickname] = useState(initialWorker.nickname);
  const [phone, setPhone] = useState(initialWorker.phone);
  const [siteId, setSiteId] = useState(initialWorker.siteId || '');
  const [jobTitle, setJobTitle] = useState(initialWorker.jobTitle);
  const [status, setStatus] = useState(initialWorker.status);
  const [contractType, setContractType] = useState(initialWorker.contractType);

  // Compensation
  const [basicSalary, setBasicSalary] = useState(initialWorker.basicSalary ?? 0);
  const [dailyWage, setDailyWage] = useState(initialWorker.dailyWage ?? 0);
  const [fixedAllowances, setFixedAllowances] = useState(initialWorker.fixedAllowances ?? 0);
  const [canteenCigarettePolicy, setCanteenCigarettePolicy] = useState(initialWorker.canteenCigarettePolicy);
  const [cigaretteBrand, setCaretteBrand] = useState(initialWorker.cigaretteBrand);

  // Insurance
  const [insuranceNumber, setInsuranceNumber] = useState(initialWorker.insuranceNumber);
  const [insuranceStatus, setInsuranceStatus] = useState(initialWorker.insuranceStatus);
  const [medicalNotes, setMedicalNotes] = useState(initialWorker.medicalNotes);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: Record<string, any> = {
        name,
        nickname,
        phone,
        siteId: siteId || null,
        jobTitle,
        status,
        contractType,
        canteenCigarettePolicy,
        cigaretteBrand,
        insuranceNumber,
        insuranceStatus,
        medicalNotes,
      };

      if (isSuperAdmin) {
        payload.basicSalary = Number(basicSalary);
        payload.dailyWage = Number(dailyWage);
        payload.fixedAllowances = Number(fixedAllowances);
      }

      const res = await fetch(`/api/workers/${initialWorker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'فشل حفظ التعديلات');
      }

      setSuccessMsg('تم حفظ بيانات العامل بنجاح!');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'basic', label: 'البيانات الأساسية', icon: <User className="w-4 h-4" /> },
    { key: 'job', label: 'بيانات الوظيفة والموقع', icon: <Building2 className="w-4 h-4" /> },
    { key: 'compensation', label: 'المستحقات ومخصص السجائر', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'insurance', label: 'التأمينات والمستندات', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/workforce/directory"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                تعديل ملف العامل: {initialWorker.nickname}
              </h1>
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                #{initialWorker.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديث البيانات الشاملة مع قفل الرواتب السيادي والتوافق مع مسارات البوت (Flow 01.2.D)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-2xs disabled:opacity-50 min-h-[44px]"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 overflow-x-auto gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === tab.key
                ? 'border-orange-600 text-orange-600 bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-2xs">
        {/* Tab 1: Basic */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <User className="w-4 h-4 text-orange-600" />
              <span>البيانات الشخصية والتعريفية (المطابقة لـ Flow 01.1 و 01.2)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">اسم الشهرة (إلزامي للعرض)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] focus:ring-2 focus:ring-orange-500"
                  placeholder="مثال: أبو حميد"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">الاسم الرباعي الرسمي</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">رقم الهاتف الأساسي</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] focus:ring-2 focus:ring-orange-500"
                  placeholder="010XXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  الرقم القومي (محمي ومقفل)
                </label>
                <input
                  type="text"
                  value={initialWorker.nationalId}
                  disabled
                  className="w-full text-xs font-mono font-bold bg-slate-100 border border-slate-300 text-slate-600 rounded-lg p-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">تاريخ الميلاد</label>
                <input
                  type="text"
                  value={initialWorker.birthDate}
                  disabled
                  className="w-full text-xs bg-slate-100 border border-slate-300 text-slate-600 rounded-lg p-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">النوع</label>
                <input
                  type="text"
                  value={initialWorker.gender === 'FEMALE' ? 'أنثى' : 'ذكر'}
                  disabled
                  className="w-full text-xs bg-slate-100 border border-slate-300 text-slate-600 rounded-lg p-2.5 min-h-[44px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Job & Site */}
        {activeTab === 'job' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <Building2 className="w-4 h-4 text-orange-600" />
              <span>بيانات الموقع والوظيفة والتعاقد</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">الموقع أو المشروع</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] bg-white"
                >
                  <option value="">-- غير مسند لموقع --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">المسمى الوظيفي / المهنة</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px]"
                  placeholder="مثال: عامل تشغيل، سائق لودر"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نوع التعاقد</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] bg-white"
                >
                  <option value="DAILY_LABOR">عمالة يومية</option>
                  <option value="SEASONAL">موسمي / مؤقت</option>
                  <option value="PERMANENT">دائم / تعاقد رسمي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">الحالة التشغيلية</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] bg-white font-bold"
                >
                  <option value="ACTIVE">على رأس العمل (ACTIVE)</option>
                  <option value="ON_LEAVE">في إجازة رسمية (ON_LEAVE)</option>
                  <option value="SUSPENDED">موقوف مؤقتاً (SUSPENDED)</option>
                  <option value="TERMINATED">منهي خدمته (TERMINATED)</option>
                  <option value="BLACKLISTED">قائمة محظورة (BLACKLISTED)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Compensation & Cigarettes */}
        {activeTab === 'compensation' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <DollarSign className="w-4 h-4 text-orange-600" />
              <span>المستحقات والبدلات التعاقدية ومخصص السجائر</span>
            </h2>

            {!canViewFinances ? (
              <div className="p-6 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Lock className="w-5 h-5 text-amber-700" />
                  <span>🔒 حظر وسرية المستحقات التعاقدية (RBAC Strict Guard)</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800">
                  الرواتب الأساسية، الأجور اليومية، البدلات التعاقدية، وإجمالي المستحقات محجوبة خادمياً بالكامل عن مشرف الموقع وفقاً لدستور حوكمة المنظومة.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {!isSuperAdmin && (
                  <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>تعديل المستحقات التعاقدية مقصور حصرياً على مدير عام المنظومة (SUPER_ADMIN). العرض فقط متاح لك.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      الراتب الأساسي الشهري (ج.م)
                    </label>
                    <input
                      type="number"
                      value={basicSalary}
                      onChange={(e) => setBasicSalary(Number(e.target.value))}
                      disabled={!isSuperAdmin}
                      className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5 min-h-[44px] disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      الأجر اليومي (ج.م)
                    </label>
                    <input
                      type="number"
                      value={dailyWage}
                      onChange={(e) => setDailyWage(Number(e.target.value))}
                      disabled={!isSuperAdmin}
                      className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5 min-h-[44px] disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      البدلات الثابتة الشهرية (ج.م)
                    </label>
                    <input
                      type="number"
                      value={fixedAllowances}
                      onChange={(e) => setFixedAllowances(Number(e.target.value))}
                      disabled={!isSuperAdmin}
                      className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5 min-h-[44px] disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs font-semibold text-orange-900 flex items-center justify-between">
                  <span>إجمالي الراتب الشهري التقديري:</span>
                  <span className="font-mono text-sm font-bold">{Number(basicSalary) + Number(fixedAllowances)} ج.م</span>
                </div>
              </div>
            )}

            {/* Cigarettes Quota Section (Available to all admins) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Cigarette className="w-4 h-4 text-orange-600" />
                <span>مخصص وسحوبات الكانتين والسجائر (مقاصة غير نقدية)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">سياسة صرف السجائر</label>
                  <select
                    value={canteenCigarettePolicy}
                    onChange={(e) => setCanteenCigarettePolicy(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] bg-white"
                  >
                    <option value="NONE">بدون مخصص سجائر</option>
                    <option value="ONE_PACK_DAILY">علبة واحدة يومياً (سقف معتمد)</option>
                    <option value="FULL_COVERAGE">تغطية كاملة معتمدة</option>
                    <option value="CUSTOM">مخصص مخصص</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">صنف / ماركة السجائر المعتمدة</label>
                  <input
                    type="text"
                    value={cigaretteBrand}
                    onChange={(e) => setCaretteBrand(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px]"
                    placeholder="مثال: كليوباترا بوكس، إل إم أحمر"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Insurance & Docs */}
        {activeTab === 'insurance' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              <span>التأمينات الاجتماعية والملاحظات الطبية</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">الرقم التأميني (8-10 أرقام)</label>
                <input
                  type="text"
                  value={insuranceNumber}
                  onChange={(e) => setInsuranceNumber(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 min-h-[44px]"
                  placeholder="مثال: 12345678"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">الموقف من التأمينات</label>
                <select
                  value={insuranceStatus}
                  onChange={(e) => setInsuranceStatus(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 min-h-[44px] bg-white"
                >
                  <option value="غير مؤمن">غير مؤمن عليه</option>
                  <option value="مؤمن عليه حالياً">مؤمن عليه بالشركة</option>
                  <option value="مؤمن سابقاً">مؤمن سابقاً لدى جهة أخرى</option>
                  <option value="متفرغ">متفرغ / صاحب عمل</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">الملاحظات الطبية والسلامة الميدانية</label>
                <textarea
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
                  placeholder="أي أمراض مزمنة، حساسية، أو تنبيهات طبية..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
