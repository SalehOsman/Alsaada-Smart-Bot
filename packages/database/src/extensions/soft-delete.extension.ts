import { Prisma } from '../generated/client/index.js';

let cachedSoftDeleteModels: Set<string> | null = null;

export function getSoftDeleteModels(): Set<string> {
  if (cachedSoftDeleteModels) return cachedSoftDeleteModels;

  const models = new Set<string>();
  if (Prisma.dmmf?.datamodel?.models) {
    for (const m of Prisma.dmmf.datamodel.models) {
      if (m.fields.some((f) => f.name === 'isDeleted')) {
        models.add(m.name);
        models.add(m.name.charAt(0).toLowerCase() + m.name.slice(1));
      }
    }
  }

  // Guaranteed schema baseline models
  models.add('Worker');
  models.add('worker');
  models.add('FinancialLedger');
  models.add('financialLedger');
  models.add('User');
  models.add('user');

  cachedSoftDeleteModels = models;
  return cachedSoftDeleteModels;
}

function injectSoftDeleteFilter(where: Record<string, any> = {}): Record<string, any> {
  // If caller explicitly queried for isDeleted, respect caller's explicit filter
  if (where.isDeleted !== undefined) {
    return where;
  }
  return {
    ...where,
    isDeleted: false,
  };
}

export interface SoftDeleteQueryArgs<TArgs = any> {
  model: string;
  operation: string;
  args: TArgs;
  query: (args: TArgs) => Promise<any>;
}

export function createSoftDeleteExtension() {
  const softDeleteModels = getSoftDeleteModels();

  return {
    name: 'softDeleteExtension',
    query: {
      $allModels: {
        async findFirst({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          return query(args);
        },

        async findFirstOrThrow({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          return query(args);
        },

        async findMany({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          return query(args);
        },

        async count({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          return query(args);
        },

        async aggregate({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          return query(args);
        },

        async groupBy({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          return query(args);
        },

        async findUnique({ model, operation, args, query }: SoftDeleteQueryArgs) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          const hasSelect = Boolean(args.select);
          const originalSelect = args.select ? { ...args.select } : undefined;
          if (hasSelect) {
            args.select = { ...args.select, isDeleted: true };
          }

          const result: any = await query(args);
          if (!result || result.isDeleted === true) {
            return null;
          }

          if (hasSelect && !originalSelect?.isDeleted) {
            delete result.isDeleted;
          }
          return result;
        },

        async findUniqueOrThrow({ model, operation, args, query }: SoftDeleteQueryArgs) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          const hasSelect = Boolean(args.select);
          const originalSelect = args.select ? { ...args.select } : undefined;
          if (hasSelect) {
            args.select = { ...args.select, isDeleted: true };
          }

          const result: any = await query(args);
          if (!result || result.isDeleted === true) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Record required but not found (soft-deleted or does not exist)',
              {
                code: 'P2025',
                clientVersion: Prisma.prismaVersion?.client ?? '6.4.1',
              }
            );
          }

          if (hasSelect && !originalSelect?.isDeleted) {
            delete result.isDeleted;
          }
          return result;
        },

        async delete({ model, operation, args, query }: SoftDeleteQueryArgs) {
          if (softDeleteModels.has(model)) {
            const camel = model.charAt(0).toLowerCase() + model.slice(1);
            const delegate = (this as any)[camel] ?? (this as any)[model];
            if (delegate?.update) {
              return delegate.update({
                where: args.where,
                data: {
                  isDeleted: true,
                  deletedAt: new Date(),
                },
                select: args.select,
                include: args.include,
              });
            }
          }
          return query(args);
        },

        async deleteMany({ model, operation, args, query }: SoftDeleteQueryArgs) {
          if (softDeleteModels.has(model)) {
            const camel = model.charAt(0).toLowerCase() + model.slice(1);
            const delegate = (this as any)[camel] ?? (this as any)[model];
            if (delegate?.updateMany) {
              return delegate.updateMany({
                where: args.where,
                data: {
                  isDeleted: true,
                  deletedAt: new Date(),
                },
              });
            }
          }
          return query(args);
        },
      },
    },
  };
}
