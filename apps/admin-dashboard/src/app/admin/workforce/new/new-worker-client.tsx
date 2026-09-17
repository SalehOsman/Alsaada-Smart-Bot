'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Building2,
  Briefcase,
  CreditCard,
  Phone,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wallet,
  ShieldAlert,
  Package,
  HeartPulse,
  Send,
  Plus,
  Trash2,
  RotateCcw,
  ExternalLink,
  FileText,
  Upload,
} from 'lucide-react';
import type {
  SiteLookup,
  JobTitleLookup,
  CanteenCigaretteLookup,
  AccommodationLookup,
} from '@/lib/workforce-constants';
import {
  EGYPTIAN_GOVERNORATES,
  PAYMENT_METHODS,
  CONTRACT_TYPES,
  MILITARY_STATUSES,
  DRIVING_LICENSES,
  MARITAL_STATUSES,
  INSURANCE_STATUSES,
  CANTEEN_CIGARETTE_POLICIES,
  PPE_SHOE_SIZES,
  PPE_UNIFORM_SIZES,
} from '@/lib/workforce-constants';
import { cn } from '@/lib/utils';
import { normalizeDigits, extractFirstTwoNames } from '@alsaada/regional-engine';

interface NewWorkerClientProps {
  sites: SiteLookup[];
  jobTitles: JobTitleLookup[];
  canteenCigarettes: CanteenCigaretteLookup[];
  accommodations: AccommodationLookup[];
  userRole: string;
}

interface CustomAllowanceItem {
  id: string;
  title: string;
  amount: number;
}

interface ParsedNationalId {
  isValid: boolean;
  birthDate?: string;
  governorate?: string;
  governorateCode?: string;
  gender?: 'MALE' | 'FEMALE';
  genderArabic?: string;
  error?: string;
}

function parseNationalIdQuick(nid: string): ParsedNationalId {
  const clean = nid.trim().replace(/\D/g, '');
  if (clean.length !== 14) {
    return { isValid: false, error: 'الرقم القومي يجب أن يتكون من 14 رقماً بالضبط.' };
  }

  const centuryDigit = parseInt(clean.charAt(0), 10);
  if (centuryDigit !== 2 && centuryDigit !== 3) {
    return { isValid: false, error: 'الخانة الأولى غير صالحة (يجب أن تبدأ بـ 2 أو 3).' };
  }

  const yearPrefix = centuryDigit === 2 ? '19' : '20';
  const year = yearPrefix + clean.substring(1, 3);
  const month = clean.substring(3, 5);
  const day = clean.substring(5, 7);
  const govCode = clean.substring(7, 9);
  const genderCode = parseInt(clean.charAt(12), 10);

  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { isValid: false, error: 'تاريخ الميلاد المستخرج من الرقم القومي غير صحيح.' };
  }

  const gov = EGYPTIAN_GOVERNORATES[govCode] || 'غير محدد';
  const gender = genderCode % 2 === 0 ? 'FEMALE' : 'MALE';
  const genderArabic = gender === 'FEMALE' ? 'أنثى' : 'ذكر';
  const birthDate = `${year}-${month}-${day}`;

  return {
    isValid: true,
    birthDate,
    governorate: gov,
    governorateCode: govCode,
    gender,
    genderArabic,
  };
}

const LOCAL_STORAGE_DRAFT_KEY = 'alsaada_new_worker_draft_v1';

