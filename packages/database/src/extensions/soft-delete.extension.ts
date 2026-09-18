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

export interface RelationMetadata {
  targetModel: string;
  isList: boolean;
  supportsSoftDelete: boolean;
}

let relationCache: Map<string, Map<string, RelationMetadata>> | null = null;

export function getRelationMetadataMap(): Map<string, Map<string, RelationMetadata>> {
  if (relationCache) return relationCache;

  relationCache = new Map();
  const models = Prisma.dmmf?.datamodel?.models || [];
  
  const softDeleteModels = getSoftDeleteModels();
  
  for (const m of models) {
    const relationMap = new Map<string, RelationMetadata>();
    for (const f of m.fields) {
      if (f.kind === 'object') {
        relationMap.set(f.name, {
          targetModel: f.type,
          isList: f.isList,
          supportsSoftDelete: softDeleteModels.has(f.type) || softDeleteModels.has(f.type.charAt(0).toLowerCase() + f.type.slice(1)),
        });
      }
    }
    relationCache.set(m.name, relationMap);
    relationCache.set(m.name.charAt(0).toLowerCase() + m.name.slice(1), relationMap);
  }

  return relationCache;
}

export function sanitizeNestedRelations(
  model: string,
  args: any,
  depth = 0
): void {
  if (depth > 8 || !args || typeof args !== 'object') return;
  
  const relationMap = getRelationMetadataMap().get(model);
  if (!relationMap) return;

  const traverse = (obj: any, key: 'include' | 'select') => {
    if (!obj || !obj[key]) return;
    
    for (const relName of Object.keys(obj[key])) {
      const relMeta = relationMap.get(relName);
      if (!relMeta) continue;
      
      const relValue = obj[key][relName];
      if (typeof relValue === 'boolean') {
        if (!relValue) continue;
        if (relMeta.isList && relMeta.supportsSoftDelete) {
          obj[key][relName] = { where: { isDeleted: false } };
        } else if (!relMeta.isList && relMeta.supportsSoftDelete) {
          // DO NOT inject where
        }
      } else if (typeof relValue === 'object' && relValue !== null) {
        if (relMeta.isList && relMeta.supportsSoftDelete) {
          relValue.where = relValue.where || {};
          if (relValue.where.isDeleted === undefined) {
            relValue.where.isDeleted = false;
          }
        } else if (!relMeta.isList && relMeta.supportsSoftDelete) {
          if (relValue.select && relValue.select.isDeleted === undefined) {
            relValue.select.isDeleted = true;
          }
        }
        
        sanitizeNestedRelations(relMeta.targetModel, relValue, depth + 1);
      }
    }
  };

  traverse(args, 'include');
  traverse(args, 'select');
}

