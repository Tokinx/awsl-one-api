export const DEFAULT_CHANNEL_AUTO_RETRY = true;
export const DEFAULT_CHANNEL_AUTO_ROTATE = true;
export const DEFAULT_CLAUDE_API_VERSION = "2023-06-01";
export const MAX_RETRIES_PER_KEY = 3;
export const MAX_ROTATION_ATTEMPTS = 3;

export type NormalizedChannelConfig = Omit<ChannelConfig, "api_keys" | "auto_retry" | "auto_rotate"> & {
    api_keys: string[];
    auto_retry: boolean;
    auto_rotate: boolean;
};

const normalizeApiKeys = (config: Partial<ChannelConfig>): string[] => {
    const rawKeys = Array.isArray(config.api_keys)
        ? [...config.api_keys]
        : [];

    if (typeof config.api_key === "string") {
        rawKeys.unshift(config.api_key);
    }

    const normalizedKeys: string[] = [];
    const seen = new Set<string>();

    for (const key of rawKeys) {
        const trimmedKey = typeof key === "string" ? key.trim() : "";
        if (!trimmedKey || seen.has(trimmedKey)) {
            continue;
        }
        seen.add(trimmedKey);
        normalizedKeys.push(trimmedKey);
    }

    return normalizedKeys;
};

export const normalizeChannelConfig = (
    config: Partial<ChannelConfig>
): NormalizedChannelConfig => {
    return {
        name: config.name || "",
        type: config.type,
        endpoint: config.endpoint || "",
        api_key: typeof config.api_key === "string" ? config.api_key.trim() : undefined,
        api_keys: normalizeApiKeys(config),
        auto_retry: config.auto_retry ?? DEFAULT_CHANNEL_AUTO_RETRY,
        auto_rotate: config.auto_rotate ?? DEFAULT_CHANNEL_AUTO_ROTATE,
        supported_models: Array.isArray(config.supported_models) ? config.supported_models : [],
        deployment_mapper: config.deployment_mapper || {},
        model_pricing: config.model_pricing,
    };
};

export const sanitizeChannelConfig = (
    config: Partial<ChannelConfig>
): ChannelConfig => {
    const normalized = normalizeChannelConfig(config);

    return {
        name: normalized.name,
        type: normalized.type,
        endpoint: normalized.endpoint,
        api_keys: normalized.api_keys,
        auto_retry: normalized.auto_retry,
        auto_rotate: normalized.auto_rotate,
        supported_models: normalized.supported_models,
        deployment_mapper: normalized.deployment_mapper,
        model_pricing: normalized.model_pricing,
    };
};
