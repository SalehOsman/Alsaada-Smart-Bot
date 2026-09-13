'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

interface ParsedNationalId {
  isValid: boolean;
  birthDate?: string;
  governorate?: string;
  gender?: string;
  error?: string;
}

const EGYPTIAN_GOVERNORATES: Record<string, string> = {
  '01': 'القاهرة',
  '02': 'الإسكندرية',
  '03': 'بورسعيد',
  '04': 'السويس',
  '11': 'دمياط',
  '12': 'الدقهلية',
  '13': 'الشرقية',
  '14': 'القليوبية',
  '15': 'كفر الشيخ',
  '16': 'الغربية',
  '17': 'المنوفية',
  '18': 'البحيرة',
  '19': 'الإسماعيلية',
  '21': 'الجيزة',
  '22': 'بني سويف',
  '23': 'الفيوم',
  '24': 'المنيا',
  '25': 'أسيوط',
  '26': 'سوهاج',
  '27': 'قنا',
  '28': 'أسوان',
  '29': 'الأقصر',
  '31': 'البحر الأحمر',
  '32': 'الوادي الجديد',
  '33': 'مطروح',
  '34': 'شمال سيناء',
  '35': 'جنوب سيناء',
  '88': 'خارج الجمهورية',
};

function parseNationalIdQuick(nid: string): ParsedNationalId {
  const clean = nid.trim();
  if (!/^\d{14}$/.test(clean)) {
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
  const gender = genderCode % 2 === 0 ? 'أنثى' : 'ذكر';
  const birthDate = `${year}-${month}-${day}`;

  return {
    isValid: true,
    birthDate,
    governorate: gov,
    gender,
  };
}

export default function NewWorkerPage() {
  const router = useRouter();
  const [nationalId, setNationalId] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [site, setSite] = useState('مشروع العاصمة الإدارية');
  const [job, setJob] = useState('نجار مسلح');
  const [dailyWage, setDailyWage] = useState('450');
  const [isSuccess, setIsSuccess] = useState(false);

  const parsedId = parseNationalIdQuick(nationalId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedId.isValid || !fullName || !nickname || !phone) {
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      router.push('/admin/workforce/directory');
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/workforce/directory"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-600" />
              <span>معالج تسجيل وتعيين عامل جديد</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              إدخال بيانات العامل وفحص الرقم القومي المصري لحظياً وربطه بالموقع الميداني.
            </p>
          </div>
        </div>
      </div>

      {/* Success Alert */}
      {isSuccess && (
        <div className="bg-orange-50 border border-orange-300 text-orange-800 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">تم تسجيل وتعيين العامل بنجاح!</p>
            <p className="text-xs text-orange-700">تم حفظ السند برقم #1006، جاري التحويل لدليل العاملين...</p>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
        {/* National ID Engine Section */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-orange-600" />
              <span>الرقم القومي المصري (14 رقماً) *</span>
            </label>
            <span className="text-[11px] text-slate-500">فحص فوري عبر محرك الرقم القومي</span>
          </div>

          <input
            type="text"
            required
            maxLength={14}
            placeholder="مثال: 29201011234567"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
            className="w-full text-base font-mono tracking-widest px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-slate-900 bg-white"
          />

          {nationalId.length > 0 && (
            <div>
              {parsedId.isValid ? (
                <div className="bg-orange-50/80 border border-orange-200 p-3 rounded-lg flex items-center justify-between text-xs text-orange-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                    <span className="font-semibold">رقم قومي سليم</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span>الميلاد: <strong>{parsedId.birthDate}</strong></span>
                    <span>المحافظة: <strong>{parsedId.governorate}</strong></span>
                    <span>النوع: <strong>{parsedId.gender}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parsedId.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Basic Names & Nickname */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الاسم الرباعي الرسمي بالبطاقة *
            </label>
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
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>اسم الشهرة الميداني (إلزامي للعرض) *</span>
              <span className="text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">معتمد دستورياً</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: أبو حميد النجار"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-orange-50/20"
            />
          </div>
        </div>

        {/* Contact & Wage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              رقم الهاتف المحمول (للتواصل والواتساب) *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                maxLength={11}
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full text-xs pr-9 pl-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الأجر اليومي المتفق عليه (ج.م / يوم) *
            </label>
            <input
              type="number"
              required
              min={100}
              max={5000}
              value={dailyWage}
              onChange={(e) => setDailyWage(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-bold"
            />
          </div>
        </div>

        {/* Site & Job Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الموقع والمشروع الميداني المسند *
            </label>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="مشروع العاصمة الإدارية">مشروع العاصمة الإدارية</option>
              <option value="مشروع توشكى الخير">مشروع توشكى الخير</option>
              <option value="مشروع الفرافرة للاستصلاح">مشروع الفرافرة للاستصلاح</option>
              <option value="مشروع مصنع العاشر">مشروع مصنع العاشر</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              المسمى المهني / الوظيفة *
            </label>
            <select
              value={job}
              onChange={(e) => setJob(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="نجار مسلح">نجار مسلح</option>
              <option value="حداد مسلح">حداد مسلح</option>
              <option value="فني كهرباء ديزل">فني كهرباء ديزل</option>
              <option value="سائق لودر">سائق لودر</option>
              <option value="بناء طوب">بناء طوب</option>
              <option value="عامل حفر وتشغيل">عامل حفر وتشغيل</option>
            </select>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <Link
            href="/admin/workforce/directory"
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors min-h-[44px] inline-flex items-center justify-center"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={!parsedId.isValid || !fullName || !nickname || !phone}
            className="px-6 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm min-h-[44px] inline-flex items-center justify-center"
          >
            تأكيد التعيين وحفظ العامل
          </button>
        </div>
      </form>
    </div>
  );
}
