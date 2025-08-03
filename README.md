# Lalamove Webhook Lambda Function

A TypeScript Lambda function to handle Lalamove webhook events, specifically designed for processing order status changes and fetching order details when orders are completed.

## Features

- ✅ Webhook signature validation using HMAC-SHA256
- ✅ Handles `ORDER_STATUS_CHANGED` events
- ✅ Automatically fetches order details when status is `COMPLETED`
- ✅ Updates database with order and delivery stop information
- ✅ Full TypeScript support with proper types
- ✅ Error handling and logging
- ✅ AWS Lambda optimized

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

## Build and Deploy

```bash
# Install dependencies
pnpm install

# Type check
npm run typecheck

# Build for Lambda (CommonJS)
npm run build

# Build as ESM (if needed)
npm run build:esm

# Compile only index.ts with tsc (new)
npm run compile
```

The built function will be in `dist/index.js` ready for Lambda deployment.

## TypeScript Compilation

To compile only index.ts with TypeScript compiler:

```bash
npm run compile
```

This will compile index.ts and any imported modules to the dist folder according to the tsconfig.json configuration. The tsconfig.json has been configured to include only index.ts and its dependencies, excluding other files in the project. The output uses ES modules for better compatibility with modern Node.js environments like AWS Lambda.

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