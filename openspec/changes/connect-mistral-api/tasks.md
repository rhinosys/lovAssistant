## 1. Configuration & Type Definitions

- [x] 1.1 Update `src/server/config.ts` and `.env.example` with `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `MISTRAL_BASE_URL`, and `DEFAULT_LLM_PROVIDER`, and verify configuration tests pass with `npm run test -- src/server/config.test.ts`
- [x] 1.2 Extend `src/server/model/types.ts` with Mistral error classes (`MistralAuthenticationError`, `MistralRateLimitError`, `MistralAPIError`, `MistralTimeoutError`) and provider options

## 2. Mistral Model Provider

- [x] 2.1 Implement `MistralProvider` in `src/server/model/mistral.ts` conforming to `ChatModelProvider` with SSE streaming and health checks
- [x] 2.2 Create unit tests in `src/server/model/mistral.test.ts` covering streaming, error mapping (401, 429, 500, 504), and cancellation, verifying with `npm run test -- src/server/model/mistral.test.ts`

## 3. Provider Registry & API Route

- [x] 3.1 Implement multi-provider registry in `src/server/model/registry.ts` and re-export via `src/server/model/index.ts`
- [x] 3.2 Update `src/app/api/chat/route.ts` to accept optional `provider` and `model` in request schema, route to the selected provider, and record provider metadata
- [x] 3.3 Update `src/app/api/api.test.ts` to test provider resolution and error responses, verifying with `npm run test -- src/app/api/api.test.ts`

## 4. Chat User Interface

- [x] 4.1 Add provider & model selector toggle and active provider badge in `src/app/chat/page.tsx`
- [x] 4.2 Add contextual French error banners in `src/app/chat/page.tsx` for Mistral authentication and quota errors

## 5. Verification & Quality Assurance

- [x] 5.1 Run full test suite via `npm test` and verify that all unit and route tests pass
- [x] 5.2 Run `npm run build` to verify TypeScript compilation and Next.js build integrity
