export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE ?? '20', 10),
    matchMinScore: parseFloat(process.env.MATCH_MIN_SCORE ?? '60'),
  },
  googleSheets: {
    masterSpreadsheetId: process.env.GOOGLE_SHEETS_MASTER_SPREADSHEET_ID,
    masterSuppliersRange:
      process.env.GOOGLE_SHEETS_MASTER_SUPPLIERS_RANGE ?? 'Suppliers!A:Z',
    masterBuyersRange:
      process.env.GOOGLE_SHEETS_MASTER_BUYERS_RANGE ?? 'Buyers!A:Z',
    masterExportersRange:
      process.env.GOOGLE_SHEETS_MASTER_EXPORTERS_RANGE ?? 'Export!A:Z',
    sourceSuppliersSpreadsheetId:
      process.env.GOOGLE_SHEETS_SOURCE_SUPPLIERS_SPREADSHEET_ID,
    sourceSuppliersRange:
      process.env.GOOGLE_SHEETS_SOURCE_SUPPLIERS_RANGE ?? 'Suppliers!A:Z',
    sourceBuyersSpreadsheetId:
      process.env.GOOGLE_SHEETS_SOURCE_BUYERS_SPREADSHEET_ID,
    sourceBuyersRange:
      process.env.GOOGLE_SHEETS_SOURCE_BUYERS_RANGE ?? 'Buyers!A:Z',
    sourceExportersSpreadsheetId:
      process.env.GOOGLE_SHEETS_SOURCE_EXPORTERS_SPREADSHEET_ID,
    sourceExportersRange:
      process.env.GOOGLE_SHEETS_SOURCE_EXPORTERS_RANGE ?? 'Export!A:Z',
    serviceAccountEmail: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    pollIntervalMs: parseInt(process.env.GOOGLE_SHEETS_POLL_INTERVAL_MS ?? '15000', 10),
  },
});
