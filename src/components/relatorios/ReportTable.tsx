interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
}

interface ReportTableProps<T> {
  columns: Column<T>[];
  data: T[];
  empty?: string;
}

export function ReportTable<T>({ columns, data, empty = 'Sem dados para o periodo.' }: ReportTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-white/8 bg-white/[0.035]">
            <tr>
              {columns.map(column => (
                <th
                  key={column.header}
                  className={`px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white/45 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-white/45">
                  {empty}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-white/[0.035]">
                  {columns.map(column => (
                    <td
                      key={column.header}
                      className={`px-5 py-4 text-sm text-white/75 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
