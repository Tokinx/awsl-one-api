import { Context } from "hono";
import { CONSTANTS } from "../constants";
import { getSetting, saveSetting } from "../utils";

const DB_INIT_QUERIES = `
CREATE TABLE IF NOT EXISTS channel_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS api_token (
    key TEXT PRIMARY KEY,
    value TEXT,
    usage REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`

let dbReadyPromise: Promise<void> | null = null;

const getInitQuery = () => DB_INIT_QUERIES.replace(/[\r\n]/g, "")
    .split(";")
    .map((query) => query.trim())
    .filter(Boolean)
    .join(";\n");

const initializeSchema = async (c: Context<HonoCustomType>) => {
    await c.env.DB.exec(getInitQuery());
};

const dbOperations = {
    initialize: async (c: Context<HonoCustomType>) => {
        await initializeSchema(c);
    },
    migrate: async (c: Context<HonoCustomType>) => {
        await initializeSchema(c);

        const version = await getSetting(c, CONSTANTS.DB_VERSION_KEY);
        if (version === CONSTANTS.DB_VERSION) {
            return;
        }

        const channels = await c.env.DB.prepare(
            "SELECT key, value FROM channel_config"
        ).all<Pick<ChannelConfigRow, "key" | "value">>();

        for (const row of channels.results || []) {
            const config = (() => {
                try {
                    return JSON.parse(row.value) as ChannelConfig;
                } catch {
                    return null;
                }
            })();

            if (!config) {
                continue;
            }

            config.supported_models = Object.keys(config.deployment_mapper || {});

            await c.env.DB.prepare(
                `UPDATE channel_config
                 SET value = ?, updated_at = datetime('now')
                 WHERE key = ?`
            ).bind(JSON.stringify(config), row.key).run();
        }

        await saveSetting(c, CONSTANTS.DB_VERSION_KEY, CONSTANTS.DB_VERSION);
    },
    ensureReady: async (c: Context<HonoCustomType>) => {
        if (!dbReadyPromise) {
            dbReadyPromise = (async () => {
                await dbOperations.migrate(c);
            })().catch((error) => {
                dbReadyPromise = null;
                throw error;
            });
        }

        await dbReadyPromise;
    },
    getVersion: async (c: Context<HonoCustomType>): Promise<string | null> => {
        return await getSetting(c, CONSTANTS.DB_VERSION_KEY);
    }
}

export default dbOperations;
