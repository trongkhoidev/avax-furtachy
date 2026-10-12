declare module "pg" {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export class Pool {
    constructor(config: { connectionString: string; max?: number });
    query<Row extends QueryResultRow = QueryResultRow>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
    end(): Promise<void>;
  }
}
