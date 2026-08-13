import { Context } from "hono";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getApiKeyFromHeaders, fetchTokenData, fetchChannelsForToken } from "./shared/auth";
import { getChannelModels, getJsonSetting } from "../utils";
import { normalizeChannelConfig } from "../channel-config";
import { TokenUtils } from "../admin/token_utils";
import { CONSTANTS } from "../constants";

export class ModelsEndpoint extends OpenAPIRoute {
    schema = {
        tags: ['OpenAI Proxy'],
        summary: 'List available models',
        request: {
            headers: z.object({
                'Authorization': z.string().optional().describe("Token for authentication (OpenAI format)"),
                'x-api-key': z.string().optional().describe("API key for authentication (Claude format)"),
            }),
        },
        responses: {
            200: {
                description: 'List of available models',
                content: {
                    'application/json': {
                        schema: z.object({
                            object: z.string(),
                            data: z.array(z.object({
                                id: z.string(),
                                object: z.string(),
                                created: z.number(),
                                owned_by: z.string(),
                            })),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: Context<HonoCustomType>) {
        const apiKey = getApiKeyFromHeaders(c);
        if (!apiKey) {
            return c.json({ object: "list", data: [] });
        }

        const tokenInfo = await fetchTokenData(c, apiKey);
        if (!tokenInfo) {
            return c.text("Invalid API key", 401);
        }

        const channelsResult = await fetchChannelsForToken(c, tokenInfo.tokenData);

        if (!channelsResult || !channelsResult.results || channelsResult.results.length === 0) {
            return c.json({
                object: "list",
                data: [],
            });
        }

        const modelsSet = new Set<string>();
        const hasRemainingQuota = TokenUtils.hasRemainingQuota(tokenInfo.tokenData.total_quota, tokenInfo.usage);
        // 一次性读取全局定价，避免循环内对每个模型重复查询
        const globalPricing = hasRemainingQuota
            ? null
            : await getJsonSetting<Record<string, ModelPricing>>(c, CONSTANTS.MODEL_PRICING_KEY);

        for (const row of channelsResult.results) {
            let config: ChannelConfig;

            try {
                config = normalizeChannelConfig(JSON.parse(row.value) as ChannelConfig);
            } catch (error) {
                console.error(`Invalid channel config for key: ${row.key}`, error);
                continue;
            }

            if (!config.enabled) {
                continue;
            }
            for (const model of getChannelModels(config)) {
                if (!hasRemainingQuota && await TokenUtils.modelRequiresPaidQuota(c, model.name, config, globalPricing)) {
                    continue;
                }
                modelsSet.add(model.name);
            }
        }

        const models = Array.from(modelsSet).sort().map((modelId) => ({
            id: modelId,
            object: "model" as const,
            created: 1700000000,
            owned_by: "system",
        }));

        return c.json({
            object: "list",
            data: models,
        });
    }
}
