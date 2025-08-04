# Lalamove Webhook Service

A TypeScript AWS Lambda service for handling Lalamove webhook events with background processing using SQS.

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set environment variables** (create `.env` or set in AWS):
   ```bash
   export API_KEY="your-lalamove-api-key"
   export SECRET="your-webhook-secret"
   export MSSQL_DB_HOST="your-db-host"
   export MSSQL_DB_NAME="your-db-name"
   export MSSQL_DB_USER="your-db-user"
   export MSSQL_DB_PASSWORD="your-db-password"
   ```

3. **Deploy infrastructure**:
   ```bash
   npm run cdk:deploy
   ```

4. **Get webhook URL** from CDK output and configure in Lalamove dashboard.

## Architecture

The service uses a two-Lambda architecture with SQS for background processing:

```
Webhook → API Gateway → Receiver Lambda → SQS → Processor Lambda → Database
                            ↓
                      Immediate 200 Response
```

- **Receiver**: Validates signatures, queues messages, responds immediately
- **Processor**: Fetches order details, updates database in background
- **SQS**: Reliable message queue with dead letter queue for failures

## Features

- ✅ Immediate webhook response (< 1 second)
- ✅ Background processing with SQS
- ✅ Webhook signature validation using HMAC-SHA256
- ✅ Handles `ORDER_STATUS_CHANGED` events
- ✅ Automatically fetches order details when status is `COMPLETED`
- ✅ Updates database with order and delivery stop information
- ✅ Dead letter queue for failed messages
- ✅ Full TypeScript support with proper types
- ✅ Infrastructure as Code with AWS CDK
- ✅ Error handling and logging

## Environment Variables

Configure these environment variables for the Lambda function:

```bash
# Lalamove API Configuration
API_KEY=your_lalamove_api_key
SECRET=your_lalamove_secret
NODE_ENV=production  # or 'development' for sandbox

# Database Configuration (MSSQL)
MSSQL_DB_HOST=your_database_host
MSSQL_DB_NAME=your_database_name
MSSQL_DB_USER=your_database_user
MSSQL_DB_PASSWORD=your_database_password
```

## Database Schema

The function expects these database tables:

### LalamoveOrders
```sql
CREATE TABLE LalamoveOrders (
    OrderId NVARCHAR(50) PRIMARY KEY,
    Status NVARCHAR(20),
    DriverId NVARCHAR(50),
    ShareLink NVARCHAR(500),
    TotalAmount DECIMAL(10,2),
    Currency NVARCHAR(10),
    Distance INT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
```

### LalamoveStops
```sql
CREATE TABLE LalamoveStops (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    OrderId NVARCHAR(50) FOREIGN KEY REFERENCES LalamoveOrders(OrderId),
    StopSequence INT,
    DeliveryStatus NVARCHAR(20),
    DeliveredAt DATETIME2,
    PODImage NVARCHAR(500),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
```

## Webhook Payload

The function expects webhook payloads in this format:

```json
{
  "apiKey": "your_api_key",
  "timestamp": 1234567890,
  "signature": "hmac_signature",
  "eventType": "ORDER_STATUS_CHANGED",
  "data": {
    "updatedAt": "2025-08-01T10:24:35.00Z",
    "order": {
      "orderId": "187802475621",
      "status": "COMPLETED"
    }
  }
}
```

## Order Status Flow

1. **Webhook Received**: Function validates the webhook signature
2. **Status Check**: If status is `COMPLETED`, fetch full order details
3. **Order Details**: Call Lalamove API to get complete order information
4. **Database Update**: Update both order and delivery stop records
5. **Response**: Return appropriate HTTP status and message

## Supported Order Statuses

- `COMPLETED` - Triggers order details fetch and database update
- `FAILED` - Logged but no additional processing
- `CANCELLED` - Logged but no additional processing

## Development

```bash
# Type check
npm run typecheck

# Build functions
npm run compile

# Deploy changes
npm run cdk:deploy

# View changes
npm run cdk:diff

# Destroy infrastructure
npm run cdk:destroy
```

## Monitoring

- Check CloudWatch logs for both Lambda functions
- Monitor SQS queue metrics and dead letter queue
- Database update success/failure notifications via Google Chat

For detailed configuration and troubleshooting, see [CLAUDE.md](./CLAUDE.md).

## API Endpoints Used

- `GET /v3/orders/:orderId` - Fetch complete order details

## Error Handling

- Invalid webhook signatures return `400 Bad Request`
- Failed order detail fetching returns `200 OK` with error message
- Database errors return `500 Internal Server Error`
- All errors are logged with contextual information

## Security

- HMAC-SHA256 signature validation prevents unauthorized webhooks
- Environment variables for sensitive configuration
- Input validation and sanitization
- Proper error handling without exposing sensitive data