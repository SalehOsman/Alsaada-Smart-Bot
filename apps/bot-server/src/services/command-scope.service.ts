import { Api } from 'grammy';
import { BotCommand } from 'grammy/types';

export const UNIVERSAL_FALLBACK_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية واللوحة التشغيلية' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
];

export const SUPER_ADMIN_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية واللوحة التشغيلية' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
  { command: 'settings', description: '⚙️ مركز إعدادات النظام والتحكم' },
  { command: 'jobs', description: '💼 الهيكل الوظيفي ومصفوفة المهن' },
  { command: 'sites', description: '🏗️ مصفوفة المشاريع والمواقع الميدانية' },
  { command: 'profile', description: '👤 الملف الشخصي وتعديل البيانات' },
];

export const FIELD_ADMIN_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية وبوابة الإشراف' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
  { command: 'switch_role', description: '👷 التبديل لحسابي كعامل (بوابة ذاتية)' },
  { command: 'profile', description: '👤 ملفي وإعداداتي الشخصية' },
];

export const DUAL_WORKER_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية وبوابة العامل' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
  { command: 'switch_role', description: '🛡️ العودة لبوابة الإشراف الميداني' },
  { command: 'profile', description: '👤 ملفي الشخصي' },
  { command: 'help', description: '❓ دليل الاستخدام والخدمات' },
];

export const WORKER_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية وبوابة العامل' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
  { command: 'profile', description: '👤 ملفي الشخصي' },
  { command: 'help', description: '❓ دليل الاستخدام والخدمات' },
];

export const EXECUTIVE_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية والمؤشرات' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
  { command: 'profile', description: '👤 ملفي الشخصي' },
];


export const SUPPLIER_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 القائمة الرئيسية وبوابة المورد' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
  { command: 'profile', description: '👤 ملفي الشخصي' },
];

export const GUEST_COMMANDS: BotCommand[] = [
  { command: 'start', description: '🏠 البداية وطلب التسجيل' },
  { command: 'cancel', description: '❌ إلغاء المعاملة الحالية' },
  { command: 'my_id', description: '🆔 بطاقة معرف حسابي' },
  { command: 'help', description: '❓ دليل الاستخدام واللوائح' },
];

/**
 * Return role-specific commands avoiding UI leaks to unauthorized users
 */
export function getCommandsForRole(role: string, isDualWorker = false): BotCommand[] {
  if (isDualWorker) {
    return DUAL_WORKER_COMMANDS;
  }
  switch (role) {
    case 'SUPER_ADMIN':
      return SUPER_ADMIN_COMMANDS;
    case 'FIELD_ADMIN':
      return FIELD_ADMIN_COMMANDS;
    case 'WORKER':
      return WORKER_COMMANDS;
    case 'EXECUTIVE':
      return EXECUTIVE_COMMANDS;
    case 'SUPPLIER':
      return SUPPLIER_COMMANDS;
    case 'GUEST':
    default:
      return GUEST_COMMANDS;
  }
}

/**
 * Synchronize the user's side menu commands with Telegram API using BotCommandScopeChat
 */
export async function syncUserCommandsScope(
  api: Api,
  telegramId: bigint,
  role: string,
  isDualWorker = false
): Promise<void> {
  try {
    const commands = getCommandsForRole(role, isDualWorker);
    await api.setMyCommands(commands, {
      scope: {
        type: 'chat',
        chat_id: Number(telegramId),
      },
    });
  } catch (error: any) {
    console.warn(`⚠️ [COMMAND_SCOPE] Could not set scoped commands for ${telegramId}:`, error?.message || error);
  }
}
