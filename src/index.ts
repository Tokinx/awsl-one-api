import type { Context } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { api as providerApi } from './providers'
import { api as adminApi } from './admin'
import { fromHono } from 'chanfana';
import db from './db';
import { getSystemConfig } from './system-config';
import { resolveLanguage } from './i18n';

const FRONTEND_ENTRY = '/'
const FRONTEND_STATIC_PATHS = new Set([
    '/__vite_ping',
    '/favicon.ico',
    '/favicon.svg',
    '/index.html',
])
const FRONTEND_STATIC_PREFIXES = [
    '/@fs/',
    '/@id/',
    '/@react-refresh',
    '/@vite/',
    '/assets/',
    '/node_modules/',
    '/src/',
]
const LOCAL_DEV_HOSTNAMES = new Set(['0.0.0.0', '127.0.0.1', '::1', 'localhost'])
const API_DOC_ROUTE_PATHS = new Set([
    '/api/docs',
    '/api/redocs',
    '/api/openapi.json',
])
type AppContext = Context<HonoCustomType>

function isApiRequest(pathname: string): boolean {
    return pathname === '/api'
        || pathname === '/v1'
        || pathname.startsWith('/api/')
        || pathname.startsWith('/v1/')
}

function isFrontendAssetRequest(pathname: string): boolean {
    if (FRONTEND_STATIC_PATHS.has(pathname)) {
        return true
    }

    if (FRONTEND_STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return true
    }

    return /\.[a-z0-9]+$/i.test(pathname)
}

function isWebSocketUpgradeRequest(request: Request): boolean {
    return request.headers.get('upgrade')?.toLowerCase() === 'websocket'
}

function shouldProxyToFrontendDevServer(c: AppContext): boolean {
    const frontendDevServerUrl = c.env.FRONTEND_DEV_SERVER_URL
    if (!frontendDevServerUrl) {
        return false
    }

    const host = c.req.header('host') ?? new URL(c.req.url).host
    const hostname = host.replace(/:\d+$/, '')
    return LOCAL_DEV_HOSTNAMES.has(hostname)
}

async function fetchFrontendResponse(
    c: AppContext,
    pathname: string,
    search = '',
): Promise<Response> {
    if (shouldProxyToFrontendDevServer(c)) {
        const targetUrl = new URL(`${pathname}${search}`, c.env.FRONTEND_DEV_SERVER_URL)

        try {
            return await fetch(new Request(targetUrl.toString(), c.req.raw))
        } catch (error) {
            console.warn(`Failed to proxy frontend request to ${targetUrl.toString()}, falling back to static assets.`, error)
        }
    }

    const assetUrl = new URL(`${pathname}${search}`, c.req.url)
    return c.env.ASSETS.fetch(new Request(assetUrl, c.req.raw))
}

const app = new Hono<HonoCustomType>()
const openapi = fromHono(app, {
  schema: {
    info: {
      title: 'One API on Workers',
      version: '1.0.0',
    }
  },
  docs_url: '/api/docs',
  redoc_url: '/api/redocs',
  openapi_url: '/api/openapi.json'
});

// CORS：公共 API（/v1/*）无凭据可默认放开；管理端仅放行显式配置的来源
openapi.use('/v1/*', cors());

openapi.use('/api/admin/*', async (c, next) => {
    const adminCorsOrigins = (c.env.ADMIN_CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (adminCorsOrigins.length === 0) {
        await next();
        return;
    }

    await cors({
        origin: adminCorsOrigins,
        credentials: true,
    })(c, next);
});

app.use('*', async (c, next) => {
    const lang = resolveLanguage(c)
    c.set('lang', lang)
    await next()
})

app.use('*', async (c, next) => {
    const requestUrl = new URL(c.req.url)

    if (API_DOC_ROUTE_PATHS.has(requestUrl.pathname)) {
        await db.ensureReady(c);

        const systemConfig = await getSystemConfig(c);
        if (!systemConfig.apiDocs.enabled) {
            return c.notFound();
        }
    }

    if (isApiRequest(requestUrl.pathname)) {
        await next()
        return
    }

    if (isWebSocketUpgradeRequest(c.req.raw) && shouldProxyToFrontendDevServer(c)) {
        return fetchFrontendResponse(c, requestUrl.pathname, requestUrl.search)
    }

    if (isFrontendAssetRequest(requestUrl.pathname)) {
        return fetchFrontendResponse(c, requestUrl.pathname, requestUrl.search)
    }

    if (c.req.method === 'GET' || c.req.method === 'HEAD') {
        return fetchFrontendResponse(c, FRONTEND_ENTRY)
    }

    await next()
})

// global error handler
openapi.onError((err, c) => {
  console.error(err)
  // 本地开发（经 Vite 代理）保留详情便于调试；对外统一脱敏
  if (c.env.FRONTEND_DEV_SERVER_URL) {
    return c.text(`${err.name} ${err.message}`, 500)
  }
  return c.text("Internal Server Error", 500)
})

openapi.route('/', providerApi)
openapi.route('/', adminApi)

export default app
