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
export const tableObjectToHtml = (tableObject) => {
    if (!tableObject) return '';
    let html = '<table border="1" style="border-collapse: collapse; width: 100%;">';
    // Header
    if (tableObject.header && tableObject.header.length > 0) {
        html += '<thead><tr>';
        tableObject.header.forEach(cell => {
            html += `<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">${escapeHtml(cell)}</th>`;
        });
        html += '</tr></thead>';
    }
    // Body
    if (tableObject.rows && tableObject.rows.length > 0) {
        html += '<tbody>';
        tableObject.rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td style="border: 1px solid #ddd; padding: 4px;">${escapeHtml(cell)}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
    }
    html += '</table>';
    return html;
};

// Basic HTML escaping
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/'/g, "'");
 }