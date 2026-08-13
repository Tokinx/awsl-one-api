import { Context } from "hono";

import {
    calculateRequestCostRaw,
    calculateTokenRateCostRaw,
} from "../billing";
import { CONSTANTS } from "../constants";
import { getJsonSetting } from "../utils";

type UsageCostResult = {
    totalCost: number;
    requestCost: number;
    inputCost: number;
    outputCost: number;
    cacheCost: number;
    hasPricing: boolean;
    // 扣费时已超出配额，本次用量未入账（usage 已顶到配额上限）
    quotaExceeded?: boolean;
}

const UNLIMITED_TOKEN_QUOTA = -1;

const normalizeBillingMode = (value: unknown): PricingBillingMode | undefined => {
    if (value === "volume" || value === "request") {
        return value;
    }

    return undefined;
};

const calculateFixedCostRaw = (value: unknown): number => {
    return calculateRequestCostRaw(value || 0);
};

const normalizeTokenQuota = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        const normalizedValue = Math.round(value);
        return normalizedValue === UNLIMITED_TOKEN_QUOTA
            ? UNLIMITED_TOKEN_QUOTA
            : Math.max(0, normalizedValue);
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return normalizeTokenQuota(parsed);
        }
    }

    return 0;
};

const normalizeTokenUsage = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return normalizeTokenUsage(parsed);
        }
    }

    return 0;
};

const hasPositivePricingValue = (value: unknown): boolean => {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
};

const pricingRequiresQuota = (pricing: ModelPricing | null): boolean => {
    if (!pricing) {
        return false;
    }

    return hasPositivePricingValue(pricing.request)
        || hasPositivePricingValue(pricing.input)
        || hasPositivePricingValue(pricing.output)
        || hasPositivePricingValue(pricing.cache);
};

// 从定价映射中查找模型定价，键名匹配大小写不敏感
const findPricingInMap = (
    pricingMap: Record<string, ModelPricing> | null | undefined,
    model: string
): ModelPricing | null => {
    if (!pricingMap) return null;

    if (pricingMap[model]) {
        return pricingMap[model];
    }

    const normalizedModel = model.toLowerCase();
    for (const [key, value] of Object.entries(pricingMap)) {
        if (key.toLowerCase() === normalizedModel && value) {
            return value;
        }
    }

    return null;
};

