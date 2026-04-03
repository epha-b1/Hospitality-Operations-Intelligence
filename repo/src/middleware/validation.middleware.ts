import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        });
        return;
      }
      next(err);
    }
  };
}
