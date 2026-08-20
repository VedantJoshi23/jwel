import { join } from 'path';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';

// pdfkit's built-in standard fonts (Helvetica etc.) are WinAnsi-only — no
// glyph for ₹ (U+20B9). Without this, every price in the PDF rendered as a
// mangled "¹5,000" instead of "₹5,000" (found by actually opening a
// generated PDF, not assumed). DejaVu Sans has the glyph; bundled under
// src/assets/fonts (copied to dist/assets/fonts by nest-cli.json's asset
// list, the same mechanism already used for prisma/schema.prisma) so this
// works identically in dev and the built Docker image, independent of cwd.
const FONT_REGULAR = join(__dirname, '../../assets/fonts/DejaVuSans.ttf');
const FONT_BOLD = join(__dirname, '../../assets/fonts/DejaVuSans-Bold.ttf');

// FEAT-CATALOGUE-EXPORT. A synchronous, in-request PDF build — no queue, no
// background job. Fine at today's catalogue size; if a full-catalogue export
// ever proves too slow in practice, that's a named follow-up (a queued
// generation job), not something to build speculatively now (see the
// feature spec's Edge Case 5 / Constitution Law 3).

export type CatalogueScope = { categoryId: string } | { collectionId: string } | { categoryId?: undefined; collectionId?: undefined };

interface CatalogueProductRow {
  name: string;
  minPriceMinorUnits: number;
  imageUrl?: string;
  categoryName: string;
  categorySortOrder: number;
}

interface CatalogueData {
  title: string;
  products: CatalogueProductRow[];
}

const PAGE_MARGIN = 40;
const CARD_SIZE = 130;
const CARD_GAP = 20;
const IMAGE_FETCH_CONCURRENCY = 8;

function formatPriceInr(minorUnits: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    minorUnits / 100,
  );
}

@Injectable()
export class CatalogueExportService {
  private readonly logger = new Logger(CatalogueExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort,
  ) {}

  async generatePdf(scope: CatalogueScope): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.loadCatalogue(scope);
    const buffer = await this.renderPdf(data);
    const filename = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-catalogue.pdf`;
    return { buffer, filename };
  }

  private async loadCatalogue(scope: CatalogueScope): Promise<CatalogueData> {
    if ('categoryId' in scope) {
      const category = await this.prisma.category.findFirst({
        where: { id: scope.categoryId, deletedAt: null },
      });
      if (!category) throw new NotFoundException('Category not found');
      const rows = await this.prisma.product.findMany({
        where: { status: ProductStatus.PUBLISHED, deletedAt: null, categoryId: scope.categoryId },
        include: { category: true, variants: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      });
      return { title: category.name, products: this.toRows(rows) };
    }

    if ('collectionId' in scope) {
      const collection = await this.prisma.collection.findUnique({
        where: { id: scope.collectionId },
      });
      if (!collection) throw new NotFoundException('Collection not found');
      const links = await this.prisma.collectionProduct.findMany({
        where: { collectionId: scope.collectionId, product: { status: ProductStatus.PUBLISHED, deletedAt: null } },
        orderBy: { sortOrder: 'asc' },
        include: {
          product: { include: { category: true, variants: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
        },
      });
      return { title: collection.name, products: this.toRows(links.map((l) => l.product)) };
    }

    const rows = await this.prisma.product.findMany({
      where: { status: ProductStatus.PUBLISHED, deletedAt: null },
      include: { category: true, variants: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    return { title: 'Full Catalogue', products: this.toRows(rows) };
  }

  private toRows(
    products: {
      name: string;
      variants: { basePriceMinorUnits: number }[];
      media: { storageRef: string }[];
      category: { name: string; sortOrder: number };
    }[],
  ): CatalogueProductRow[] {
    return products.map((p) => ({
      name: p.name,
      minPriceMinorUnits: p.variants.length ? Math.min(...p.variants.map((v) => v.basePriceMinorUnits)) : 0,
      imageUrl: p.media[0] ? this.storage.resolveUrl(p.media[0].storageRef) : undefined,
      categoryName: p.category.name,
      categorySortOrder: p.category.sortOrder,
    }));
  }

  /** One failed fetch must not fail the whole export (FEAT-CATALOGUE-EXPORT Edge Case 4). */
  private async fetchImage(url: string): Promise<Buffer | undefined> {
    try {
      const response = await fetch(url);
      if (!response.ok) return undefined;
      return Buffer.from(await response.arrayBuffer());
    } catch (err) {
      this.logger.warn(`Catalogue export: failed to fetch image ${url}: ${(err as Error).message}`);
      return undefined;
    }
  }

  private async fetchImagesWithLimit(products: CatalogueProductRow[]): Promise<Map<string, Buffer | undefined>> {
    const results = new Map<string, Buffer | undefined>();
    const withImages = products.filter((p): p is CatalogueProductRow & { imageUrl: string } => Boolean(p.imageUrl));
    for (let i = 0; i < withImages.length; i += IMAGE_FETCH_CONCURRENCY) {
      const batch = withImages.slice(i, i + IMAGE_FETCH_CONCURRENCY);
      const buffers = await Promise.all(batch.map((p) => this.fetchImage(p.imageUrl)));
      batch.forEach((p, idx) => results.set(p.imageUrl, buffers[idx]));
    }
    return results;
  }

  private async renderPdf(data: CatalogueData): Promise<Buffer> {
    const images = await this.fetchImagesWithLimit(data.products);

    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    doc.registerFont('Body', FONT_REGULAR);
    doc.registerFont('Heading', FONT_BOLD);
    doc.font('Body');

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.font('Heading').fontSize(24).text('ELYSIAN', { align: 'center' });
    doc.fontSize(16).text(data.title, { align: 'center' });
    doc
      .font('Body')
      .fontSize(9)
      .fillColor('#666666')
      .text(`Generated ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(2);

