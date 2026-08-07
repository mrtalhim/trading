export const OWNER_PREFIX = 'AG';

export function buildClientOrderId(ownerId: string, seq: number): string {
  return `${OWNER_PREFIX}-${ownerId}-${seq}`;
}

export function isOwnedOrder(clientOrderId: string, ownerId: string): boolean {
  const prefix = `${OWNER_PREFIX}-${ownerId}-`;
  return clientOrderId.startsWith(prefix) && clientOrderId.length > prefix.length;
}
