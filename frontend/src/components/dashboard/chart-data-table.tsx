interface ChartDataTableProps {
  caption: string
  headers: string[]
  rows: string[][]
}

// Text alternative for a chart: the same data as a real table, visible only to assistive tech.
export function ChartDataTable({ caption, headers, rows }: ChartDataTableProps) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([rowHeader, ...cells]) => (
            <tr key={rowHeader}>
              <th scope="row">{rowHeader}</th>
              {cells.map((cell, index) => (
                <td key={headers[index + 1]}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
