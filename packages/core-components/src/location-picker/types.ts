export interface TelegramLocationResult {
  latitude: number;
  longitude: number;
}

export interface LocationPromptCardOptions {
  breadcrumbs?: string[] | undefined;
  title?: string | undefined;
  stepText?: string | undefined;
  siteName?: string | undefined;
  instructions?: string | undefined;
  note?: string | undefined;
}

export interface LocationPromptKeyboardOptions {
  skipCallbackData?: string | undefined;
  skipText?: string | undefined;
  backCallbackData?: string | undefined;
  backText?: string | undefined;
  cancelCallbackData?: string | undefined;
  cancelText?: string | undefined;
}
