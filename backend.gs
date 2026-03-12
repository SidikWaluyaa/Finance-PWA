/**
 * Google Apps Script - MyFinance Backend (v3)
 * 
 * - Saves images to the SAME FOLDER as this Spreadsheet.
 * - Auto-creates 'Transaksi' sheet if missing.
 */

const SHEET_NAME = 'Transaksi';

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
  // Get the folder where the Spreadsheet is located
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parentFolders = ssFile.getParents();
  let folder;
  
  if (parentFolders.hasNext()) {
    folder = parentFolders.next();
  } else {
    // Fallback to Root if somehow no parent
    folder = DriveApp.getRootFolder();
  }

  const contentType = base64Data.substring(5, base64Data.indexOf(';'));
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, filename);
  const file = folder.createFile(blob);
  
  // Set permission so PWA can display it
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
}
