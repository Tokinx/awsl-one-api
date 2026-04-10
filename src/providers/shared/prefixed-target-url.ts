const trimSlashes = (value: string): string => {
    return value.replace(/^\/+|\/+$/g, "");
};

const joinPath = (...segments: string[]): string => {
    const cleanedSegments = segments
        .map((segment) => trimSlashes(segment))
        .filter((segment) => segment.length > 0);

    return `/${cleanedSegments.join("/")}`;
};

const normalizeGeminiBasePath = (basePath: string): string => {
    if (basePath.endsWith("v1beta/openai")) {
        return basePath;
    }

    if (basePath.endsWith("v1beta")) {
        return joinPath(basePath, "openai");
    }

    if (basePath.endsWith("openai")) {
        return basePath;
    }

    return joinPath(basePath, "v1beta/openai");
};

export const buildPrefixedTargetUrl = (
    endpoint: string,
    requestPath: string,
    prefixToStrip = "/v1",
    providerType?: string | null,
): URL => {
    const targetUrl = new URL(endpoint);

    if (endpoint.endsWith("#")) {
        return targetUrl;
    }

    const currentBasePath = trimSlashes(targetUrl.pathname);

    if (providerType === "gemini") {
        const geminiBasePath = normalizeGeminiBasePath(currentBasePath);
        const normalizedRequestPath = requestPath.replace(/^\/v1(?=\/|$)/, "");
        targetUrl.pathname = joinPath(geminiBasePath, normalizedRequestPath);
        return targetUrl;
    }

    const normalizedPrefix = trimSlashes(prefixToStrip);
    const baseAlreadyContainsPrefix = normalizedPrefix.length > 0
        && currentBasePath.endsWith(normalizedPrefix);
    const explicitBasePath = endpoint.endsWith("/");

    let normalizedRequestPath = requestPath;
    if ((baseAlreadyContainsPrefix || explicitBasePath) && normalizedRequestPath.startsWith(prefixToStrip)) {
        normalizedRequestPath = normalizedRequestPath.slice(prefixToStrip.length);
    }

    targetUrl.pathname = joinPath(currentBasePath, normalizedRequestPath);
    return targetUrl;
};
