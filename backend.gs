/**
 * Google Apps Script - MyFinance Backend (Simplified Revert)
 * 
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Paste this code and save.
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone).
 */

const SHEET_NAME = 'Transaksi';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'Timestamp']);
  }

  if (action === 'getTransactions') {
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const json = data.reverse().map(row => {
      let obj = {};
      headers.forEach((header, i) => obj[header.toLowerCase()] = row[i]);
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(json))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'Timestamp']);
    }

    const id = new Date().getTime();
    const timestamp = new Date();
    
    sheet.appendRow([
      id,
      data.tanggal,
      data.jenis,
      data.kategori,
      data.nominal,
      data.catatan,
      timestamp
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: id }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
