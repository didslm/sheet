export const config = {
  defaultTtlDays: Number(process.env.DEFAULT_TTL_DAYS ?? 14),
  maxTtlDays: Number(process.env.MAX_TTL_DAYS ?? 30),
  rateLimitCreatePerDay: Number(process.env.RATE_LIMIT_CREATE_PER_DAY ?? 10),
  partyHost: process.env.NEXT_PUBLIC_PARTY_HOST ?? 'localhost:1999',
  adminToken: process.env.ADMIN_TOKEN ?? '',
};
