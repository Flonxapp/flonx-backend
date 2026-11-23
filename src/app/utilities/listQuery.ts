// Helpers for hand-written list endpoints (aggregation pipelines).
// Query strings are user input: never copy them into $match as-is, because
// Express parses `?email[$ne]=x` into a Mongo operator.

import { escapeRegex } from '../builder/queryBuilder.utils';

const MAX_LIMIT = 100;

// Returns a safe, escaped search string (or '' when absent / not a string).
export const getSearchTerm = (query: Record<string, unknown>) =>
  typeof query.searchTerm === 'string' && query.searchTerm.trim()
    ? escapeRegex(query.searchTerm.trim().slice(0, 100))
    : '';

export const getPagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(Number(query.limit)) || 10),
  );
  return { page, limit, skip: (page - 1) * limit };
};
