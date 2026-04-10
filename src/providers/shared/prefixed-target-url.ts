const trimSlashes = (value: string): string => {
    return value.replace(/^\/+|\/+$/g, "");
};

const joinPath = (...segments: string[]): string => {
    const cleanedSegments = segments
        .map((segment) => trimSlashes(segment))
        .filter((segment) => segment.length > 0);

    return `/${cleanedSegments.join("/")}`;
};

export const buildPrefixedTargetUrl = (
    endpoint: string,
    requestPath: string,
    prefixToStrip = "/v1"
): URL => {
    const targetUrl = new URL(endpoint);

    if (endpoint.endsWith("#")) {
        return targetUrl;
    }

    const currentBasePath = trimSlashes(targetUrl.pathname);
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
