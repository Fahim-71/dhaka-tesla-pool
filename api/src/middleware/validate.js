/**
 * Validate req.params / req.query / req.body with zod schemas.
 * The parsed (trimmed, converted, defaulted) values are put on req.valid,
 * so route handlers never read unvalidated input.
 * On failure the ZodError goes to the error handler -> 400 VALIDATION_ERROR.
 */
export function validate(schemas) {
  return (req, res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) {
        req.valid[part] = schemas[part].parse(req[part] ?? {});
      }
    }
    next();
  };
}
