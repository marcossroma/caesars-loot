export function allowedOrigins(): string[] {
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    origins.length === 0 ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          url.origin !== origin ||
          (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error('CORS_ORIGIN must contain exact origins; production requires HTTPS.');
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required in production.');
  }
  return origins;
}

export function originAllowed(origin: string | undefined): boolean {
  return origin === undefined || allowedOrigins().includes(origin);
}
