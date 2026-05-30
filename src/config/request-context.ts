import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  requestId: string;
  userId?: string;
  method?: string;
  path?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setRequestUserId(userId: string): void {
  const store = storage.getStore();
  if (store) {
    store.userId = userId;
  }
}
