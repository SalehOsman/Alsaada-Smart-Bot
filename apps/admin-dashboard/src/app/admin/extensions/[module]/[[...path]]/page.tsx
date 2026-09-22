import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getModuleById, getDiscoveredFlows } from '@/lib/module-catalog';

interface ExtensionPageProps {
  params: Promise<{
    module: string;
    path?: string[];
  }>;
}

export default async function ModuleExtensionPage({ params }: ExtensionPageProps) {
  const resolvedParams = await params;
  const { module: moduleId, path } = resolvedParams;

  const moduleDef = getModuleById(moduleId);
  if (!moduleDef) {
    notFound();
  }

  const moduleFlows = getDiscoveredFlows(moduleId);
  const subPath = path && path.length > 0 ? path.join('/') : '';

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Module Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {moduleDef.titleArabic}
            </h1>
            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-700/10">
              v{moduleDef.version}
            </span>
            <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">
              {moduleDef.status === 'active' ? 'نشط ومفعل' : 'مسودة تجريبية'}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {moduleDef.descriptionArabic}
          </p>
        </div>

        <div className="text-xs text-neutral-400 font-mono">
          معرّف الموديول: <span className="font-bold text-neutral-600 dark:text-neutral-300">{moduleId}</span>
        </div>
      </div>

      {/* Breadcrumb / Subpath Info if any */}
      {subPath && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 p-3 text-xs text-neutral-600 dark:text-neutral-300">
          المسار الداخلي: <code className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{subPath}</code>
        </div>
      )}

      {/* Flows Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          التدفقات والخدمات المكتشفة ({moduleFlows.length})
        </h2>

        {moduleFlows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-neutral-500">
            لا توجد تدفقات مسجلة حالياً لهذا الموديول.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {moduleFlows.map((flow) => (
              <div
                key={flow.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm hover:shadow transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-neutral-400 dark:text-neutral-500">
                      {flow.id}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        flow.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {flow.status === 'active' ? 'مفعل' : 'مسودة'}
                    </span>
                  </div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                    {flow.titleArabic}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {flow.descriptionArabic}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <div className="flex flex-wrap gap-1">
                    {flow.allowedRoles.slice(0, 2).map((role) => (
                      <span
                        key={role}
                        className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded text-[10px]"
                      >
                        {role}
                      </span>
                    ))}
                    {flow.allowedRoles.length > 2 && (
                      <span className="text-neutral-400 text-[10px]">+{flow.allowedRoles.length - 2}</span>
                    )}
                  </div>
                  <Link
                    href={`/admin/extensions/${moduleId}/${flow.slug}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    استعراض ←
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
