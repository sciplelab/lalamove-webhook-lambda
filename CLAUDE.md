# CLAUDE.md - Lalamove Webhook Project

## Project Overview

This is a TypeScript AWS Lambda function for handling Lalamove webhook events, specifically for processing order status changes and updating an MSSQL database when orders are completed.

## Project Structure

- `index.ts` - Main Lambda handler function
- `lib.ts` - Utility functions and types
- `mssql.ts` - Database connection and operations
- `dist/` - Compiled output for Lambda deployment

## Development Commands

```bash
# Type checking
npm run typecheck

# TypeScript compilation
npm run compile

# Lambda deployment (builds and deploys)
npm run lambda:deploy
```

## Key Technologies

- **Runtime**: Node.js with TypeScript
- **Database**: Microsoft SQL Server (mssql package)
- **Deployment**: AWS Lambda
- **Build Tool**: tsup for CommonJS output, tsc for ES modules
- **Package Manager**: pnpm

## Environment Variables Required

- `API_KEY` - Lalamove API key
- `SECRET` - Lalamove webhook secret for HMAC validation
- `NODE_ENV` - 'production' or 'development'
- `MSSQL_DB_HOST` - Database host
- `MSSQL_DB_NAME` - Database name
- `MSSQL_DB_USER` - Database user
- `MSSQL_DB_PASSWORD` - Database password

## Database Schema

Two main tables:

- `LalamoveOrders` - Order information
- `LalamoveStops` - Delivery stop details

## Code Conventions

- Use TypeScript with strict type checking
- Follow existing patterns in lib.ts for utility functions
- Use proper error handling and logging
- Maintain AWS Lambda best practices
- Database operations should use the mssql connection pattern

## Security Considerations

- HMAC-SHA256 webhook signature validation
- Environment variables for sensitive data
- Input validation and sanitization
- No exposure of sensitive data in error responses

## Testing Strategy

- Verify typecheck passes before deployment
- Test webhook signature validation
- Test database connectivity and operations
- Validate Lalamove API integration

## Deployment Notes

- Lambda function name: `bt-lalamove-webhook-v2`
- Uses CommonJS format for Lambda compatibility
- Single file deployment (index.js) includes all dependencies
