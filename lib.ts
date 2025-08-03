import { createHmac } from "node:crypto";

export function getHeaders({
  method,
  path,
  body,
}: {
  method: string;
  path: string;
  body: string;
}): Headers {
  const secret = process.env.SECRET!;
  const apiKey = process.env.API_KEY!;
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
  const secret = process.env.SECRET!;
  const ezyDurApiKey = process.env.API_KEY!;
  const method = "POST";
  const path = "/bt-lalamove-webhook";

  if (body.apiKey !== ezyDurApiKey) {
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
      message: "GOOGLE_CHAT_OFFLINE_ORDERS webhook URL not configured",
      function: "sendGChatMessage",
    });
    return { warning: "Webhook URL not configured" };
  }

  const chatRes = await fetch(GCHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      text: `${getGMT8Time()} ${message}`,
    }),
  });
  const chatResult = await chatRes.json();

  console.info({
    message: "Gchat message sent to GOOGLE_CHAT_OFFLINE_ORDERS",
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
