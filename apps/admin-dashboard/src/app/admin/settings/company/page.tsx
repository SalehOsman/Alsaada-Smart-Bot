import React from 'react';
import Link from 'next/link';
import { Building, ArrowRight, ShieldCheck, Phone, Mail, MapPin } from 'lucide-react';
import { getCompanyProfileData } from '@/lib/data-fetchers';

export default async function CompanyProfilePage() {
  const profile = await getCompanyProfileData();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/settings"
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-orange-600" />
            <span>ملف المنظومة المؤسسي (Flow 00.1 Corporate Profile)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            البيانات الرسمية للمنشأة، السجل التجاري، والبطاقة الضريبية المستخرجة مباشرة من قاعدة البيانات.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-600">اسم الكيان المؤسسي:</span>
          <span className="font-bold text-slate-900 text-sm">{profile.legalName}</span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-600">الاسم التجاري المعتمد:</span>
          <span className="font-bold text-slate-800">{profile.tradeName}</span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-600">رقم السجل التجاري:</span>
          <span className="font-mono font-bold text-slate-800">{profile.crNumber}</span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-600">رقم التسجيل الضريبي:</span>
          <span className="font-mono font-bold text-slate-800">{profile.taxNumber}</span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-600">المقر الرئيسي:</span>
          <span className="text-slate-800">{profile.address}</span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-600">العملة المحاسبية المعتمدة:</span>
          <span className="font-bold text-slate-900">{profile.currency} (الجنيه المصري)</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-600">حالة التوثيق المؤسسي:</span>
          <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-bold">
            {profile.status}
          </span>
        </div>
      </div>
    </div>
  );
}
