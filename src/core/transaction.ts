import pg from 'pg';

export async function runInTransaction(pool: pg.Pool, statements: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of statements) {
      await client.query(sql);
    }
    await client.query('COMMIT');
  } catch (e: any) {
    await client.query('ROLLBACK');
    throw new Error(`Transaction failed: ${e.message}`);
  } finally {
    client.release();
  }
}