// Token 工具对象
export const TokenUtils = {
    async updateUsage(c: Context<HonoCustomType>, key: string, usageAmount: number): Promise<boolean> {
        try {
            // 原子条件扣费：未超配额才累加，避免并发请求把 usage 打到配额以下（负余额）
            const result = await c.env.DB.prepare(
                `UPDATE api_token
                 SET usage = usage + ?, updated_at = datetime('now')
                 WHERE key = ?
                   AND (json_extract(value, '$.total_quota') = -1
                        OR usage + ? <= json_extract(value, '$.total_quota'))`
            ).bind(usageAmount, key, usageAmount).run();

            if (result.meta?.changes && result.meta.changes > 0) {
                return true;
            }

            // 超出配额：把 usage 顶到上限，确保后续请求被预检拦截
            await c.env.DB.prepare(
                `UPDATE api_token
                 SET usage = json_extract(value, '$.total_quota'), updated_at = datetime('now')
                 WHERE key = ?
                   AND json_extract(value, '$.total_quota') != -1
                   AND usage < json_extract(value, '$.total_quota')`
            ).bind(key).run();

            return false;
        } catch (error) {
            console.error('Error updating token usage:', error);
            return false;
        }
    },
    async getPricing(
        c: Context<HonoCustomType>,
        model: string,
        channelConfig: ChannelConfig,
        // 可传入提前读取的全局定价映射，避免循环内 N+1 查询
        globalPricing: Record<string, ModelPricing> | null | undefined = undefined
    ): Promise<ModelPricing | null> {
        // Check channel-specific pricing first
        const channelPricing = findPricingInMap(channelConfig?.model_pricing, model);
        if (channelPricing) {
            return channelPricing;
        }

        // Fallback to global pricing
        const globalPricingMap = globalPricing
            ?? await getJsonSetting<Record<string, ModelPricing>>(c, CONSTANTS.MODEL_PRICING_KEY);
        return findPricingInMap(globalPricingMap, model);
    },
    normalizeQuota(value: unknown): number {
        return normalizeTokenQuota(value);
    },
    hasRemainingQuota(totalQuota: unknown, usage: unknown): boolean {
        const normalizedTotalQuota = normalizeTokenQuota(totalQuota);
        const normalizedUsage = normalizeTokenUsage(usage);

        return normalizedTotalQuota === UNLIMITED_TOKEN_QUOTA
            || normalizedUsage < normalizedTotalQuota;
    },
    async modelRequiresPaidQuota(
        c: Context<HonoCustomType>,
        model: string,
        channelConfig: ChannelConfig,
        globalPricing: Record<string, ModelPricing> | null | undefined = undefined
    ): Promise<boolean> {
        const pricing = await this.getPricing(c, model, channelConfig, globalPricing);
        return pricingRequiresQuota(pricing);
    },

    async calculateUsageCost(
        c: Context<HonoCustomType>,
        model: string,
        targetChannelConfig: ChannelConfig,
        usage: Usage
    ): Promise<UsageCostResult> {
        const pricing = await this.getPricing(c, model, targetChannelConfig);
        const hasTokens = usage.prompt_tokens != null && usage.completion_tokens != null;
        const billingMode = normalizeBillingMode(pricing?.billingMode);
        const hasVisiblePricing = Boolean(pricing?.input || pricing?.output || pricing?.cache);
        const isLegacyRequestOnly = !billingMode && !hasVisiblePricing && Boolean(pricing?.request);
        const requestCost = billingMode
            ? 0
            : calculateRequestCostRaw(pricing?.request || 0);

        if (!pricing) {
            return {
                totalCost: 0,
                requestCost,
                inputCost: 0,
                outputCost: 0,
                cacheCost: 0,
                hasPricing: false,
            };
        }

        if (billingMode === "request" || isLegacyRequestOnly) {
            const inputCost = isLegacyRequestOnly
                ? calculateFixedCostRaw(pricing.request)
                : calculateFixedCostRaw(pricing.input);
            const outputCost = isLegacyRequestOnly
                ? 0
                : calculateFixedCostRaw(pricing.output);
            const cacheCost = !isLegacyRequestOnly && usage.cached_tokens && usage.cached_tokens > 0
                ? calculateFixedCostRaw(pricing.cache)
                : 0;
            const totalCost = inputCost + outputCost + cacheCost;

            return {
                totalCost,
                requestCost: 0,
                inputCost,
                outputCost,
                cacheCost,
                hasPricing: true,
            };
        }

        if (!hasTokens && requestCost <= 0) {
            return {
                totalCost: 0,
                requestCost,
                inputCost: 0,
                outputCost: 0,
                cacheCost: 0,
                hasPricing: false,
            };
        }

        const inputCost = hasTokens
            ? calculateTokenRateCostRaw(usage.prompt_tokens!, pricing.input)
            : 0;
        const outputCost = hasTokens
            ? calculateTokenRateCostRaw(usage.completion_tokens!, pricing.output)
            : 0;

        let cacheCost = 0;
        if (hasTokens && usage.cached_tokens && usage.cached_tokens > 0 && pricing.cache) {
            cacheCost = calculateTokenRateCostRaw(usage.cached_tokens, pricing.cache);
        }

        return {
            totalCost: inputCost + outputCost + cacheCost + requestCost,
            requestCost,
            inputCost,
            outputCost,
            cacheCost,
            hasPricing: true,
        };
    },

    async processUsage(
        c: Context<HonoCustomType>,
        apiKey: string,
        model: string,
        targetChannelKey: string,
        targetChannelConfig: ChannelConfig,
        usage: Usage
    ): Promise<UsageCostResult> {
        console.log("Usage data:", usage);

        const costResult = await this.calculateUsageCost(c, model, targetChannelConfig, usage);

        if (costResult.hasPricing) {
            const applied = await this.updateUsage(c, apiKey, costResult.totalCost);

            const maskedApiKey = apiKey.length < 3 ? '*'.repeat(apiKey.length) : (
                apiKey.slice(0, apiKey.length / 3)
                + '*'.repeat(apiKey.length / 3)
                + apiKey.slice((2 * apiKey.length) / 3)
            );

            if (!applied) {
                costResult.quotaExceeded = true;
                console.warn(
                    `Quota exceeded for token, usage charge not applied: ${maskedApiKey}, `
                    + `Model: ${model}, Cost: ${costResult.totalCost}`
                );
            } else {
                console.log(
                    `Model: ${model}, Channel: ${targetChannelKey}, apiKey: ${maskedApiKey}, `
                    + `Cost: ${costResult.totalCost} (request: ${costResult.requestCost}, `
                    + `input: ${costResult.inputCost}, cache: ${costResult.cacheCost}, `
                    + `output: ${costResult.outputCost})`
                );
            }
        } else {
            console.warn(`No pricing found for model: ${model} in channel: ${targetChannelKey}`);
        }

        return costResult;
    }
};
