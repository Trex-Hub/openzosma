import { getEnvApiKey, getModel, getModels, getProviders } from "@mariozechner/pi-ai"
import type { Api, Model } from "@mariozechner/pi-ai"
import { DEFAULT_MODELS, PROVIDER_PREFERENCE } from "./config.js"

/**
 * Resolve the model to use. Priority:
 * 1. providerOverride + modelOverride arguments (from agent config)
 * 2. Explicit OPENZOSMA_MODEL_PROVIDER + OPENZOSMA_MODEL_ID env vars
 * 3. Auto-detect from available API keys using PROVIDER_PREFERENCE order
 */
export function resolveModel(
	providerOverride?: string,
	modelOverride?: string,
): { model: Model<Api>; apiKey: string } {
	if (providerOverride && modelOverride) {
		const model = getModel(providerOverride as "anthropic", modelOverride as "claude-sonnet-4-20250514")
		if (!model) {
			throw new Error(`Model ${providerOverride}/${modelOverride} not found in model registry.`)
		}
		const apiKey = getEnvApiKey(providerOverride)
		if (!apiKey) {
			throw new Error(
				`No API key found for provider "${providerOverride}". Set the appropriate environment variable.`,
			)
		}
		return { model, apiKey }
	}

	const explicitProvider = providerOverride ?? process.env.OPENZOSMA_MODEL_PROVIDER
	const explicitModelId = modelOverride ?? process.env.OPENZOSMA_MODEL_ID

	if (explicitProvider) {
		const modelId = explicitModelId ?? DEFAULT_MODELS[explicitProvider]
		if (!modelId) {
			throw new Error(
				`OPENZOSMA_MODEL_PROVIDER is "${explicitProvider}" but no OPENZOSMA_MODEL_ID was set and no default model is known for this provider.`,
			)
		}
		const model = getModel(explicitProvider as "anthropic", modelId as "claude-sonnet-4-20250514")
		if (!model) {
			throw new Error(`Model ${explicitProvider}/${modelId} not found in model registry.`)
		}
		const apiKey = getEnvApiKey(explicitProvider)
		if (!apiKey) {
			throw new Error(`No API key found for provider "${explicitProvider}". Set the appropriate environment variable.`)
		}
		return { model, apiKey }
	}

	for (const provider of PROVIDER_PREFERENCE) {
		const apiKey = getEnvApiKey(provider)
		if (!apiKey) continue

		const modelId = explicitModelId ?? DEFAULT_MODELS[provider]
		if (!modelId) continue

		const model = getModel(provider as "anthropic", modelId as "claude-sonnet-4-20250514")
		if (!model) continue

		return { model, apiKey }
	}

	for (const provider of getProviders()) {
		const apiKey = getEnvApiKey(provider)
		if (!apiKey) continue

		const models = getModels(provider as "anthropic")
		if (models.length === 0) continue

		return { model: models[0] as Model<Api>, apiKey }
	}

	throw new Error(
		"No LLM provider configured. Set OPENZOSMA_MODEL_PROVIDER or provide an API key (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY).",
	)
}
