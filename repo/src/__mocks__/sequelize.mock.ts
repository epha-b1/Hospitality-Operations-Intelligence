// Mock Model class for unit tests
export class Model {
  static init = jest.fn();
  static findOne = jest.fn();
  static findByPk = jest.fn();
  static findAll = jest.fn();
  static findAndCountAll = jest.fn();
  static create = jest.fn();
  static update = jest.fn();
  static destroy = jest.fn();
  static belongsTo = jest.fn();
  static hasMany = jest.fn();

  // Lifecycle hook registration. Real sequelize accumulates listeners on
  // the class-level hook registry; tests inspect them via
  // `(Model as any).options.hooks[name]`. The mock mirrors that shape so
  // app-level immutability tests can verify hooks fire as expected. Each
  // subclass gets its OWN `options` object the first time it registers a
  // hook so different models' hooks do not bleed into each other.
  static options: { hooks: Record<string, Function[]> } = { hooks: {} };

  private static registerHook(name: string, fn: Function): void {
    // If the subclass inherits `options` from a parent, copy it so we
    // don't mutate the parent's hook registry.
    if (!Object.prototype.hasOwnProperty.call(this, 'options')) {
      (this as any).options = { hooks: {} };
    }
    const opts = (this as any).options as { hooks: Record<string, Function[]> };
    (opts.hooks[name] ||= []).push(fn);
  }
  static beforeUpdate(fn: Function): void { this.registerHook('beforeUpdate', fn); }
  static beforeDestroy(fn: Function): void { this.registerHook('beforeDestroy', fn); }
  static beforeBulkUpdate(fn: Function): void { this.registerHook('beforeBulkUpdate', fn); }
  static beforeBulkDestroy(fn: Function): void { this.registerHook('beforeBulkDestroy', fn); }
  static beforeSave(fn: Function): void { this.registerHook('beforeSave', fn); }

  toJSON() { return {}; }
}

// Optional is just a type — export a no-op
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export class Sequelize {
  authenticate = jest.fn().mockResolvedValue(undefined);
  define = jest.fn();
  sync = jest.fn().mockResolvedValue(undefined);
  transaction = jest.fn();
  close = jest.fn().mockResolvedValue(undefined);
  // Default shape for QueryTypes.SELECT is an array of row objects.
  // Individual tests can override via
  //   (sequelize.query as jest.Mock).mockResolvedValueOnce([...])
  query = jest.fn().mockResolvedValue([]);
}

// Mirror the real database.ts exports so modules that import them through
// the jest moduleNameMapper shim get a working API surface in unit tests.
export const sequelize = new Sequelize();

export async function testConnection(): Promise<void> {
  await sequelize.authenticate();
}

/**
 * Shim of createAuditMaintainerConnection — the real implementation lives
 * in src/config/database.ts and opens a second MySQL pool. In unit tests
 * we only care about the env-var branching behavior, so we replicate the
 * check here and return a fresh mock Sequelize instance (or null).
 */
export function createAuditMaintainerConnection(): Sequelize | null {
  const user = process.env.AUDIT_MAINTAINER_USER;
  const password = process.env.AUDIT_MAINTAINER_PASSWORD;
  if (!user || !password) return null;
  return new Sequelize();
}

// QueryTypes mirror sequelize's enum so code that imports them
// (e.g. `import { QueryTypes } from 'sequelize'`) still compiles.
export const QueryTypes = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULKUPDATE: 'BULKUPDATE',
  BULKDELETE: 'BULKDELETE',
  RAW: 'RAW',
} as const;

// Op mirrors the symbol-keyed operators used by where-clause builders.
// Only the ones the codebase actually touches are defined.
export const Op = {
  eq: Symbol('eq'),
  ne: Symbol('ne'),
  gt: Symbol('gt'),
  gte: Symbol('gte'),
  lt: Symbol('lt'),
  lte: Symbol('lte'),
  in: Symbol('in'),
  and: Symbol('and'),
  or: Symbol('or'),
} as const;

export const DataTypes = {
  STRING: (n?: number) => `STRING(${n || 255})`,
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  DATEONLY: 'DATEONLY',
  JSON: 'JSON',
  TEXT: 'TEXT',
  DECIMAL: (p: number, s: number) => `DECIMAL(${p},${s})`,
  ENUM: (...args: string[]) => `ENUM(${args.join(',')})`,
};
