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
    const targetUrl = new URL(endpoint);

    if (endpoint.endsWith("#")) {
        return targetUrl;
    }

    const requestPath = requestUrl.pathname.replace(/^\/v1/, "");
    const currentBasePath = trimSlashes(targetUrl.pathname);
    const azureBasePath = currentBasePath.endsWith("openai/v1")
        ? currentBasePath
        : joinPath(currentBasePath, "openai/v1");

    targetUrl.pathname = joinPath(azureBasePath, requestPath);

    return targetUrl;
};
