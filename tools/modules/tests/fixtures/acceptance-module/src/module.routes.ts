export interface BotRouteHandler {
  pattern: RegExp | string;
  type: 'action' | 'command' | 'text';
  roles: string[];
  handler: (ctx: unknown) => Promise<unknown>;
}

export const moduleRoutes: BotRouteHandler[] = [
  {
    pattern: 'action:sample:start',
    type: 'action',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    handler: async (ctx: any) => ({
      status: 'ok',
      message: 'مرحبًا بك في نطاق العينة التجريبي',
    }),
  },
  {
    pattern: 'action:sample:query',
    type: 'action',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    handler: async (ctx: any) => ({
      status: 'ok',
      records: [{ id: 'sample-1', title: 'عينة 1', status: 'COMPLETED' }],
    }),
  },
];
