export type RouteId = "chat-completions" | "messages" | "responses" | "audio-speech"

type RoutePolicy = {
    allowedTypes: ChannelType[] | null
}

const CHAT_COMPLETIONS_CHANNEL_TYPES: ChannelType[] = [
    "openai",
    "azure-openai",
    "gemini",
]

const MESSAGES_CHANNEL_TYPES: ChannelType[] = [
    "claude",
    "claude-to-openai",
]

const ROUTE_POLICIES: Record<RouteId, RoutePolicy> = {
    "chat-completions": { allowedTypes: CHAT_COMPLETIONS_CHANNEL_TYPES },
    "messages":         { allowedTypes: MESSAGES_CHANNEL_TYPES },
    "responses":        { allowedTypes: ["openai-responses", "azure-openai-responses"] },
    "audio-speech":     { allowedTypes: ["openai-audio", "azure-openai-audio"] },
}

export const resolveRouteId = (pathname: string): RouteId | null => {
    if (pathname.endsWith("/chat/completions")) return "chat-completions"
    if (pathname.endsWith("/messages")) return "messages"
    if (pathname.endsWith("/responses")) return "responses"
    if (pathname.endsWith("/audio/speech")) return "audio-speech"
    return null
}

export const getRoutePolicy = (routeId: RouteId): RoutePolicy => {
    return ROUTE_POLICIES[routeId]
}
