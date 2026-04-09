import { Context } from "hono"
import { contentJson, OpenAPIRoute } from 'chanfana';
import { z } from 'zod';

import { CommonErrorResponse, CommonSuccessfulResponse } from "../model";
import { sanitizeChannelConfig } from "../channel-config";

// 获取所有 Channel 配置
export class ChannelGetEndpoint extends OpenAPIRoute {
    schema = {
        tags: ['Admin API'],
        summary: 'Get all channel configurations',
        responses: {
            ...CommonSuccessfulResponse(z.array(z.object({
                key: z.string(),
                value: z.string(),
                created_at: z.string(),
                updated_at: z.string(),
            }))),
            ...CommonErrorResponse,
        },
    };

    async handle(c: Context<HonoCustomType>) {
        const result = await c.env.DB.prepare(
            "SELECT * FROM channel_config"
        ).all<ChannelConfigRow>();

        return {
            success: true,
            data: result.results
        } as CommonResponse;
    }
}

// 创建或更新 Channel 配置
export class ChannelUpsertEndpoint extends OpenAPIRoute {
    schema = {
        tags: ['Admin API'],
        summary: 'Create or update channel configuration',
        request: {
            params: z.object({
                key: z.string().describe('Channel key'),
            }),
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            name: z.string().describe('Channel name'),
                            type: z.string().describe('Channel type'),
                            endpoint: z.string().describe('API endpoint'),
                            api_key: z.string().optional().describe('Deprecated single API key'),
                            api_keys: z.array(z.string()).optional().describe('API keys, one request will pick one randomly'),
                            auto_retry: z.boolean().optional().describe('Automatically retry the same API key'),
                            auto_rotate: z.boolean().optional().describe('Automatically rotate to other API keys on retryable failures'),
                            supported_models: z.array(z.string()).describe('Supported request model list'),
                            deployment_mapper: z.record(z.string()).describe('Model deployment mapping'),
                            model_pricing: z.record(z.object({
                                input: z.number().describe('Input token price per 1000 tokens'),
                                output: z.number().describe('Output token price per 1000 tokens'),
                                cache: z.number().optional().describe('Cache token price per 1000 tokens'),
                                request: z.number().optional().describe('Fixed request price'),
                            })).optional().describe('Custom model pricing for this channel'),
                        }),
                    },
                },
            },
        },
        responses: {
            ...CommonSuccessfulResponse(z.boolean()),
            ...CommonErrorResponse,
        },
    };

    async handle(c: Context<HonoCustomType>) {
        const { key } = c.req.param();
        const rawConfig = await c.req.json<ChannelConfig>();
        const config = sanitizeChannelConfig(rawConfig);

        if (!config.name || !config.endpoint) {
            return c.text('Channel name and endpoint are required', 400);
        }

        if (!config.api_keys || config.api_keys.length === 0) {
            return c.text('At least one API key is required', 400);
        }

        // Upsert channel config directly using SQL
        // excluded.value 指的是 INSERT 语句中要插入的新值
        // 当发生冲突时，用新值更新现有记录
        const result = await c.env.DB.prepare(
            `INSERT INTO channel_config (key, value)
             VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = datetime('now')`
        ).bind(key, JSON.stringify(config)).run();

        if (!result.success) {
            return c.text('Failed to upsert channel config', 500);
        }

        return {
            success: true,
            data: true
        } as CommonResponse;
    }
}

// 删除 Channel 配置
export class ChannelDeleteEndpoint extends OpenAPIRoute {
    schema = {
        tags: ['Admin API'],
        summary: 'Delete channel configuration',
        request: {
            params: z.object({
                key: z.string().describe('Channel key'),
            }),
        },
        responses: {
            ...CommonSuccessfulResponse(z.boolean()),
            ...CommonErrorResponse,
        },
    };

    async handle(c: Context<HonoCustomType>) {
        const { key } = c.req.param();

        // Delete channel config directly using SQL
        const result = await c.env.DB.prepare(
            `DELETE FROM channel_config WHERE key = ?`
        ).bind(key).run();

        return {
            success: true,
            data: result.success
        } as CommonResponse;
    }
}
