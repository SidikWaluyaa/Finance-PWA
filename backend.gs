/**
 * Google Apps Script - MyFinance Backend
 * 
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Paste this code and save.
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone).
 * 5. Copy the Web App URL to app.js CONFIG.API_URL.
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
}

// Special function to handle receipt upload to Drive if needed
function uploadToDrive(base64Data, filename) {
  const folder = DriveApp.getFoldersByName('MyFinance Receipts').next();
  const contentType = base64Data.substring(5, base64Data.indexOf(';'));
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, filename);
  folder.createFile(blob);
  return { status: 'success' };
}
