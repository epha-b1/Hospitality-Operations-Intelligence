import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { FaceEnrollmentSession, FaceEnrollment } from '../models/face.model';
import { AppError } from '../utils/errors';
import { encrypt } from '../utils/crypto';
import { config } from '../config/environment';

const REQUIRED_ANGLES = ['left', 'front', 'right'];

function checkLiveness(blinkTimingMs: number, motionScore: number, textureScore: number) {
  const { blinkMin, blinkMax, motionMin, textureMin } = config.face;
  const passed = blinkTimingMs >= blinkMin && blinkTimingMs <= blinkMax && motionScore >= motionMin && textureScore >= textureMin;
  return { passed, scores: { blinkTimingMs, motionScore, textureScore } };
}

export async function startSession(userId: string) {
  const session = await FaceEnrollmentSession.create({
    id: uuidv4(), user_id: userId, status: 'in_progress',
    angles_captured: {}, expires_at: new Date(Date.now() + 30 * 60 * 1000),
  });
  return { sessionId: session.id, requiredAngles: REQUIRED_ANGLES };
}

export async function capture(sessionId: string, userId: string, data: {
  angle: string; blinkTimingMs: number; motionScore: number; textureScore: number;
}, imageBuffer?: Buffer) {
  const session = await FaceEnrollmentSession.findOne({ where: { id: sessionId, user_id: userId } });
  if (!session || session.status !== 'in_progress') throw new AppError(400, 'VALIDATION_ERROR', 'Invalid or expired session');
  if (new Date(session.expires_at) < new Date()) {
    await FaceEnrollmentSession.update({ status: 'expired' }, { where: { id: sessionId } });
    throw new AppError(400, 'VALIDATION_ERROR', 'Session expired');
  }
  if (!REQUIRED_ANGLES.includes(data.angle)) throw new AppError(400, 'VALIDATION_ERROR', `Invalid angle: ${data.angle}`);

  const liveness = checkLiveness(data.blinkTimingMs, data.motionScore, data.textureScore);
  const angles = { ...session.angles_captured } as Record<string, unknown>;
  angles[data.angle] = { captured: true, liveness: liveness.scores, passed: liveness.passed };

  // Store raw image if provided
  let rawImagePath: string | null = null;
  if (imageBuffer) {
    const imgName = `${sessionId}-${data.angle}.bin`;
    rawImagePath = path.join('face-templates', imgName);
    fs.writeFileSync(path.resolve(rawImagePath), imageBuffer);
  }

  await FaceEnrollmentSession.update({ angles_captured: angles }, { where: { id: sessionId } });
  return { livenessResult: liveness };
}

export async function completeSession(sessionId: string, userId: string) {
  const session = await FaceEnrollmentSession.findOne({ where: { id: sessionId, user_id: userId } });
  if (!session || session.status !== 'in_progress') throw new AppError(400, 'VALIDATION_ERROR', 'Invalid or expired session');

  const angles = session.angles_captured as Record<string, { captured: boolean; passed: boolean }>;
  for (const angle of REQUIRED_ANGLES) {
    if (!angles[angle]?.captured) throw new AppError(400, 'VALIDATION_ERROR', `Missing capture for angle: ${angle}`);
    if (!angles[angle]?.passed) throw new AppError(400, 'VALIDATION_ERROR', `Liveness failed for angle: ${angle}`);
  }

  // Deactivate previous enrollments
  await FaceEnrollment.update({ status: 'deactivated' }, { where: { user_id: userId, status: 'active' } });

  // Get next version
  const maxVersion = await FaceEnrollment.max('version', { where: { user_id: userId } }) as number || 0;

  // Encrypt template
  const template = JSON.stringify({ angles: session.angles_captured, enrolledAt: new Date().toISOString() });
  const encryptedTemplate = encrypt(template);
  const templatePath = path.join('face-templates', `${uuidv4()}.enc`);
  fs.writeFileSync(path.resolve(templatePath), encryptedTemplate);

  // Collect raw image paths from session captures
  const rawImages: string[] = [];
  for (const angle of REQUIRED_ANGLES) {
    const imgPath = path.join('face-templates', `${sessionId}-${angle}.bin`);
    if (fs.existsSync(path.resolve(imgPath))) rawImages.push(imgPath);
  }
  const rawImagePath = rawImages.length > 0 ? rawImages.join(';') : null;

  const enrollment = await FaceEnrollment.create({
    id: uuidv4(), user_id: userId, version: maxVersion + 1, status: 'active',
    template_path: templatePath, angles_captured: session.angles_captured,
    liveness_passed: true, liveness_meta: session.angles_captured,
    raw_image_path: rawImagePath,
    raw_image_expires_at: rawImagePath ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
  });

  await FaceEnrollmentSession.update({ status: 'completed' }, { where: { id: sessionId } });
  return { enrollmentId: enrollment.id, version: enrollment.version };
}

export async function listEnrollments(userId: string) {
  return FaceEnrollment.findAll({ where: { user_id: userId }, order: [['version', 'DESC']] });
}

export async function deactivateEnrollment(enrollmentId: string, userId: string) {
  const enrollment = await FaceEnrollment.findOne({ where: { id: enrollmentId, user_id: userId } });
  if (!enrollment) throw new AppError(404, 'NOT_FOUND', 'Enrollment not found');
  await FaceEnrollment.update({ status: 'deactivated' }, { where: { id: enrollmentId } });
  return FaceEnrollment.findByPk(enrollmentId);
}
