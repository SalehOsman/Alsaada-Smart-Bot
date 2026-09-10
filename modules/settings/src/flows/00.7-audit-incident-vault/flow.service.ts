import type { AuditIncidentVaultRepository } from './flow.repository.js';
import type { UserJourneyStep, UnresolvedErrorDto, PurgeResultDto } from './flow.types.js';
import { parseUserIdentifier } from './flow.validators.js';

export class AuditIncidentVaultService {
  constructor(private readonly repository: AuditIncidentVaultRepository) {}

  async getUserJourney(input: string): Promise<{ target: string; steps: UserJourneyStep[]; error?: string }> {
    const parsed = parseUserIdentifier(input);
    if (parsed.type === 'INVALID') {
      return { target: input, steps: [], error: 'يرجى إدخال معرف تيليجرام صحيح (أرقام) أو كود عامل (مثل OP-01).' };
    }

    let telegramId: bigint | null = null;
    let targetLabel = input;

    if (parsed.type === 'TELEGRAM_ID') {
      telegramId = BigInt(parsed.value);
      targetLabel = `معرف: ${parsed.value}`;
    } else {
      telegramId = await this.repository.findTelegramIdByWorkerCode(parsed.value);
      targetLabel = `عامل: ${parsed.value}`;
      if (!telegramId) {
        return { target: targetLabel, steps: [], error: `لم يتم العثور على حساب تيليجرام مرتبط بكود العامل (${parsed.value}).` };
      }
    }

    const steps = await this.repository.getUserJourneySteps(telegramId, 10);
    return { target: targetLabel, steps };
  }

  async listUnresolvedErrors(page = 1, pageSize = 5): Promise<{ total: number; errors: UnresolvedErrorDto[] }> {
    return this.repository.listUnresolvedErrors(page, pageSize);
  }

  async getErrorById(id: string): Promise<UnresolvedErrorDto | null> {
    return this.repository.getErrorById(id);
  }

  async resolveError(errorId: string, resolvedById: bigint): Promise<boolean> {
    return this.repository.resolveError(errorId, resolvedById);
  }

  async purgeOldLogs(days = 30): Promise<PurgeResultDto> {
    return this.repository.purgeLogsOlderThan(days);
  }
}
