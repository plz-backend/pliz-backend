import { readFileSync } from 'fs';
import { join } from 'path';

let cachedPackageVersion: string | null = null;

/** Runtime version: APP_VERSION env (CI/CD) → package.json → fallback. */
export function getAppVersion(): string {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;

  if (cachedPackageVersion) return cachedPackageVersion;

  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    ) as { version?: string };
    cachedPackageVersion = pkg.version?.trim() || '0.0.0';
  } catch {
    cachedPackageVersion = '0.0.0';
  }

  return cachedPackageVersion;
}

export function getGitSha(): string | undefined {
  const sha = process.env.GIT_SHA?.trim();
  return sha || undefined;
}
