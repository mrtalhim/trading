export const OWNER_PREFIX = 'AG';
export function buildClientOrderId(ownerId, seq) {
    return `${OWNER_PREFIX}-${ownerId}-${seq}`;
}
export function isOwnedOrder(clientOrderId, ownerId) {
    const prefix = `${OWNER_PREFIX}-${ownerId}-`;
    return clientOrderId.startsWith(prefix) && clientOrderId.length > prefix.length;
}
//# sourceMappingURL=ownership.js.map