export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing environment variable ${name}`);
  return v;
}
export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v ? v : undefined;
}