export function NewWorkerClient({
  sites,
  jobTitles,
  canteenCigarettes,
  accommodations,
  userRole,
}: NewWorkerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Section Collapse State
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    employment: true,
    compensation: true,
    payout: true,
    canteen: false,
    legal: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Form State
  const [idType, setIdType] = useState<'NATIONAL_ID' | 'PASSPORT'>('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');
  const [idCardExpiryDate, setIdCardExpiryDate] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [governorateCode, setGovernorateCode] = useState('01');
  const [address, setAddress] = useState('');

  // Employment
  const [siteId, setSiteId] = useState(sites[0]?.id || '');
  const [jobTitleId, setJobTitleId] = useState(jobTitles[0]?.id || '');
  const [contractType, setContractType] = useState('PERMANENT');
  const [hireDate, setHireDate] = useState(new Date().toISOString().substring(0, 10));
  const [shiftSystem, setShiftSystem] = useState('دورة قياسية (20+10)');

  // Compensation
  const [basicSalary, setBasicSalary] = useState(jobTitles[0]?.baseSalary || 0);
  const [additionalSalary, setAdditionalSalary] = useState(jobTitles[0]?.additionalSalary || 0);
  const [customAllowances, setCustomAllowances] = useState<CustomAllowanceItem[]>([]);
  const [newAllowanceTitle, setNewAllowanceTitle] = useState('');
  const [newAllowanceAmount, setNewAllowanceAmount] = useState('');

  // Payout
  const [paymentMethod, setPaymentMethod] = useState('CASH_SITE');
  const [phone, setPhone] = useState('');
  const [isSamePhoneWallet, setIsSamePhoneWallet] = useState(true);
  const [customWalletNumber, setCustomWalletNumber] = useState('');
  const [walletOwnerName, setWalletOwnerName] = useState('');
  const [instaPayHandle, setInstaPayHandle] = useState('');

  // Canteen & PPE & Camp
  const [canteenCigarettePolicy, setCanteenCigarettePolicy] = useState('NONE');
  const [canteenItemId, setCanteenItemId] = useState('');
  const [ppeShoeSize, setPpeShoeSize] = useState('43');
  const [ppeUniformSize, setPpeUniformSize] = useState('L');
  const [barracksUnit, setBarracksUnit] = useState('');
  const [bedNumber, setBedNumber] = useState('');

  // Legal & Emergency
  const [militaryStatus, setMilitaryStatus] = useState(MILITARY_STATUSES[0]?.value || '');
  const [drivingLicense, setDrivingLicense] = useState(DRIVING_LICENSES[0]?.value || '');
  const [maritalStatus, setMaritalStatus] = useState(MARITAL_STATUSES[0]?.value || '');
  const [insuranceStatus, setInsuranceStatus] = useState(INSURANCE_STATUSES[0]?.value || '');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Photo uploads (mock URIs or base64 previews)
  const [frontPhotoPreview, setFrontPhotoPreview] = useState<string | null>(null);
  const [backPhotoPreview, setBackPhotoPreview] = useState<string | null>(null);

  // Live Duplicate Radar State
  const [natIdDuplicate, setNatIdDuplicate] = useState<{ isDuplicate: boolean; message?: string } | null>(null);
  const [phoneDuplicate, setPhoneDuplicate] = useState<{ isDuplicate: boolean; message?: string } | null>(null);
  const [isValidatingNatId, setIsValidatingNatId] = useState(false);
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);

  // Success / Completion State
  const [createdResult, setCreatedResult] = useState<{
    worker: {
      id: string;
      code: string;
      name: string;
      nickname?: string;
      jobTitle: string;
      siteName: string;
      hireDate: string;
      grossSalary: number;
    };
    welcomeWhatsAppUrl?: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Draft Restore Banner
  const [hasStoredDraft, setHasStoredDraft] = useState(false);

  // Parse National ID on change
  const parsedId = idType === 'NATIONAL_ID' ? parseNationalIdQuick(idNumber) : { isValid: idNumber.length >= 6 };

  // Auto-populate when National ID is valid
  useEffect(() => {
    if (idType === 'NATIONAL_ID' && parsedId.isValid && parsedId.birthDate) {
      setBirthDate(parsedId.birthDate);
      if (parsedId.governorateCode) setGovernorateCode(parsedId.governorateCode);
      if (parsedId.gender) setGender(parsedId.gender);
    }
  }, [idNumber, idType]);

  // When jobTitleId changes, update base/additional salary and shiftSystem
  const handleJobChange = (jobId: string) => {
    setJobTitleId(jobId);
    const selected = jobTitles.find((j) => j.id === jobId);
    if (selected) {
      setBasicSalary(selected.baseSalary);
      setAdditionalSalary(selected.additionalSalary);
      if (selected.shiftNature) {
        setShiftSystem(selected.shiftNature);
      }
    }
  };

  // Smart Nickname Suggestion
  const handleSuggestNickname = () => {
    if (!fullName.trim()) return;
    const suggested = extractFirstTwoNames(fullName.trim());
    if (suggested) {
      setNickname(suggested);
    }
  };

  // Live Inline Duplicate Radar for National ID (Debounced 400ms)
  useEffect(() => {
    const clean = idNumber.trim().replace(/\D/g, '');
    if (idType === 'NATIONAL_ID' && clean.length === 14) {
      setIsValidatingNatId(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch('/api/workers/validate-unique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nationalId: clean }),
          });
          const data = await res.json();
          if (data.isDuplicate) {
            setNatIdDuplicate({ isDuplicate: true, message: data.message });
          } else {
            setNatIdDuplicate({ isDuplicate: false });
          }
        } catch {
          setNatIdDuplicate(null);
        } finally {
          setIsValidatingNatId(false);
        }
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setNatIdDuplicate(null);
    }
  }, [idNumber, idType]);

  // Live Inline Duplicate Radar for Phone Number (Debounced 400ms)
  useEffect(() => {
    const clean = phone.trim().replace(/\D/g, '');
    if (clean.length === 11) {
      setIsValidatingPhone(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch('/api/workers/validate-unique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: clean }),
          });
          const data = await res.json();
          if (data.isDuplicate) {
            setPhoneDuplicate({ isDuplicate: true, message: data.message });
          } else {
            setPhoneDuplicate({ isDuplicate: false });
          }
        } catch {
          setPhoneDuplicate(null);
        } finally {
          setIsValidatingPhone(false);
        }
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setPhoneDuplicate(null);
    }
  }, [phone]);

  // Check for stored draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);
      if (saved) {
        setHasStoredDraft(true);
      }
    } catch {}
  }, []);

  // Auto-Save Draft to LocalStorage
  useEffect(() => {
    if (createdResult) return; // don't save draft after creation
    const timer = setTimeout(() => {
      if (fullName || idNumber || phone) {
        const draft = {
          idType,
          idNumber,
          fullName,
          nickname,
          birthDate,
          gender,
          governorateCode,
          address,
          siteId,
          jobTitleId,
          contractType,
          hireDate,
          shiftSystem,
          basicSalary,
          additionalSalary,
          customAllowances,
          paymentMethod,
          phone,
          isSamePhoneWallet,
          customWalletNumber,
          walletOwnerName,
          instaPayHandle,
          canteenCigarettePolicy,
          canteenItemId,
          ppeShoeSize,
          ppeUniformSize,
          barracksUnit,
          bedNumber,
          militaryStatus,
          drivingLicense,
          maritalStatus,
          insuranceStatus,
          insuranceNumber,
          emergencyContactName,
          emergencyPhone,
          medicalNotes,
          updatedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify(draft));
        } catch {}
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    idType, idNumber, fullName, nickname, birthDate, gender, governorateCode, address,
    siteId, jobTitleId, contractType, hireDate, shiftSystem, basicSalary, additionalSalary,
    customAllowances, paymentMethod, phone, isSamePhoneWallet, customWalletNumber,
    walletOwnerName, instaPayHandle, canteenCigarettePolicy, canteenItemId,
    ppeShoeSize, ppeUniformSize, barracksUnit, bedNumber, militaryStatus, drivingLicense,
    maritalStatus, insuranceStatus, insuranceNumber, emergencyContactName, emergencyPhone,
    medicalNotes, createdResult
  ]);

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.idType) setIdType(draft.idType);
        if (draft.idNumber) setIdNumber(draft.idNumber);
        if (draft.fullName) setFullName(draft.fullName);
        if (draft.nickname) setNickname(draft.nickname);
        if (draft.birthDate) setBirthDate(draft.birthDate);
        if (draft.gender) setGender(draft.gender);
        if (draft.governorateCode) setGovernorateCode(draft.governorateCode);
        if (draft.address) setAddress(draft.address);
        if (draft.siteId) setSiteId(draft.siteId);
        if (draft.jobTitleId) setJobTitleId(draft.jobTitleId);
        if (draft.contractType) setContractType(draft.contractType);
        if (draft.hireDate) setHireDate(draft.hireDate);
        if (draft.shiftSystem) setShiftSystem(draft.shiftSystem);
        if (draft.basicSalary !== undefined) setBasicSalary(draft.basicSalary);
        if (draft.additionalSalary !== undefined) setAdditionalSalary(draft.additionalSalary);
        if (draft.customAllowances) setCustomAllowances(draft.customAllowances);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        if (draft.phone) setPhone(draft.phone);
        if (draft.isSamePhoneWallet !== undefined) setIsSamePhoneWallet(draft.isSamePhoneWallet);
        if (draft.customWalletNumber) setCustomWalletNumber(draft.customWalletNumber);
        if (draft.walletOwnerName) setWalletOwnerName(draft.walletOwnerName);
        if (draft.instaPayHandle) setInstaPayHandle(draft.instaPayHandle);
        if (draft.canteenCigarettePolicy) setCanteenCigarettePolicy(draft.canteenCigarettePolicy);
        if (draft.canteenItemId) setCanteenItemId(draft.canteenItemId);
        if (draft.ppeShoeSize) setPpeShoeSize(draft.ppeShoeSize);
        if (draft.ppeUniformSize) setPpeUniformSize(draft.ppeUniformSize);
        if (draft.barracksUnit) setBarracksUnit(draft.barracksUnit);
        if (draft.bedNumber) setBedNumber(draft.bedNumber);
        if (draft.militaryStatus) setMilitaryStatus(draft.militaryStatus);
        if (draft.drivingLicense) setDrivingLicense(draft.drivingLicense);
        if (draft.maritalStatus) setMaritalStatus(draft.maritalStatus);
        if (draft.insuranceStatus) setInsuranceStatus(draft.insuranceStatus);
        if (draft.insuranceNumber) setInsuranceNumber(draft.insuranceNumber);
        if (draft.emergencyContactName) setEmergencyContactName(draft.emergencyContactName);
        if (draft.emergencyPhone) setEmergencyPhone(draft.emergencyPhone);
        if (draft.medicalNotes) setMedicalNotes(draft.medicalNotes);
        setHasStoredDraft(false);
      }
    } catch {}
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_DRAFT_KEY);
      setHasStoredDraft(false);
    } catch {}
  };

  // Add Custom Allowance
  const handleAddAllowance = () => {
    if (!newAllowanceTitle.trim() || !newAllowanceAmount || Number(newAllowanceAmount) <= 0) return;
    setCustomAllowances((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        title: newAllowanceTitle.trim(),
        amount: Number(newAllowanceAmount),
      },
    ]);
    setNewAllowanceTitle('');
    setNewAllowanceAmount('');
  };

  const handleRemoveAllowance = (id: string) => {
    setCustomAllowances((prev) => prev.filter((a) => a.id !== id));
  };

  // Calculations for Visual Mini-Payslip
  const totalAllowances = customAllowances.reduce((acc, curr) => acc + curr.amount, 0);
  const totalGrossSalary = Number(basicSalary || 0) + Number(additionalSalary || 0) + totalAllowances;

  // Selected site cigarette items
  const siteCigaretteItems = canteenCigarettes.filter((c) => !c.siteId || c.siteId === siteId);

  // Handle Photo Preview
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isFront: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (isFront) setFrontPhotoPreview(reader.result as string);
      else setBackPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!fullName.trim()) {
      setSubmitError('الاسم الرباعي الرسمي مطلوب.');
      return;
    }
    if (!idNumber.trim() || !parsedId.isValid) {
      setSubmitError('يرجى التأكد من صحة رقم بطاقة الرقم القومي (14 رقماً).');
      return;
    }
    if (natIdDuplicate?.isDuplicate) {
      setSubmitError('لا يمكن التسجيل: الرقم القومي مسجل مسبقاً لعامل آخر.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length !== 11) {
      setSubmitError('رقم الهاتف المحمول يجب أن يتكون من 11 رقماً.');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: fullName.trim(),
          nickname: nickname.trim() || undefined,
          idType,
          idNumber: idNumber.trim(),
          phone: phone.trim(),
          siteId,
          jobTitleId,
          birthDate: birthDate || undefined,
          gender,
          governorateCode,
          address: address.trim() || undefined,
          hireDate,
          contractType,
          shiftSystem,
          basicSalary: Number(basicSalary) || 0,
          additionalSalary: Number(additionalSalary) || 0,
          customAllowances,
          paymentMethod,
          accountNumber: isSamePhoneWallet ? phone.trim() : (customWalletNumber.trim() || undefined),
          walletType: paymentMethod !== 'CASH_SITE' ? paymentMethod : undefined,
          walletOwnerName: walletOwnerName.trim() || undefined,
          instaPayHandle: instaPayHandle.trim() || undefined,
          canteenCigarettePolicy,
          canteenItemId: canteenCigarettePolicy !== 'NONE' ? canteenItemId : undefined,
          drivingLicense,
          militaryStatus,
          maritalStatus,
          insuranceStatus,
          insuranceNumber: insuranceNumber.trim() || undefined,
          ppeShoeSize,
          ppeUniformSize,
          barracksUnit: barracksUnit.trim() || undefined,
          bedNumber: bedNumber.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyPhone: emergencyPhone.trim() || undefined,
          medicalNotes: medicalNotes.trim() || undefined,
          idCardExpiryDate: idCardExpiryDate || undefined,
        };

        const res = await fetch('/api/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'فشل في تسجيل العامل.');
        }

        // Clean draft on success
        try {
          localStorage.removeItem(LOCAL_STORAGE_DRAFT_KEY);
        } catch {}

        setCreatedResult(data);
      } catch (err: any) {
        setSubmitError(err.message || 'حدث خطأ غير متوقع أثناء حفظ العامل.');
      }
    });
  };

  // Render Post-Save Success Completion Screen
  if (createdResult) {
    const { worker, welcomeWhatsAppUrl } = createdResult;
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-md p-6 text-center space-y-5">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-mono tracking-wider">
              {worker.code}
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">{worker.name}</h2>
            {worker.nickname && (
              <p className="text-xs text-orange-700 dark:text-orange-400 font-semibold mt-0.5">«{worker.nickname}»</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              تم تسجيل وتعيين العامل بنجاح وربطه بالموقع الميداني وقيد مستحقاته.
            </p>
          </div>

          {/* Quick Details Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 grid grid-cols-2 gap-3 text-right text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">الموقع المسند:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{worker.siteName}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">المسمى المهني:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{worker.jobTitle}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">تاريخ المباشرة:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{new Date(worker.hireDate).toLocaleDateString('ar-EG')}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">إجمالي الراتب المعتمد:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{worker.grossSalary.toLocaleString('ar-EG')} ج.م / شهر</span>
            </div>
          </div>

          {/* Completion Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {welcomeWhatsAppUrl && (
              <a
                href={welcomeWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm min-h-[44px]"
              >
                <Send className="w-4 h-4" />
                <span>إرسال إشعار الترحيب وبيانات التعيين للعامل عبر واتساب</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                setCreatedResult(null);
                setFullName('');
                setIdNumber('');
                setNickname('');
                setPhone('');
                setCustomAllowances([]);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>تسجيل وتعيين عامل آخر فوراً</span>
            </button>

            <Link
              href="/admin/workforce/directory"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              <span>العودة لدليل وسجل العاملين</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/workforce/directory"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span>معالج تسجيل وتعيين عامل جديد</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              إدخال شامل لكافة حقول العامل، التحقق اللحظي، وربط الأجور والموقع الميداني.
            </p>
          </div>
        </div>
      </div>

      {/* Draft Auto-Restore Notification */}
      {hasStoredDraft && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>يوجد مسودة سابقة محفوظة تلقائياً في المتصفح. هل ترغب في استعادتها؟</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
            >
              استعادة المسودة
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              تجاهل ومسح
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {submitError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-4 rounded-xl flex items-center gap-3 animate-fade-in text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-semibold">{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* =========================================================
            SECTION 1: الهوية والبيانات الشخصية
           ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('identity')}
            className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>1. الهوية والبيانات الشخصية الأساسية</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                {idNumber && fullName ? 'مكتمل' : 'إلزامي'}
              </span>
              {openSections.identity ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.identity && (
            <div className="p-5 space-y-4">
              {/* ID Type & Number */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع وثيقة الإثبات *</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="NATIONAL_ID">🇪🇬 بطاقة الرقم القومي (مصري)</option>
                    <option value="PASSPORT">🌍 جواز سفر (وافد / أجنبي)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>رقم الهوية / الرقم القومي (14 رقماً) *</span>
                    {isValidatingNatId && <span className="text-[10px] text-orange-600 animate-pulse">جاري التحقق عبر الرادار...</span>}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="29XXXXXXXXXXXX"
                    value={idNumber}
                    onChange={(e) => setIdNumber(normalizeDigits(e.target.value))}
                    className={cn(
                      'w-full text-sm font-mono tracking-wider px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500',
                      natIdDuplicate?.isDuplicate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    )}
                  />

                  {/* Inline Duplicate Radar Result */}
                  {natIdDuplicate?.isDuplicate && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{natIdDuplicate.message}</span>
                    </p>
                  )}
                  {natIdDuplicate && !natIdDuplicate.isDuplicate && (
                    <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>الرقم القومي سليم ومتاح للتسجيل الفوري.</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Names & Nickname with Smart Auto-Suggest */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الرباعي الرسمي بالبطاقة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الله محمود حسنين"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">اسم الشهرة الميداني (إلزامي للعرض) *</label>
                    {fullName.trim().length > 3 && (
                      <button
                        type="button"
                        onClick={handleSuggestNickname}
                        className="text-[10px] text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>اقتراح من أول اسمين</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أبو حميد"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-orange-50/20 font-medium"
                  />
                </div>
              </div>

              {/* BirthDate, Gender & Governorate */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ الميلاد *</label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">النوع *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="MALE">ذكر</option>
                    <option value="FEMALE">أنثى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">محافظة الإقامة *</label>
                  <select
                    value={governorateCode}
                    onChange={(e) => setGovernorateCode(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(EGYPTIAN_GOVERNORATES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} - {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address & Expiry */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">العنوان ومحل الإقامة التفصيلي</label>
                  <input
                    type="text"
                    placeholder="المركز، القرية / الشارع، رقم العقار"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ انتهاء سريان البطاقة</label>
                  <input
                    type="date"
                    value={idCardExpiryDate}
                    onChange={(e) => setIdCardExpiryDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>
              </div>

              {/* Optional ID Photos Upload & Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة وجه البطاقة (اختياري)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, true)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                  />
                  {frontPhotoPreview && (
                    <img src={frontPhotoPreview} alt="وجه البطاقة" className="mt-2 h-20 rounded border object-cover" />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة ظهر البطاقة (اختياري)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, false)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                  />
                  {backPhotoPreview && (
                    <img src={backPhotoPreview} alt="ظهر البطاقة" className="mt-2 h-20 rounded border object-cover" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            SECTION 2: التعيين والتشغيل الميداني
           ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('employment')}
            className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>2. التعيين والتشغيل الميداني والموقع</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                {siteId && jobTitleId ? 'مكتمل' : 'إلزامي'}
              </span>
              {openSections.employment ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.employment && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الموقع والمشروع الميداني المسند *</label>
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المسمى المهني / الوظيفة *</label>
                  <select
                    value={jobTitleId}
                    onChange={(e) => handleJobChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    {jobTitles.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name} ({j.code}) — {j.baseSalary} ج.م
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع التعاقد *</label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {CONTRACT_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ المباشرة وبدء العمل *</label>
                  <input
                    type="date"
                    required
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">دورة العمل والراحة الميدانية *</label>
                  <input
                    type="text"
                    value={shiftSystem}
                    onChange={(e) => setShiftSystem(e.target.value)}
                    placeholder="مثال: دورة قياسية (20+10)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            SECTION 3: هيكل الأجور والبدلات (حظر الأجر اليومي تماماً)
           ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('compensation')}
            className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <Wallet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>3. هيكل الأجور والبدلات الثابتة المسماة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {totalGrossSalary.toLocaleString('ar-EG')} ج.م
              </span>
              {openSections.compensation ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.compensation && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الراتب الأساسي المعتمد (ج.م / شهر) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full text-sm font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">يُملأ تلقائياً من الوظيفة ويمكن تخصيصه لهذا العامل.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الراتب الإضافي / الحافز الشهري (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    value={additionalSalary}
                    onChange={(e) => setAdditionalSalary(Number(e.target.value))}
                    className="w-full text-sm font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">إضافي شهري موروث من مصفوفة الوظيفة.</p>
                </div>
              </div>

              {/* Custom Allowances Management */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">البدلات الثابتة المسماة (حسب اتفاق العامل)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">تظهر في قسيمة الراتب باسمها المستقل</span>
                </div>

                {customAllowances.length > 0 && (
                  <div className="space-y-1.5">
                    {customAllowances.map((ca) => (
                      <div key={ca.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-750 text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{ca.title}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">+{ca.amount.toLocaleString('ar-EG')} ج.م</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllowance(ca.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="اسم البدل (مثال: بدل موقع نائي)"
                    value={newAllowanceTitle}
                    onChange={(e) => setNewAllowanceTitle(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="المبلغ (ج.م)"
                    value={newAllowanceAmount}
                    onChange={(e) => setNewAllowanceAmount(e.target.value)}
                    className="w-28 text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddAllowance}
                    className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>

              {/* Visual Mini-Payslip Breakdown Card */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800/60 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-right w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-orange-900 dark:text-orange-200 block">📊 ملخص هيكل الأجر الشهري المعتمد (Mini-Payslip):</span>
                  <div className="text-xs text-orange-800 dark:text-orange-300 flex flex-wrap items-center gap-2">
                    <span>أساسي: <strong>{basicSalary}</strong> ج.م</span>
                    <span>+ إضافي: <strong>{additionalSalary}</strong> ج.م</span>
                    {totalAllowances > 0 && <span>+ بدلات: <strong>{totalAllowances}</strong> ج.م</span>}
                    <span className="text-orange-950 dark:text-orange-100 font-bold">| الدورة: {shiftSystem}</span>
                  </div>
                </div>
                <div className="text-right sm:text-left shrink-0">
                  <span className="text-[10px] text-orange-700 dark:text-orange-400 block">إجمالي الراتب الشهري:</span>
                  <span className="text-xl font-black text-orange-900 dark:text-orange-200 font-mono">
                    {totalGrossSalary.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            SECTION 4: وسيلة الصرف والبيانات المالية
           ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('payout')}
            className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <Phone className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>4. وسيلة الصرف وأرقام التواصل والمحفظة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                {phone ? 'مكتمل' : 'إلزامي'}
              </span>
              {openSections.payout ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.payout && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>رقم الهاتف المحمول (للتواصل والواتساب) *</span>
                    {isValidatingPhone && <span className="text-[10px] text-orange-600 dark:text-orange-400 animate-pulse">فحص الرادار...</span>}
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={11}
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(normalizeDigits(e.target.value))}
                    className={cn(
                      'w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 font-mono font-medium',
                      phoneDuplicate?.isDuplicate
                        ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/20'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100'
                    )}
                  />
                  {phoneDuplicate?.isDuplicate && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{phoneDuplicate.message}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">طريقة صرف المستحقات والرواتب *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {paymentMethod !== 'CASH_SITE' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750 rounded-xl space-y-3">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="font-bold text-slate-700 dark:text-slate-200">رقم المحفظة / التحويل:</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={isSamePhoneWallet}
                        onChange={() => setIsSamePhoneWallet(true)}
                        className="text-orange-600"
                      />
                      <span className="text-slate-700 dark:text-slate-300">نفس رقم الموبايل ({phone || 'غير مسجل'})</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!isSamePhoneWallet}
                        onChange={() => setIsSamePhoneWallet(false)}
                        className="text-orange-600"
                      />
                      <span className="text-slate-700 dark:text-slate-300">رقم مخصص آخر</span>
                    </label>
                  </div>

                  {!isSamePhoneWallet && (
                    <div>
                      <input
                        type="text"
                        placeholder="أدخل رقم المحفظة أو الحساب البنكي المعتمد"
                        value={customWalletNumber}
                        onChange={(e) => setCustomWalletNumber(normalizeDigits(e.target.value))}
                        className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">اسم صاحب المحفظة / الحساب (إن وجد)</label>
                      <input
                        type="text"
                        placeholder="اسم الشخص المسجل باسمه الحساب"
                        value={walletOwnerName}
                        onChange={(e) => setWalletOwnerName(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">معرف إنستاباي (InstaPay Handle)</label>
                      <input
                        type="text"
                        placeholder="user@instapay"
                        value={instaPayHandle}
                        onChange={(e) => setInstaPayHandle(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================
            SECTION 5: الكانتين ومهمات الوقاية والسكن
           ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('canteen')}
            className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>5. الكانتين والسجائر ومهمات السلامة وسكن الموقع</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">اختياري</span>
              {openSections.canteen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.canteen && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">سياسة صرف السجائر من الكانتين</label>
                  <select
                    value={canteenCigarettePolicy}
                    onChange={(e) => setCanteenCigarettePolicy(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                  >
                    {CANTEEN_CIGARETTE_POLICIES.map((cp) => (
                      <option key={cp.value} value={cp.value}>
                        {cp.label}
                      </option>
                    ))}
                  </select>
                </div>

                {canteenCigarettePolicy !== 'NONE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">صنف السجائر المعتمد بالمخزن</label>
                    <select
                      value={canteenItemId}
                      onChange={(e) => setCanteenItemId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-medium"
                    >
                      <option value="">-- اختر الصنف من مخزن الكانتين --</option>
                      {siteCigaretteItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.sellingPrice} ج.م / علبة)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* PPE Uniform and Shoe Size */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">مقاس حذاء السيفتي</label>
                  <select
                    value={ppeShoeSize}
                    onChange={(e) => setPpeShoeSize(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  >
                    {PPE_SHOE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        مقاس {size}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">مقاس الأفرول الميداني</label>
                  <select
                    value={ppeUniformSize}
                    onChange={(e) => setPpeUniformSize(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
                  >
                    {PPE_UNIFORM_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">وحدة السكن / الكرفان</label>
                  <input
                    type="text"
                    placeholder="CRV-01"
                    value={barracksUnit}
                    onChange={(e) => setBarracksUnit(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">رقم السرير</label>
                  <input
                    type="text"
                    placeholder="Bed 2"
                    value={bedNumber}
                    onChange={(e) => setBedNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            SECTION 6: المحددات القانونية والتأمينية والطوارئ
           ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('legal')}
            className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-right cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>6. المحددات القانونية، التأمينات، والطوارئ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">اختياري</span>
              {openSections.legal ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.legal && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الموقف التجنيدي</label>
                  <select
                    value={militaryStatus}
                    onChange={(e) => setMilitaryStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {MILITARY_STATUSES.map((ms) => (
                      <option key={ms.value} value={ms.value}>
                        {ms.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">رخصة القيادة</label>
                  <select
                    value={drivingLicense}
                    onChange={(e) => setDrivingLicense(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {DRIVING_LICENSES.map((dl) => (
                      <option key={dl.value} value={dl.value}>
                        {dl.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الحالة الاجتماعية</label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {MARITAL_STATUSES.map((ms) => (
                      <option key={ms.value} value={ms.value}>
                        {ms.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الموقف من التأمينات الاجتماعية</label>
                  <select
                    value={insuranceStatus}
                    onChange={(e) => setInsuranceStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {INSURANCE_STATUSES.map((is) => (
                      <option key={is.value} value={is.value}>
                        {is.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الرقم التأميني (إن وجد)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="رقم تأميني من 8 إلى 10 أرقام"
                    value={insuranceNumber}
                    onChange={(e) => setInsuranceNumber(normalizeDigits(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">اسم شخص للطوارئ وصلة القرابة</label>
                  <input
                    type="text"
                    placeholder="مثال: محمود حسنين (الأخ)"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">هاتف الطوارئ</label>
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(normalizeDigits(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Medical Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">الملاحظات الطبية والأمراض المزمنة (إن وجدت)</label>
                <textarea
                  rows={2}
                  placeholder="حساسية، أمراض مزمنة، فصيلة الدم، إلخ..."
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sticky Action Floating Dock (Plan 56 Phase 4.3) */}
        <div className="sticky bottom-4 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {(['identity', 'employment', 'compensation', 'payout', 'canteen', 'legal'] as const).map((secKey, idx) => {
                const isOpen = openSections[secKey];
                return (
                  <button
                    key={secKey}
                    type="button"
                    onClick={() => toggleSection(secKey)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer',
                      isOpen
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                    title={`قسم ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
              6 أقسام متكاملة
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/workforce/directory"
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[40px] inline-flex items-center justify-center"
            >
              إلغاء والعودة
            </Link>
            <button
              type="submit"
              disabled={isPending || !parsedId.isValid || !fullName.trim() || !phone.trim() || natIdDuplicate?.isDuplicate}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-orange-600/20 min-h-[40px] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <span>جاري حفظ وتشفير بيانات العامل...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد التعيين وحفظ العامل رسمياً</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
