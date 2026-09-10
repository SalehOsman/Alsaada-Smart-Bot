import type { PrismaClient } from '@alsaada/database';

export class AdminProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUser(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        assignedSite: true,
      },
    });
  }

  async updateFullName(telegramId: bigint, fullName: string) {
    return this.prisma.user.update({
      where: { telegramId },
      data: { fullName },
      include: { assignedSite: true },
    });
  }

  async updateEncryptedPhone(telegramId: bigint, phoneEncrypted: string, phoneHash: string) {
    return this.prisma.user.update({
      where: { telegramId },
      data: { phoneEncrypted, phoneBlindIndex: phoneHash },
      include: { assignedSite: true },
    });
  }
}
