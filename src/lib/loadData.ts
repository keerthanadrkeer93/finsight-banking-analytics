import Papa from 'papaparse'
import { buildDataset, type Row } from './dataset.ts'
import type { Dataset } from './types.ts'

const parse = (csv: string): Row[] => Papa.parse<Row>(csv, { header: true, skipEmptyLines: true }).data

/**
 * The CSVs in /data are imported as raw text, so Vite bundles them as lazy chunks:
 * one static request each, no server, no fetch URLs to configure. Parsed once at startup.
 */
export async function loadDataset(): Promise<Dataset> {
  const [customers, transactions, products, regions, channels] = await Promise.all([
    import('../../data/customers.csv?raw'),
    import('../../data/transactions.csv?raw'),
    import('../../data/products.csv?raw'),
    import('../../data/regions.csv?raw'),
    import('../../data/channels.csv?raw'),
  ])
  return buildDataset({
    customers: parse(customers.default),
    transactions: parse(transactions.default),
    products: parse(products.default),
    regions: parse(regions.default),
    channels: parse(channels.default),
  })
}
