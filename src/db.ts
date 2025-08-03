import sql from "mssql";

// Database configuration interface
interface DbConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort?: boolean;
    charset?: string;
  };
}

// SQL configuration
const sqlConfig: DbConfig = {
  server: process.env.MSSQL_DB_HOST || "",
  database: process.env.MSSQL_DB_NAME || "",
  user: process.env.MSSQL_DB_USER || "",
  password: process.env.MSSQL_DB_PASSWORD || "",
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: false,
    enableArithAbort: true,
    charset: "UTF-8",
  },
};

// Database connection pool
let pool: sql.ConnectionPool | null = null;

/**
 * Gets or creates a database connection pool
 * @returns SQL connection pool
 */
export async function getConnection(): Promise<sql.ConnectionPool> {
  try {
    if (pool) {
      return pool;
    }

    pool = await new sql.ConnectionPool(sqlConfig).connect();
    return pool;
  } catch (error) {
    throw new Error(`Database connection failed: ${error}`);
  }
}

/**
 * Executes a SQL query with parameters
 * @param query - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function executeQuery<T>(
  query: string,
  params: { [key: string]: any } = {}
): Promise<T> {
  try {
    const connection = await getConnection();
    const request = connection.request();

    // Add parameters to the request
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query(query);
    return result.recordset as T;
  } catch (error) {
    console.error("SQL Error:", error);
    throw new Error(`Query execution failed: ${error}`);
  }
}

/**
 * Executes a stored procedure with parameters
 * @param procedureName - Name of the stored procedure
 * @param params - Procedure parameters
 * @returns Procedure result
 */
export async function executeStoredProcedure<T>(
  procedureName: string,
  params: { [key: string]: any } = {}
): Promise<T> {
  try {
    const connection = await getConnection();
    const request = connection.request();

    // Add parameters to the request
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.execute(procedureName);
    return result.recordset as T;
  } catch (error) {
    throw new Error(`Stored procedure execution failed: ${error}`);
  }
}

/**
 * Executes multiple queries in a transaction
 * @param queries - Array of query objects with SQL and parameters
 * @returns Transaction result
 */
export async function executeTransaction<T>(
  queries: Array<{ query: string; params?: { [key: string]: any } }>
): Promise<T[]> {
  const connection = await getConnection();
  const transaction = connection.transaction();
  const results: T[] = [];

  try {
    await transaction.begin();

    for (const { query, params = {} } of queries) {
      const request = transaction.request();

      // Add parameters to the request
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });

      const result = await request.query(query);
      results.push(result.recordset as T);
    }

    await transaction.commit();
    return results;
  } catch (error) {
    await transaction.rollback();
    throw new Error(`Transaction failed: ${error}`);
  }
}
