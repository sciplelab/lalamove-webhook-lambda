import { createHmac } from "node:crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export type lalamoveWebhookEvents = "ORDER_STATUS_CHANGED";
export type lalamoveOrderStatus = "COMPLETED" | "CANCELLED";
export type lalamoveStopStatus = "PENDING" | "DELIVERED" | "FAILED";
interface LalamoveWebhookPayload {
  apiKey: string;
  timestamp: number;
  signature: string;
  eventType: lalamoveWebhookEvents;
  data: {
    updatedAt: string;
    order: {
      orderId: string;
      status: lalamoveOrderStatus;
    };
  };
}

interface OrderProcessingMessage {
  orderId: string;
  status: lalamoveOrderStatus;
  timestamp: number;
  webhookData: LalamoveWebhookPayload;
  eventType: lalamoveWebhookEvents;
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

export function getHeaders({
  method,
  path,
  body,
  market = "MY",
}: {
  method: string;
  path: string;
  body: string;
  market?: string;
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
  headers.append("Market", market);

  return headers;
}

export function validateWebhook(body: {
  apiKey: string;
  timestamp: number;
  signature: string;
  data: {};
}) {
  const secret = process.env.SECRET;
  const lalamoveApiKey = process.env.API_KEY;

  if (!secret || !lalamoveApiKey) {
    console.error("Missing required environment variables: SECRET and API_KEY");
    return false;
  }
  const method = "POST";
  const path = "/Prod/bt-lalamove-webhook-v2";

  if (body.apiKey !== lalamoveApiKey) {
    console.warn("Invalid API key in webhook request");
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

export const sendGChatMessage = async ({
  message,
}: {
  message: string;
}): Promise<void> => {
  if (!GCHAT_API) {
    console.warn({
      message: "webhook URL not configured",
      function: "sendGChatMessage",
    });
    return;
  }

  const response = await fetch(GCHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      text: `${getGMT8Time()} ${message}`,
    }),
  });

  if (!response.ok) {
    console.error(`Failed to send message to GChat: ${response.statusText}`);
  }

  console.log("Message sent to GChat:", message);
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

const sqs = new SQSClient({
  region: "ap-southeast-1",
});

export async function queueOrderForProcessing({
  orderId,
  status,
  webhookData,
}: {
  orderId: string;
  status: lalamoveOrderStatus;
  webhookData: LalamoveWebhookPayload;
}): Promise<boolean> {
  try {
    const message: OrderProcessingMessage = {
      orderId,
      status,
      eventType: webhookData.eventType,
      timestamp: Date.now(),
      webhookData,
    };

    const command = new SendMessageCommand({
      QueueUrl: process.env.ORDER_PROCESSING_QUEUE_URL!,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        orderId: {
          DataType: "String",
          StringValue: orderId,
        },
        status: {
          DataType: "String",
          StringValue: status,
        },
        eventType: {
          DataType: "String",
          StringValue: webhookData.eventType,
        },
      },
    });

    const result = await sqs.send(command);
    console.log(
      `Successfully queued order ${orderId} for processing:`,
      result.MessageId
    );
    return true;
  } catch (error) {
    console.error(`Failed to queue order ${orderId} for processing:`, error);
    return false;
  }
}
