import type {
  ExpressionRegistry,
  ExpressionRegistryBackendPayload,
  FieldMeta,
  FunctionMeta,
  OperatorMeta,
  FlagMeta,
} from '../types/expression_registry';

/**
 * Generic JSON fetch helper. Replace or wrap with your app's HTTP client
 * if needed; this version keeps behaviour minimal and explicit.
 */
async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const resp = await fetch(input, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    ...init,
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch ${input}: ${resp.status} ${resp.statusText}`);
  }

  return (await resp.json()) as T;
}

/**
 * Map backend payload into the ExpressionRegistry shape used by the UI.
 * This is mostly a passthrough, but gives us a single place for any
 * client-side normalization.
 */
export function buildExpressionRegistryFromBackend(
  payload: ExpressionRegistryBackendPayload,
): ExpressionRegistry {
  const {
    fields = [],
    functions = [],
    operators = [],
    flags = [],
    error = null,
  } = payload || ({} as ExpressionRegistryBackendPayload);

  const normFields: FieldMeta[] = fields.map((f) => ({ ...f }));
  const normFunctions: FunctionMeta[] = functions.map((fn) => ({ ...fn }));
  const normOperators: OperatorMeta[] = operators.map((op) => ({ ...op }));
  const normFlags: FlagMeta[] = flags.map((fl) => ({ ...fl }));

  return {
    fields: normFields,
    functions: normFunctions,
    operators: normOperators,
    flags: normFlags,
    error,
  };
}

/**
 * Module-level cache.  The first call to fetchExpressionRegistry() fires
 * the actual HTTP request and stores the in-flight promise.  Every
 * subsequent call — from any component, in any order — awaits the same
 * promise and gets the same result.  No duplicate requests.
 */
let _cached: Promise<ExpressionRegistry> | null = null;

/**
 * Fetch and normalize the expression registry from the backend.
 *
 * The result is cached at the module level: the network request fires
 * exactly once per page load, no matter how many components call this.
 */
export function fetchExpressionRegistry(): Promise<ExpressionRegistry> {
  if (_cached) return _cached;

  _cached = (async () => {
    try {
      const json = await fetchJson<ExpressionRegistryBackendPayload>(
        '/api/registry/expression',
      );

      if (json.error) {
        // eslint-disable-next-line no-console
        console.warn(
          '[expressionRegistryClient] backend reported registry error',
          json.error,
        );
      }

      return buildExpressionRegistryFromBackend(json);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[expressionRegistryClient] fetch failed', err);
      // Reset cache on failure so a retry is possible.
      _cached = null;
      // Fallback: empty registry with no error (network layer already logged).
      return {
        fields: [],
        functions: [],
        operators: [],
        flags: [],
        error: 'fetch_failed',
      };
    }
  })();

  return _cached;
}

// ── Proactive prefetch ──────────────────────────────────────────────────
// Fires when the JS bundle loads, before any component mounts.  By the
// time a user clicks "add entry" the data is already in memory.
fetchExpressionRegistry();
