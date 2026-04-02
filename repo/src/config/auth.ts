import { config } from './environment';

export const authConfig = {
  secret: config.jwtSecret,
  ttl: config.jwtTtl,
  algorithm: 'HS256' as const,
};
