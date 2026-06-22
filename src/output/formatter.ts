export type OutputFormat = 'json' | 'table';

export function getOutputFormat(options: { output?: string }): OutputFormat {
  return options.output === 'json' ? 'json' : 'table';
}

/**
 * Render data to stdout. `json` prints the raw payload; `table` prints arrays
 * via console.table and objects as aligned key/value pairs.
 */
export function output(data: unknown, format: OutputFormat = 'table'): void {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('No data');
      return;
    }
    if (typeof data[0] === 'object' && data[0] !== null) {
      console.table(data);
    } else {
      for (const item of data) console.log(`  ${String(item)}`);
    }
    return;
  }

  if (data !== null && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      console.log('No data');
      return;
    }
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    for (const [key, value] of entries) {
      const displayValue =
        value !== null && typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
      console.log(`  ${key.padEnd(maxKeyLen + 2)} ${displayValue}`);
    }
    return;
  }

  console.log(String(data));
}

/** Print a list of objects as a table, or "No data" when empty. */
export function outputTable(rows: Record<string, unknown>[], format: OutputFormat): void {
  if (format === 'json') {
    output(rows, 'json');
    return;
  }
  output(rows, 'table');
}