    if (data.products.length === 0) {
      doc.fontSize(12).text('No published products in this selection.', { align: 'center' });
      doc.end();
      return done;
    }

    const groups = new Map<string, CatalogueProductRow[]>();
    for (const product of data.products) {
      const list = groups.get(product.categoryName) ?? [];
      list.push(product);
      groups.set(product.categoryName, list);
    }
    const sortedGroups = [...groups.entries()].sort(
      ([, a], [, b]) => a[0].categorySortOrder - b[0].categorySortOrder,
    );

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const columns = Math.max(1, Math.floor((pageWidth + CARD_GAP) / (CARD_SIZE + CARD_GAP)));

    for (const [categoryName, products] of sortedGroups) {
      products.sort((a, b) => a.name.localeCompare(b.name));

      if (doc.y > PAGE_MARGIN + 40) doc.moveDown(1);
      doc.font('Heading').fontSize(14).text(categoryName, { underline: true });
      doc.font('Body');
      doc.moveDown(0.5);

      let col = 0;
      let rowStartY = doc.y;

      for (const product of products) {
        if (rowStartY + CARD_SIZE + 40 > doc.page.height - PAGE_MARGIN) {
          doc.addPage();
          rowStartY = PAGE_MARGIN;
          col = 0;
        }

        const x = PAGE_MARGIN + col * (CARD_SIZE + CARD_GAP);
        const imageBuffer = product.imageUrl ? images.get(product.imageUrl) : undefined;

        if (imageBuffer) {
          try {
            doc.image(imageBuffer, x, rowStartY, { fit: [CARD_SIZE, CARD_SIZE], align: 'center', valign: 'center' });
          } catch (err) {
            this.logger.warn(`Catalogue export: unrenderable image for "${product.name}": ${(err as Error).message}`);
            this.drawPlaceholder(doc, x, rowStartY);
          }
        } else {
          this.drawPlaceholder(doc, x, rowStartY);
        }

        doc
          .fontSize(9)
          .text(product.name, x, rowStartY + CARD_SIZE + 4, { width: CARD_SIZE, height: 24, ellipsis: true })
          .fontSize(9)
          .fillColor('#333333')
          .text(formatPriceInr(product.minPriceMinorUnits), x, rowStartY + CARD_SIZE + 28, { width: CARD_SIZE })
          .fillColor('#000000');

        col += 1;
        if (col >= columns) {
          col = 0;
          rowStartY += CARD_SIZE + 48;
        }
      }

      doc.y = rowStartY + (col > 0 ? CARD_SIZE + 48 : 0) + 10;
    }

    doc.end();
    return done;
  }

  private drawPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number): void {
    doc
      .rect(x, y, CARD_SIZE, CARD_SIZE)
      .fillAndStroke('#f0f0f0', '#dddddd')
      .fontSize(8)
      .fillColor('#999999')
      .text('No image', x, y + CARD_SIZE / 2 - 4, { width: CARD_SIZE, align: 'center' })
      .fillColor('#000000');
  }
}
