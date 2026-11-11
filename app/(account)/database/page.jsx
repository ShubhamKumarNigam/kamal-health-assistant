import { Database, Table2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getAuthDatabaseSnapshot } from "@/lib/auth/sqliteStore";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function DatabasePage() {
    let snapshot = null;
    let databaseError = null;
    try {
        snapshot = await getAuthDatabaseSnapshot();
    }
    catch (error) {
        databaseError = error instanceof Error ? error.message : "The database could not be opened.";
    }
    return (<AppShell description="Browse the hosted Postgres database in a readable table layout for reviewer verification." eyebrow="Hosted data" title="Database viewer">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold text-text-primary">
              <Database aria-hidden="true" className="h-5 w-5"/>
              <h2>KAMAL Postgres</h2>
            </div>
            <p className="mt-2 break-all text-sm leading-6 text-text-secondary">
              {snapshot?.path || "The configured database file could not be opened."}
            </p>
          </div>
          <p className="rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-primary">
            {snapshot ? `${snapshot.tables.length} tables and views` : "Unavailable"}
          </p>
        </div>
      </section>

      {databaseError ? (<section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-soft">
          <h2 className="text-xl font-bold text-text-primary">Database cannot be displayed</h2>
          <p className="mt-3 leading-7 text-text-secondary">
            Postgres reported the database as unavailable: {databaseError}
          </p>
          <p className="mt-3 leading-7 text-text-secondary">
            The viewer is ready, but the hosted database must be configured before rows and columns
            can be shown.
          </p>
        </section>) : null}

      {snapshot ? (<div className="mt-6 space-y-6">
          {snapshot.tables.map((table) => (<section className="overflow-hidden rounded-lg border border-border bg-surface shadow-soft" key={`${table.type}-${table.name}`}>
              <div className="flex flex-col gap-2 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Table2 aria-hidden="true" className="h-5 w-5 text-primary"/>
                  <h2 className="text-xl font-bold">{table.name}</h2>
                  <span className="rounded-lg bg-bg px-2 py-1 text-xs font-bold uppercase tracking-normal text-primary">
                    {table.type}
                  </span>
                </div>
                <p className="text-sm font-semibold text-text-secondary">
                  {table.rowCount === null ? `${table.rows.length} visible rows` : `${table.rowCount} rows`}
                </p>
              </div>

              {table.columns.length > 0 ? (<div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-bg text-primary">
                      <tr>
                        {table.columns.map((column) => (<th className="border-b border-border px-4 py-3 font-bold" key={column} scope="col">
                            {column}
                          </th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.length > 0 ? (table.rows.map((row, rowIndex) => (<tr className="border-b border-border last:border-b-0" key={rowIndex}>
                            {table.columns.map((column) => (<td className="max-w-[280px] whitespace-nowrap px-4 py-3 text-text-secondary" key={column} title={row[column]}>
                                {row[column]}
                              </td>))}
                          </tr>))) : (<tr>
                          <td className="px-4 py-6 text-center text-text-secondary" colSpan={table.columns.length}>
                            No rows yet.
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>) : (<p className="px-5 py-6 text-text-secondary">No columns found.</p>)}
            </section>))}
        </div>) : null}
    </AppShell>);
}
