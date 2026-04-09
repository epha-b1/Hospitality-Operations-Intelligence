// dotenv is loaded conditionally for local dev; Docker uses env_file
try { require('dotenv').config(); } catch (_) { /* dotenv not required in production */ }

export interface EnvironmentConfig {
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  // Optional elevated credential for the audit-log archive job. When
  // strict DB role grants are enabled in production (REVOKE DELETE from
  // the app user), the archival job needs a credential that still has
  // DELETE privileges on audit_logs. If unset, the archival job falls
  // back to the main pool and relies on the trigger's 1-year window to
  // enforce retention.
  auditMaintainer: {
    user: string | null;
    password: string | null;
  };
  jwtSecret: string;
  encryptionKey: string;
  jwtTtl: number;
  face: {
    blinkMin: number;
    blinkMax: number;
    motionMin: number;
    textureMin: number;
  };
}

function loadConfig(): EnvironmentConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'hospitality',
      password: process.env.DB_PASSWORD || 'hospitality',
      name: process.env.DB_NAME || 'hospitality',
    },
    auditMaintainer: {
      user: process.env.AUDIT_MAINTAINER_USER || null,
      password: process.env.AUDIT_MAINTAINER_PASSWORD || null,
    },
    jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
    encryptionKey: process.env.ENCRYPTION_KEY || 'change_me_32_chars_minimum_here_x',
    jwtTtl: parseInt(process.env.JWT_TTL || '28800', 10),
    face: {
      blinkMin: parseInt(process.env.FACE_BLINK_MIN || '100', 10),
      blinkMax: parseInt(process.env.FACE_BLINK_MAX || '500', 10),
      motionMin: parseFloat(process.env.FACE_MOTION_MIN || '0.6'),
      textureMin: parseFloat(process.env.FACE_TEXTURE_MIN || '0.5'),
    },
  };
}

export const config = loadConfig();

// Warn on insecure defaults in production
if (process.env.NODE_ENV === 'production') {
  if (config.jwtSecret === 'change_me_in_production') {
    console.error('WARNING: JWT_SECRET is using default value. Set a secure secret in production.');
  }
  if (config.encryptionKey === 'change_me_32_chars_minimum_here_x') {
    console.error('WARNING: ENCRYPTION_KEY is using default value. Set a secure key in production.');
  }
}
