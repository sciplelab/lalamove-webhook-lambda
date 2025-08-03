import { createHmac } from "node:crypto";

// Enhanced fetch with timeout and error handling
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export function getHeaders({
  method,
  path,
  body,
}: {
  method: string;
  path: string;
  body: string;
}): Headers {
  const secret = process.env.SECRET;
  const apiKey = process.env.API_KEY;

  if (!secret || !apiKey) {
    throw new Error(
      "Missing required environment variables: SECRET and API_KEY"
    );
  }
  const time = Date.now().toString();

  const rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`;

  const SIGNATURE = createHmac("sha256", secret)
    .update(rawSignature)
    .digest("hex");
  const token = `${apiKey}:${time}:${SIGNATURE}`;

  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("Authorization", `hmac ${token}`);
  headers.append("Market", "MY");

  return headers;
}

export function validateWebhook(body: {
  apiKey: string;
  timestamp: number;
  signature: string;
  data: {};
}) {
  const secret = process.env.SECRET;
  const ezyDurApiKey = process.env.API_KEY;

  if (!secret || !ezyDurApiKey) {
    console.error("Missing required environment variables: SECRET and API_KEY");
    return false;
  }
  const method = "POST";
  const path = "/bt-lalamove-webhook";

  if (body.apiKey !== ezyDurApiKey) {
    console.warn("Invalid API key in webhook request");
    return false;
  }

  // Timestamp validation to prevent replay attacks
  const currentTime = Date.now();
  const requestTime = body.timestamp * 1000; // Convert to milliseconds
  const timeDifference = Math.abs(currentTime - requestTime);
  const WEBHOOK_TOLERANCE_MS = 300000; // 5 minutes tolerance

  if (timeDifference > WEBHOOK_TOLERANCE_MS) {
    console.warn("Webhook timestamp validation failed:", {
      current: currentTime,
      request: requestTime,
      difference: timeDifference,
      toleranceMs: WEBHOOK_TOLERANCE_MS,
    });
    return false;
  }

  const rawSignature = `${
    body.timestamp
  }\r\n${method}\r\n${path}\r\n\r\n${JSON.stringify(body.data)}`;
  const signature = createHmac("sha256", secret)
    .update(rawSignature)
    .digest("hex");

  return signature === body.signature;
}

export const API = {
  QUOTATION: "/v3/quotations",
  QUOTATION_DETAILS: "/v3/quotations/:quotationId",
  PLACE_ORDER: "/v3/orders",
  ORDER_DETAILS: "/v3/orders/:orderId",
  DRIVER_DETAILS: "/v3/orders/:orderId/drivers/:driverId",
  WEBHOOK: "/v3/webhook",
  CANCEL_ORDER: "/v3/orders/:orderId",
  CITY_INFO: "/v3/cities",
};

export const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://rest.lalamove.com"
    : "https://rest.sandbox.lalamove.com";

const GCHAT_API = process.env.GCHAT_API;

export const sendGChatMessage = async ({ message }: { message: string }) => {
  if (!GCHAT_API) {
    console.warn({
      message: "webhook URL not configured",
      function: "sendGChatMessage",
    });
    return { warning: "Webhook URL not configured" };
  }

  const chatRes = await fetchWithTimeout(
    GCHAT_API,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        text: `${getGMT8Time()} ${message}`,
      }),
    },
    10000
  ); // 10 second timeout for Google Chat
  const chatResult = await chatRes.json();

  console.info({
    message: "Gchat message sent",
    function: "sendGChatMessage",
  });

  return chatResult;
};

export const getGMT8Time = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kuala_Lumpur", // or 'Asia/Singapore'
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};
