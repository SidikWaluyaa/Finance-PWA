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
const DRIVE_FOLDER_NAME = 'MyFinance Receipts';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'Foto', 'Timestamp']);
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
      sheet.appendRow(['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'Foto', 'Timestamp']);
    }

    let photoUrl = '';
    if (data.image) {
      photoUrl = uploadToDrive(data.image, `Receipt_${new Date().getTime()}.jpg`);
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
      photoUrl,
      timestamp
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: id, photoUrl: photoUrl }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function uploadToDrive(base64Data, filename) {
  let folder;
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  }

  const contentType = base64Data.substring(5, base64Data.indexOf(';'));
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, filename);
  const file = folder.createFile(blob);
  
  // Make file readable by anyone with the link so it can be previewed
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
}
