import { lazy } from "react";

export function lazyRetry(importer, retries = 3, baseDelayMs = 700) {
  const attempt = (n) =>
    importer().catch((err) => {
      if (n >= retries) throw err;
      return new Promise((resolve) => setTimeout(resolve, baseDelayMs * n)).then(() => attempt(n + 1));
    });
  return lazy(() => attempt(1));
}
