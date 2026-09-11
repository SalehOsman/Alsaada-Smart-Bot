export interface WorkerItem {
  id: string;
  code: string; // Current active structured code (e.g. OP-DRV-0042)
  legacyCode?: string | null; // Historical & legacy code (e.g. "106")
  aliases?: string[]; // Historical & legacy codes (e.g. ["101", "OP-HLP-0015"])
  name: string;
  nickname?: string | null;
  jobTitle?: string;
  siteLocation?: string;
  phone?: string;
  dailyWage?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomActionButton {
  text: string;
  callbackData: string;
}

export interface CopyTextButton {
  text: string;
  copy_text: {
    text: string;
  };
}

export type TelegramChatAction =
  | 'typing'
  | 'upload_document'
  | 'upload_photo'
  | 'record_video'
  | 'upload_video'
  | 'record_voice'
  | 'upload_voice'
  | 'choose_sticker'
  | 'find_location'
  | 'record_video_note'
  | 'upload_video_note';

export interface LinkPreviewOptions {
  is_disabled?: boolean;
  url?: string;
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

export interface ModalAlertOptions {
  text: string;
  show_alert: true;
}
