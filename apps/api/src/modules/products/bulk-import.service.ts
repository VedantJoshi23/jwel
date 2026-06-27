import { BadRequestException, Injectable } from '@nestjs/common';
import { CertificationType, MetalType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';
import { BulkImportResult } from './bulk-import.types';

const REQUIRED_COLUMNS = [
  'name',
  'slug',
  'category_slug',
  'description',
  'sku',
  'metal',
  'weight_grams',
  'base_price_minor_units',
] as const;

interface ParsedRow {
  [column: string]: string;
}

/**
 * Minimal hand-rolled CSV parser (no new dependency) — handles quoted fields
 * with embedded commas/escaped quotes (`""`), which is as much RFC4180 as an
 * admin-authored product catalog CSV realistically needs. Not a general-
 * purpose CSV library: no multi-line quoted fields across \r\n variations,
 * no streaming for huge files — acceptable for an admin bulk-upload of a
 * product catalog, not for arbitrary user-uploaded CSVs at scale.
 */
function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: ParsedRow = {};
    header.forEach((col, i) => {
      row[col] = values[i] ?? '';
    });
    return row;
  });
}

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * One row = one product with exactly one variant — matches
   * `CreateProductDto`'s shape exactly (a single-element `variants` array),
   * so multi-variant import (e.g. the same product in 3 sizes) isn't
   * supported in this version; each variant would need its own product row
   * with a distinct slug. A real scope cut, named rather than silently
   * worked around, since `CreateProductDto` would need a real redesign
   * (group rows by slug, merge variants) to support it properly.
   *
   * Reuses `ProductsService.adminCreate` per row rather than writing a
   * separate bulk-insert path — keeps validation, slug uniqueness, the
   * `product.upserted` event emission, and everything else exactly
   * consistent with a single manual product creation.
   */
  async importProductsCsv(fileBuffer: Buffer): Promise<BulkImportResult> {
    const rows = parseCsv(fileBuffer.toString('utf-8'));
    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty or has no data rows');
    }

    const missingColumns = REQUIRED_COLUMNS.filter((col) => !(col in rows[0]));
    if (missingColumns.length > 0) {
      throw new BadRequestException(`CSV is missing required column(s): ${missingColumns.join(', ')}`);
    }

    const categoryIdBySlug = new Map<string, string | null>();
    const result: BulkImportResult = { totalRows: rows.length, succeeded: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 for 0-index, +1 for the header row — matches what a human sees in a spreadsheet
      try {
        await this.importRow(rows[i], categoryIdBySlug);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({ row: rowNumber, message: (error as Error).message });
      }
    }

    return result;
  }

  private async importRow(row: ParsedRow, categoryIdBySlug: Map<string, string | null>): Promise<void> {
    for (const col of REQUIRED_COLUMNS) {
      if (!row[col]) {
        throw new Error(`Missing required value for column "${col}"`);
      }
    }

    const categorySlug = row.category_slug;
    if (!categoryIdBySlug.has(categorySlug)) {
      const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
      categoryIdBySlug.set(categorySlug, category?.id ?? null);
    }
    const categoryId = categoryIdBySlug.get(categorySlug);
    if (!categoryId) {
      throw new Error(`Category with slug "${categorySlug}" not found`);
    }

    if (!Object.values(MetalType).includes(row.metal as MetalType)) {
      throw new Error(`Invalid metal "${row.metal}" — must be one of ${Object.values(MetalType).join(', ')}`);
    }
    if (row.certification_type && !Object.values(CertificationType).includes(row.certification_type as CertificationType)) {
      throw new Error(`Invalid certification_type "${row.certification_type}"`);
    }

    const weightGrams = Number(row.weight_grams);
    const basePriceMinorUnits = Number(row.base_price_minor_units);
    if (!Number.isFinite(weightGrams) || weightGrams < 0) {
      throw new Error(`Invalid weight_grams "${row.weight_grams}"`);
    }
    if (!Number.isInteger(basePriceMinorUnits) || basePriceMinorUnits < 0) {
      throw new Error(`Invalid base_price_minor_units "${row.base_price_minor_units}" — must be a non-negative integer`);
    }

    await this.productsService.adminCreate({
      name: row.name,
      slug: row.slug,
      categoryId,
      description: row.description,
      certificationType: (row.certification_type as CertificationType) || undefined,
      certificationDocRef: row.certification_doc_ref || undefined,
      variants: [
        {
          sku: row.sku,
          metal: row.metal as MetalType,
          purity: row.purity || undefined,
          size: row.size || undefined,
          weightGrams,
          basePriceMinorUnits,
        },
      ],
    });
  }
}
