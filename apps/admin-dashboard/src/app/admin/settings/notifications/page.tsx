import React from 'react';
import Link from 'next/link';
import { BellRing, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ZeroStateCard } from '@/components/ui/zero-state-card';
import { getNotificationTopicsData, type NotificationTopicItem } from '@/lib/data-fetchers';

export default async function NotificationsPage() {
  const topics: NotificationTopicItem[] = await getNotificationTopicsData();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/settings"
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-orange-600" />
            <span>سياسات الإشعارات وتوجيه توبيكات تليجرام (Flow 00.10 & 00.11)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            خريطة توجيه التنبيهات الميدانية التلقائية لتوبيكات المجموعات المعنية بنقرة واحدة.
          </p>
        </div>
      </div>

      {topics.length === 0 ? (
        <ZeroStateCard
          icon={BellRing}
          title="لا توجد سياسات توجيه مسجلة"
          description="لم يتم تهيئة أي سياسات توجيه لتوبيكات التيليجرام حتى الآن."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">نوع المعاملة والحدث</th>
                  <th className="py-3 px-4">معرف التوبيك (Topic ID)</th>
                  <th className="py-3 px-4">مسمى التوبيك في التيليجرام</th>
                  <th className="py-3 px-4">المجموعة الموجه إليها</th>
                  <th className="py-3 px-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {topics.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{t.category}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-orange-700">{t.topicId}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{t.topicName}</td>
                    <td className="py-3.5 px-4 text-slate-600">{t.channel}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3 text-orange-600" />
                        <span>توجيه تلقائي</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
