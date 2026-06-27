export interface BulkImportRowError {
  row: number;
  message: string;
}

export interface BulkImportResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  errors: BulkImportRowError[];
}
