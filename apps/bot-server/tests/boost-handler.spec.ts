import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

const { mockPrisma } = vi.hoisted(() => {
  const prisma = {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ 1: 1 }]),
    site: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    department: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    project: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    companyProfile: {
      findFirst: vi.fn().mockResolvedValue({
        tradeName: 'شركة السعادة',
        legalName: 'شركة السعادة للمقاولات العامة',
      }),
    },
    tenant: {
      findFirst: vi.fn().mockResolvedValue({ name: 'شركة السعادة' }),
    },
  };
  return { mockPrisma: prisma };
});

vi.mock('../src/db.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../src/redis.js', () => ({
  redis: {
    status: 'ready',
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
  safeRedisGet: vi.fn().mockResolvedValue(null),
  safeRedisSet: vi.fn().mockResolvedValue(true),
}));

describe('Boost Handler — Real-Time Diagnostic & Performance Telemetry', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    vi.useRealTimers();
  });

  it('replies with turbo boost performance card on /boost command', async () => {
    // Arrange
    const { handleBoost } = await import('../src/handlers/boost.handler.js');
    let replyText = '';
    let replyMarkup: any = null;

    const ctx = {
      from: { id: 7594239391, first_name: 'Super', last_name: 'Admin' },
      api: {
        getMe: vi.fn().mockResolvedValue({ id: 123456, is_bot: true, username: 'Al_Saada_bot' }),
      },
      reply: vi.fn().mockImplementation((text, opts) => {
        replyText = text;
        replyMarkup = opts?.reply_markup;
        return Promise.resolve();
      }),
    } as any;

    // Act
    await handleBoost(ctx);

    // Assert
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(replyText).toContain('Turbo Boost Status');
    expect(replyText).toContain('شركة السعادة');
    expect(replyText).toContain('كاش الذاكرة اللحظية (L1 RAM)');
    expect(replyText).toContain('قاعدة البيانات (PostgreSQL)');
    expect(replyText).toContain('خادم الكاش الموزع (Redis)');
    expect(replyText).toContain('زمن شبكة تليجرام الميدانية');
    expect(replyText).not.toContain('تعذر الاتصال');

    // Check keyboard contains refresh and main menu
    const buttonsFlat = replyMarkup?.inline_keyboard?.flat() || [];
    expect(buttonsFlat.some((b: any) => b.callback_data === 'action:boost:refresh')).toBe(true);
    expect(buttonsFlat.some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);
    expect(buttonsFlat.length).toBeGreaterThan(0);
  });

  it('edits message in-place when triggered via callback action:boost:refresh', async () => {
    // Arrange
    const { handleBoost } = await import('../src/handlers/boost.handler.js');
    let editText = '';
    const ctx = {
      from: { id: 7594239391 },
      callbackQuery: {
        id: 'cb-123',
        data: 'action:boost:refresh',
        message: { message_id: 999 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation((text) => {
        editText = text;
        return Promise.resolve();
      }),
      api: {
        getMe: vi.fn().mockResolvedValue({ id: 123456 }),
      },
    } as any;

    // Act
    await handleBoost(ctx);

    // Assert
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    expect(editText).toContain('Turbo Boost Status');
    expect(editText).toContain('شركة السعادة');
    expect(editText).not.toContain('تعذر الاتصال');
  });

  it('handles DB or Redis failure gracefully with fault tolerance', async () => {
    // Arrange
    mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('Connection timed out'));
    const { handleBoost } = await import('../src/handlers/boost.handler.js');

    let replyText = '';
    const ctx = {
      from: { id: 7594239391 },
      api: {
        getMe: vi.fn().mockResolvedValue({ id: 123456 }),
      },
      reply: vi.fn().mockImplementation((text) => {
        replyText = text;
        return Promise.resolve();
      }),
    } as any;

    // Act
    await handleBoost(ctx);

    // Assert
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(replyText).toContain('تعذر الاتصال');
    expect(replyText).not.toContain('(PostgreSQL):* `0.00 ms` (متصل 🟢)');
  });
});
