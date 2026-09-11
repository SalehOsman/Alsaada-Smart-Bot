export function validateChatId(chatId: string): boolean {
  return /^-?\d+$/.test(chatId.trim());
}

export function validateSiteId(siteId: string): boolean {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(siteId.trim());
}
