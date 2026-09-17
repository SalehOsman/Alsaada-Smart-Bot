import { InlineKeyboard } from 'grammy';
import {
  buildGovernoratePickerKeyboard,
  getGovernoratesList,
  buildLocationPromptKeyboard,
  DEFAULT_GOV_PAGE_SIZE,
} from '@alsaada/core-components';
import type { SiteDto } from './flow.types.js';

export function buildSitesListKeyboard(sites: SiteDto[], isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  sites.forEach((site) => {
    const statusIcon = site.status === 'ACTIVE' ? '🟢' : '🔴';
    keyboard
      .text(`${statusIcon} ${site.name} (${site.code}) — 👥 ${site.workerCount}`, `action:site:view:${site.code}`)
      .row();
  });

  keyboard
    .text('➕ إضافة موقع / فرع ميداني جديد', 'action:site:add_new')
    .row()
    .text('🔙 العودة للكيان المؤسسي', 'action:settings_sub:corporate')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildSiteDetailKeyboard(site: SiteDto, isImpersonating?: boolean): InlineKeyboard {
  const statusToggleText = site.status === 'ACTIVE' ? '⏸️ إيقاف / تجميد الموقع مؤقتاً' : '▶️ إعادة تنشيط الموقع';

  const keyboard = new InlineKeyboard()
    .text('✏️ تعديل بيانات الموقع', `action:site:edit_menu:${site.code}`)
    .row()
    .text(statusToggleText, `action:site:toggle:${site.code}`)
    .row()
    .text('🔙 العودة لقائمة المواقع', 'action:settings:sites_hub')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildSiteEditMenuKeyboard(siteCode: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✏️ الاسم', `action:site:edit:name:${siteCode}`)
    .text('✏️ المحافظة', `action:site:edit:gov:${siteCode}`)
    .row()
    .text('✏️ المشروع التابع له', `action:site:edit:project:${siteCode}`)
    .text('✏️ السياج الجغرافي', `action:site:edit:geofence:${siteCode}`)
    .row()
    .text('📍 تحديث الموقع (GPS)', `action:site:edit:location:${siteCode}`)
    .row()
    .text('🔙 العودة لبطاقة الموقع', `action:site:view:${siteCode}`);
}

/**
 * 27 Official Egyptian Governorates from Core Components SSOT.
 */
export const EGYPTIAN_GOVERNORATES = getGovernoratesList().map((g) => g.nameAr) as readonly string[];
export const GOV_PAGE_SIZE = DEFAULT_GOV_PAGE_SIZE;

export function buildGovPickerKeyboard(siteCode?: string, page = 1): InlineKeyboard {
  return buildGovernoratePickerKeyboard({
    page,
    actionPrefix: siteCode ? `action:site:set_gov:${siteCode}` : 'action:site:add:gov',
    pagePrefix: siteCode ? `action:site:edit_gov_page:${siteCode}` : 'action:site:add_gov_page',
    backCallbackData: siteCode ? undefined : 'action:site:add:back_to_code',
    cancelCallbackData: siteCode ? `action:site:view:${siteCode}` : 'action:settings:sites_hub',
    cancelText: siteCode ? '❌ إلغاء والعودة' : '❌ إلغاء',
    noopCallbackData: 'action:site:gov:noop',
  });
}

export function buildSiteLocationPromptKeyboard(siteCode?: string): InlineKeyboard {
  return buildLocationPromptKeyboard({
    skipCallbackData: siteCode ? undefined : 'action:site:add:skip_location',
    backCallbackData: siteCode ? undefined : 'action:site:add:back_to_gov',
    cancelCallbackData: siteCode ? `action:site:view:${siteCode}` : 'action:settings:sites_hub',
    cancelText: siteCode ? '❌ إلغاء والعودة' : '❌ إلغاء',
  });
}

export function buildGeofencePickerKeyboard(siteCode?: string): InlineKeyboard {
  const prefix = siteCode ? `action:site:set_geofence:${siteCode}` : 'action:site:add:geofence';
  const keyboard = new InlineKeyboard()
    .text('100 متر (دقيق جداً)', `${prefix}:100`)
    .text('250 متر (موقع متوسط)', `${prefix}:250`)
    .row()
    .text('500 متر (مشروع متسع)', `${prefix}:500`)
    .text('1000 متر (محجر / طريق)', `${prefix}:1000`)
    .row();

  if (siteCode) {
    keyboard.text('❌ إلغاء والعودة', `action:site:view:${siteCode}`);
  } else {
    keyboard
      .text('◀️ السابق', 'action:site:add:back_to_location')
      .text('❌ إلغاء', 'action:settings:sites_hub');
  }

  return keyboard;
}

export function buildConfirmCodeKeyboard(code: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(`✅ اعتماد الكود المقترح (${code})`, `action:site:confirm_code:${code}`)
    .row()
    .text('◀️ السابق', 'action:site:add:back_to_name')
    .text('❌ إلغاء', 'action:settings:sites_hub');
}

export function buildProjectsPickerKeyboard(projects: Array<{ id: string; name: string }>, siteCode?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const prefix = siteCode ? `action:site:set_project:${siteCode}` : 'action:site:add:project';

  projects.slice(0, 10).forEach((p) => {
    keyboard.text(`📁 ${p.name}`, `${prefix}:${p.id}`).row();
  });

  keyboard.text('❌ إلغاء والعودة', siteCode ? `action:site:view:${siteCode}` : 'action:settings:sites_hub');
  return keyboard;
}
