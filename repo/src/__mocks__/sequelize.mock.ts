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
  toJSON() { return {}; }
}

// Optional is just a type — export a no-op
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export class Sequelize {
  authenticate = jest.fn().mockResolvedValue(undefined);
  define = jest.fn();
  sync = jest.fn().mockResolvedValue(undefined);
  transaction = jest.fn();
}

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
