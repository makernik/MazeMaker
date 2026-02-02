/**
 * PDF Layout Configuration
 * 
 * US Letter page layout with margins and footer positioning.
 */

// US Letter dimensions in points (72 points = 1 inch)
export const PAGE_WIDTH = 8.5 * 72;  // 612 points
export const PAGE_HEIGHT = 11 * 72;  // 792 points

// Margins (0.5 inch minimum)
export const MARGIN = 0.5 * 72;  // 36 points

// Printable area
export const PRINTABLE_WIDTH = PAGE_WIDTH - (2 * MARGIN);
export const PRINTABLE_HEIGHT = PAGE_HEIGHT - (2 * MARGIN);

// Footer
export const FOOTER_TEXT = 'Generated with MakerNik Maze Tool';
export const FOOTER_URL = 'makernik.com';
export const FOOTER_HEIGHT = 24;  // points