export function sanitizeSoftDeletedToOneEntities(
  model: string,
  data: any,
  originalArgs: any = null,
  depth = 0
): any {
  if (depth > 8 || !data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      data[i] = sanitizeSoftDeletedToOneEntities(model, data[i], originalArgs, depth);
    }
    return data;
  }
  
  const relationMap = getRelationMetadataMap().get(model);
  if (!relationMap) return data;
  
  for (const key of Object.keys(data)) {
    const relMeta = relationMap.get(key);
    if (!relMeta) continue;
    
    const value = data[key];
    if (!value) continue;
    
    let nestedOriginalArgs = null;
    if (originalArgs) {
      if (originalArgs.select && originalArgs.select[key]) {
         nestedOriginalArgs = originalArgs.select[key];
      } else if (originalArgs.include && originalArgs.include[key]) {
         nestedOriginalArgs = originalArgs.include[key];
      } else if (originalArgs[key]) {
         nestedOriginalArgs = originalArgs[key];
      }
    }

    if (relMeta.isList) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = sanitizeSoftDeletedToOneEntities(relMeta.targetModel, value[i], nestedOriginalArgs, depth + 1);
        }
      }
    } else {
      if (value.isDeleted === true) {
        data[key] = null;
      } else {
        data[key] = sanitizeSoftDeletedToOneEntities(relMeta.targetModel, value, nestedOriginalArgs, depth + 1);
        
        if (data[key] !== null && typeof data[key] === 'object') {
          if (
            nestedOriginalArgs && 
            typeof nestedOriginalArgs === 'object' && 
            nestedOriginalArgs.select && 
            nestedOriginalArgs.select.isDeleted === undefined
          ) {
            delete data[key].isDeleted;
          }
        }
      }
    }
  }
  
  return data;
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
          const originalArgs = {
            select: args.select ? JSON.parse(JSON.stringify(args.select)) : undefined,
            include: args.include ? JSON.parse(JSON.stringify(args.include)) : undefined,
          };
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          sanitizeNestedRelations(model, args);
          const result = await query(args);
          return sanitizeSoftDeletedToOneEntities(model, result, originalArgs);
        },

        async findFirstOrThrow({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          const originalArgs = {
            select: args.select ? JSON.parse(JSON.stringify(args.select)) : undefined,
            include: args.include ? JSON.parse(JSON.stringify(args.include)) : undefined,
          };
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          sanitizeNestedRelations(model, args);
          const result = await query(args);
          return sanitizeSoftDeletedToOneEntities(model, result, originalArgs);
        },

        async findMany({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          const originalArgs = {
            select: args.select ? JSON.parse(JSON.stringify(args.select)) : undefined,
            include: args.include ? JSON.parse(JSON.stringify(args.include)) : undefined,
          };
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          sanitizeNestedRelations(model, args);
          const result = await query(args);
          return sanitizeSoftDeletedToOneEntities(model, result, originalArgs);
        },

        async count({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          sanitizeNestedRelations(model, args);
          return query(args);
        },

        async aggregate({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          sanitizeNestedRelations(model, args);
          return query(args);
        },

        async groupBy({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          if (softDeleteModels.has(model)) {
            args.where = injectSoftDeleteFilter(args.where);
          }
          sanitizeNestedRelations(model, args);
          return query(args);
        },

        async findUnique({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          const originalArgs = {
            select: args.select ? JSON.parse(JSON.stringify(args.select)) : undefined,
            include: args.include ? JSON.parse(JSON.stringify(args.include)) : undefined,
          };

          if (!softDeleteModels.has(model)) {
            sanitizeNestedRelations(model, args);
            const result = await query(args);
            return sanitizeSoftDeletedToOneEntities(model, result, originalArgs);
          }

          const hasSelect = Boolean(args.select);
          const originalSelect = args.select ? { ...args.select } : undefined;
          if (hasSelect) {
            args.select = { ...args.select, isDeleted: true };
          }

          sanitizeNestedRelations(model, args);
          const result: any = await query(args);
          
          if (!result || result.isDeleted === true) {
            return null;
          }

          const sanitized = sanitizeSoftDeletedToOneEntities(model, result, originalArgs);

          if (hasSelect && !originalSelect?.isDeleted) {
            delete sanitized.isDeleted;
          }
          return sanitized;
        },

        async findUniqueOrThrow({ model, operation, args, query }: SoftDeleteQueryArgs) {
          args = args ?? {};
          const originalArgs = {
            select: args.select ? JSON.parse(JSON.stringify(args.select)) : undefined,
            include: args.include ? JSON.parse(JSON.stringify(args.include)) : undefined,
          };

          if (!softDeleteModels.has(model)) {
            sanitizeNestedRelations(model, args);
            const result = await query(args);
            return sanitizeSoftDeletedToOneEntities(model, result, originalArgs);
          }

          const hasSelect = Boolean(args.select);
          const originalSelect = args.select ? { ...args.select } : undefined;
          if (hasSelect) {
            args.select = { ...args.select, isDeleted: true };
          }

          sanitizeNestedRelations(model, args);
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

          const sanitized = sanitizeSoftDeletedToOneEntities(model, result, originalArgs);

          if (hasSelect && !originalSelect?.isDeleted) {
            delete sanitized.isDeleted;
          }
          return sanitized;
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
