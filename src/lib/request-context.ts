/**
 * Request context storage using AsyncLocalStorage.
 * Solves the concurrent request data isolation problem.
 * User ID is stored per-request instead of global variable.
 */

import { AsyncLocalStorage } from "async_hooks";

type RequestContextData = {
  userId: string;
};

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

/**
 * Run a function within a request context bound to the given userId.
 * All async operations inside this function will see this userId.
 */
export function runWithUserId<T>(userId: string, fn: () => T): T {
  return asyncLocalStorage.run({ userId }, fn);
}

/**
 * Get the current request's userId from AsyncLocalStorage.
 * Returns empty string if not in a request context.
 */
export function getCurrentUserId(): string {
  const store = asyncLocalStorage.getStore();
  return store?.userId || "";
}
