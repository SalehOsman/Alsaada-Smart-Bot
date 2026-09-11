import { InlineKeyboard } from 'grammy';
import type { HqGroupStatusDto, SiteGroupItemDto } from './flow.types.js';

export function buildGroupsHubKeyboard(hqStatus: HqGroupStatusDto): InlineKeyboard {
  const hqBadge = hqStatus.isBound ? '🟢' : '🔴';

  return new InlineKeyboard()
    .text(`🏢 جروب الإدارة العليا والتقارير ${hqBadge}`, 'grp:hq')
    .row()
    .text('🏗️ مصفوفة ربط جروبات المواقع الميدانية', 'grp:s:list')
    .row()
    .text('🔙 العودة للكيان والمشاريع', 'action:settings_sub:corporate')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildHqDetailKeyboard(options: {
  isBound: boolean;
  addUrl?: string;
}): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (options.addUrl) {
    kb.url('➕ إضافة البوت للجروب بنقرة واحدة', options.addUrl).row();
  }

  kb.text('✏️ إدخال / تعديل معرف الجروب', 'grp:hq:edit').row();

  if (options.isBound) {
    kb.text('🛠️ تهيئة وتوليد التوبيكات الأربعة', 'grp:hq:init').row();
    kb.text('🧪 فحص حالة الاتصال والصلاحيات', 'grp:hq:test').row();
    kb.text('❌ إلغاء ربط جروب الإدارة', 'grp:hq:del').row();
  }

  kb.text('🔙 العودة لقسم المجموعات', 'action:settings:telegram_groups')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return kb;
}

export function buildSitesMatrixKeyboard(sites: SiteGroupItemDto[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const s of sites) {
    const badge = s.isBound ? '🟢' : '🔴';
    kb.text(`${badge} ${s.name} (${s.code})`, `grp:s:v:${s.id}`).row();
  }

  kb.text('🔙 العودة لقسم المجموعات', 'action:settings:telegram_groups')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return kb;
}

export function buildSiteDetailKeyboard(site: SiteGroupItemDto, addUrl?: string): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (addUrl) {
    kb.url('➕ إضافة البوت لجروب الموقع بنقرة واحدة', addUrl).row();
  }

  kb.text('✏️ تعيين / تعديل معرف الجروب', `grp:s:e:${site.id}`).row();

  if (site.isBound) {
    kb.text('🧪 فحص حالة الاتصال والصلاحيات', `grp:s:t:${site.id}`).row();
    kb.text('❌ إلغاء ربط جروب الموقع', `grp:s:d:${site.id}`).row();
  }

  kb.text('🔙 العودة لمصفوفة المواقع', 'grp:s:list')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return kb;
}
