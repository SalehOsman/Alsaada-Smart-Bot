import { InlineKeyboard } from 'grammy';
import type { DepartmentDetailDto, DepartmentPolicySummaryDto, PolicyScope } from './flow.types.js';

export function buildPoliciesHubKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🏗️ سياسات إشعارات جروبات المواقع', 'pol:site')
    .row()
    .text('🏢 سياسات إشعارات جروب الإدارة العليا', 'pol:hq')
    .row()
    .text('🔙 العودة لقسم الرقابة', 'action:settings_sub:system')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildScopeDepartmentsKeyboard(
  scope: PolicyScope,
  departments: DepartmentPolicySummaryDto[]
): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const dept of departments) {
    const badge = dept.enabledFeatures > 0 ? '🟢' : '🔴';
    kb.text(
      `${badge} ${dept.departmentLabel} (${dept.enabledFeatures}/${dept.totalFeatures})`,
      `pol:c:${scope}:${dept.departmentKey}`
    ).row();
  }

  kb.text('🔄 إعادة ضبط هذا المسار للافتراضي', `pol:res:${scope}`).row();
  kb.text('🔙 العودة لقسم الإشعارات', 'action:settings:notification_policies')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return kb;
}

export function buildDepartmentDetailKeyboard(detail: DepartmentDetailDto): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const f of detail.features) {
    const stateEmoji = f.enabled ? '🟢' : '🔴';
    const soundEmoji = f.isSilent ? '🔕' : '🔔';

    kb.text(`${stateEmoji} ${f.label}`, `pol:t:${detail.scope}:${f.featureKey}`)
      .text(`${soundEmoji}`, `pol:s:${detail.scope}:${f.featureKey}`)
      .row();
  }

  const backLabel = detail.scope === 'site' ? '🔙 جروبات المواقع' : '🔙 جروب الإدارة';
  kb.text(backLabel, `pol:${detail.scope}`)
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return kb;
}
