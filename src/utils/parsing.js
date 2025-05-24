// src/utils/parsing.js
import { marked } from 'marked';

/**
 * Basic parser to extract tables from Markdown text.
 * Assumes standard Markdown table syntax (pipes and hyphens).
 *
 * @param {string} markdownText The Markdown string potentially containing tables.
 * @returns {Array<object>} An array of table objects, each with { header: [], rows: [[]] }. Returns empty array if no tables found or on error.
 */
export const parseMarkdownTables = (markdownText) => {
  if (!markdownText) return [];

  const tables = [];
  try {
    const tokens = marked.lexer(markdownText);
    // console.log("Marked Tokens:", tokens); // DEBUG: See the token structure

    tokens.forEach(token => {
      if (token.type === 'table') {
        // Extract header cells (text content)
        const header = token.header.map(cell => cell.text);
        // Extract row cells (text content)
        const rows = token.rows.map(row => row.map(cell => cell.text));

        if (header.length > 0 || rows.length > 0) {
             tables.push({ header, rows });
        }
      }
    });
    console.log(`Parsed ${tables.length} tables from Markdown.`);
  } catch (error) {
    console.error("Error parsing Markdown tables:", error);
    // Return empty array or potentially throw error for caller to handle
  }
  return tables;
};

/**
 * Converts a parsed table object into an HTML string.
 *
 * @param {object} tableObject Table object { header: [], rows: [[]] }
 * @returns {string} HTML table string
 */


// Basic HTML escaping
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/'/g, "'");
 }

/**
 * Basic parser to extract tables from LaTeX tabular environments.
 * Handles simple cases with '&' as separator and '\\' as row terminator.
 * Ignores \hline and potential multicolumn/multirow for now.
 *
 * @param {string} latexString The LaTeX string potentially containing tables.
 * @returns {Array<object>} An array of table objects, each with { rows: [[]] }. Header detection is basic.
 */
export const parseLatexTables = (latexString) => {
  if (!latexString) return [];

  const tables = [];
  // Regex to find tabular environments (non-greedy match for content)
  // It captures the content between \begin{tabular}...\end{tabular}
  // Note: This regex is basic and might fail on nested tables or complex preamble/options.
  const tableRegex = /\\begin{tabular}(\*?)\s*(?:\[[^\]]*\])?\s*(?:\{[^}]*\})\s*([\s\S]*?)\\end{tabular}/g;

  let match;
  while ((match = tableRegex.exec(latexString)) !== null) {
    const tableContent = match[2]; // Get the content inside the tabular environment
    // console.log("Found Table Content:\n", tableContent); // DEBUG

    if (!tableContent) continue;

    // Split content into lines, trim whitespace
    const lines = tableContent.split('\\\\').map(line => line.trim()).filter(line => line); // Split by \\, trim, remove empty lines

    if (lines.length === 0) continue;

    const tableRows = [];
    let headerRow = []; // Basic header detection (first non-\hline line)

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Ignore horizontal lines or other commands for now
        if (line.includes('\\hline') || !line.includes('&')) {
             // Could potentially use lines before the first '&' containing line as header,
             // but let's keep it simple: treat first data row as potential header below.
             continue;
        }

        // Split row by cell separator '&', trim each cell
        const cells = line.split('&').map(cell => cell.trim());
        tableRows.push(cells);
    }

     // Basic Header Assumption: Use the first actual data row as header if available
     if (tableRows.length > 0) {
         headerRow = tableRows[0]; // Assume first row is header
         // Optionally remove it from data rows if you want strict separation:
         // tableRows.shift();
     }

    if (tableRows.length > 0) { // Only add if we found rows
        tables.push({ header: headerRow, rows: tableRows }); // Store header and rows
    }
  }

  console.log(`Parsed ${tables.length} potential tables from LaTeX.`);
  return tables;
};

/**
 * Converts a parsed table object (from LaTeX or Markdown) into an HTML string.
 *
 * @param {object} tableObject Table object { header?: [], rows: [[]] }
 * @returns {string} HTML table string
 */
export const tableObjectToHtml = (tableObject) => {
    if (!tableObject || !tableObject.rows || tableObject.rows.length === 0) return '<p><i>Empty or invalid table data.</i></p>';

    let html = '<table border="1" style="border-collapse: collapse; width: 100%;">';
    let hasRenderedHeader = false;

    // Render Header if explicitly present and non-empty
    if (tableObject.header && tableObject.header.some(cell => cell.trim() !== '')) {
        html += '<thead><tr>';
        tableObject.header.forEach(cell => {
            html += `<th style="border: 1px solid #ddd; padding: 4px; text-align: left; font-weight: bold; background-color: #f2f2f2;">${escapeHtml(cell)}</th>`;
        });
        html += '</tr></thead>';
        hasRenderedHeader = true;
    }

    // Render Body Rows
    html += '<tbody>';
    tableObject.rows.forEach((row, rowIndex) => {
        // If we assumed first row was header AND didn't render an explicit header, skip first row here
        // if (hasRenderedHeader === false && rowIndex === 0) return; // Skip if first row was used as header

        html += '<tr>';
        // Ensure cells are treated as an array
        const cells = Array.isArray(row) ? row : [row];
        cells.forEach(cell => {
            // Render as TH if it's the first row and no separate header was rendered
            const tag = (!hasRenderedHeader && rowIndex === 0) ? 'th style="font-weight: bold; background-color: #f2f2f2;"' : 'td';
            html += `<${tag} style="border: 1px solid #ddd; padding: 4px; text-align: left;">${escapeHtml(cell)}</${tag.split(' ')[0]}>`; // Ensure closing tag is just td/th
        });
        html += '</tr>';
    });
    html += '</tbody>';

    html += '</table>';
    return html;
};
