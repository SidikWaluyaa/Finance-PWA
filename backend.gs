/**
 * Google Apps Script - MyFinance Backend (v5 - CRUD Support)
 */

const SHEET_NAME = 'Transaksi';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Dompet', 'Catatan', 'Timestamp']);
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
      sheet.appendRow(['ID', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Dompet', 'Catatan', 'Timestamp']);
    }

    const action = data.action;

    if (action === 'addTransaction') {
      const id = new Date().getTime();
      const timestamp = new Date();
      const dompet = data.dompet || 'Tunai';
      sheet.appendRow([id, data.tanggal, data.jenis, data.kategori, data.nominal, dompet, data.catatan, timestamp]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: id }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    
    else if (action === 'updateTransaction') {
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const idToUpdate = data.id;
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] == idToUpdate) {
          // Update columns: Tanggal, Jenis, Kategori, Nominal, Dompet, Catatan
          sheet.getRange(i + 1, 2).setValue(data.tanggal);
          sheet.getRange(i + 1, 3).setValue(data.jenis);
          sheet.getRange(i + 1, 4).setValue(data.kategori);
          sheet.getRange(i + 1, 5).setValue(data.nominal);
          sheet.getRange(i + 1, 6).setValue(data.dompet || 'Tunai');
          sheet.getRange(i + 1, 7).setValue(data.catatan);
          sheet.getRange(i + 1, 8).setValue(new Date()); // Update timestamp
          return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      throw new Error("Transaction ID not found");
    } 
    
    else if (action === 'deleteTransaction') {
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const idToDelete = data.id;
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] == idToDelete) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      throw new Error("Transaction ID not found");
    }

    throw new Error("Unknown action");
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
