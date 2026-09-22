export interface InlineButton {
  text: string;
  callback_data: string;
}

export function buildQueryKeyboard(): InlineButton[][] {
  return [
    [
      { text: '🔄 تحديث السجل', callback_data: 'action:sample:refresh' },
      { text: '⬅️ رجوع', callback_data: 'action:sample:back' },
    ],
  ];
}
