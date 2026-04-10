const trimSlashes = (value: string): string => {
    return value.replace(/^\/+|\/+$/g, "");
};

const joinPath = (...segments: string[]): string => {
    const cleanedSegments = segments
        .map((segment) => trimSlashes(segment))
        .filter((segment) => segment.length > 0);

    return `/${cleanedSegments.join("/")}`;
};

export const buildAzureTargetUrl = (
    request: Request,
    endpoint: string
): URL => {
    const requestUrl = new URL(request.url);
    return buildAzureTargetUrlFromPath(endpoint, requestUrl.pathname);
};

export const buildAzureTargetUrlFromPath = (
    endpoint: string,
    path: string
): URL => {
    const targetUrl = new URL(endpoint);

    if (endpoint.endsWith("#")) {
        return targetUrl;
    }

    const requestPath = path.replace(/^\/v1/, "");
    const currentBasePath = trimSlashes(targetUrl.pathname);
    const explicitBasePath = endpoint.endsWith("/");
    const azureBasePath = currentBasePath.endsWith("openai/v1")
        ? currentBasePath
        : currentBasePath.endsWith("openai")
            ? explicitBasePath
                ? currentBasePath
                : joinPath(currentBasePath, "v1")
            : explicitBasePath
                ? joinPath(currentBasePath, "openai")
                : joinPath(currentBasePath, "openai/v1");

    targetUrl.pathname = joinPath(azureBasePath, requestPath);

    return targetUrl;
};
