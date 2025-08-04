import { validateWebhook } from "./lib";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  type lalamoveWebhookEvents,
  type lalamoveOrderStatus,
  queueOrderForProcessing,
} from "./lib";

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let body: LalamoveWebhookPayload;

  try {
    const rawBody = event.body;
    if (rawBody) {
      body = JSON.parse(rawBody);
      const valid = validateWebhook(body);

      if (!valid) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid Webhook" }),
        };
      }

      console.debug("LALAMOVE WEBHOOK BODY", { body });

      // send to SQS
      await queueOrderForProcessing({
        orderId: body.data.order.orderId,
        status: body.data.order.status,
        webhookData: body,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Webhook received" }),
      };
    } else {
      console.debug("LALAMOVE WEBHOOK: Empty body received");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Post webhook activation data" }),
      };
    }
  } catch (error) {
    console.error("Error parsing request body", { error });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }
};
