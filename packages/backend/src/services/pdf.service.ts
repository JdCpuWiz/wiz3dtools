import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PdfService {
  /**
   * Convert PDF to base64-encoded images
   * @param pdfPath Path to the PDF file
   * @returns Array of base64-encoded images
   */
  async convertPdfToImages(pdfPath: string): Promise<string[]> {
    const outputDir = path.join(path.dirname(pdfPath), `temp_${Date.now()}`);

    try {
      // Create temporary directory for images
      await fs.mkdir(outputDir, { recursive: true });

      // Use pdftoppm directly to convert PDF to PNG images
      // -png: output format PNG
      // -r 150: resolution 150 DPI for good quality
      const outputPrefix = path.join(outputDir, 'page');
      const command = `pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`;

      await execAsync(command);

      // Read all generated PNG files
      const files = await fs.readdir(outputDir);
      const imageFiles = files
        .filter(f => f.endsWith('.png'))
        .sort((a, b) => {
          // Extract page numbers for proper sorting
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });

      const images: string[] = [];
      for (const file of imageFiles) {
        const imagePath = path.join(outputDir, file);
        const buffer = await fs.readFile(imagePath);
        images.push(buffer.toString('base64'));
      }

      return images;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary directory:', cleanupError);
      }
    }
  }

  /**
   * Validate PDF file
   * @param filePath Path to the file
   * @returns True if valid PDF
   */
  async validatePdf(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      // Check PDF magic number
      return buffer.toString('utf8', 0, 4) === '%PDF';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get PDF page count
   * @param pdfPath Path to the PDF file
   * @returns Number of pages
   */
  async getPageCount(pdfPath: string): Promise<number> {
    try {
      // Use pdfinfo to get page count
      const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
      const match = stdout.match(/Pages:\s+(\d+)/);
      return match ? parseInt(match[1]) : 1;
    } catch (error) {
      console.error('Error getting page count:', error);
      return 1;
    }
  }
}
