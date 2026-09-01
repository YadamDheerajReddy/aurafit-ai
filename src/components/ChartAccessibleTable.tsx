interface ChartAccessibleTableProps {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Screen-reader-only data table fallback for a chart, per the UI/UX Brief's accessibility bar. */
export function ChartAccessibleTable({ caption, columns, rows }: ChartAccessibleTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
