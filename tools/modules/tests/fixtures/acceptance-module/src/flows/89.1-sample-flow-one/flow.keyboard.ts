export interface InlineButton {
  text: string;
  callback_data: string;
}

export function buildSampleConfirmationKeyboard(): InlineButton[][] {
  return [
    [
      { text: '✅ تأكيد العملية', callback_data: 'action:sample:confirm' },
      { text: '❌ إلغاء', callback_data: 'action:sample:cancel' },
    ],
    [
      { text: '⬅️ القائمة', callback_data: 'action:sample:start' },
    ],
  ];
}
