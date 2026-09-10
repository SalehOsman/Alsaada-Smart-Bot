import { InlineKeyboard } from 'grammy';
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

export function buildGeofencePickerKeyboard(siteCode?: string): InlineKeyboard {
  const prefix = siteCode ? `action:site:set_geofence:${siteCode}` : 'action:site:add:geofence';
  return new InlineKeyboard()
    .text('100 متر (دقيق جداً)', `${prefix}:100`)
    .text('250 متر (موقع متوسط)', `${prefix}:250`)
    .row()
    .text('500 متر (مشروع متسع)', `${prefix}:500`)
    .text('1000 متر (محجر / طريق)', `${prefix}:1000`)
    .row()
    .text('❌ إلغاء والعودة', siteCode ? `action:site:view:${siteCode}` : 'action:settings:sites_hub');
}

export function buildGovPickerKeyboard(siteCode?: string): InlineKeyboard {
  const govs = ['القاهرة', 'الجيزة', 'الإسكندرية', 'السويس', 'البحر الأحمر', 'مطروح', 'الشرقية', 'الدقهلية', 'أسوان'];
  const prefix = siteCode ? `action:site:set_gov:${siteCode}` : 'action:site:add:gov';
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < govs.length; i += 3) {
    const chunk = govs.slice(i, i + 3);
    chunk.forEach((g) => keyboard.text(g, `${prefix}:${g}`));
    keyboard.row();
  }

  keyboard.text('❌ إلغاء والعودة', siteCode ? `action:site:view:${siteCode}` : 'action:settings:sites_hub');
  return keyboard;
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
