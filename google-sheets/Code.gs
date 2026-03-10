/**
 * Веб-приложение для приёма данных анкеты гостей и записи в Google Таблицу.
 *
 * Укажите ID таблицы (из ссылки: docs.google.com/spreadsheets/d/СЮДА_ID/edit).
 * Скрипт должен быть привязан к этой же таблице (Расширения → Apps Script из неё).
 */
var SPREADSHEET_ID = '10BVuVaMX-23v511K5jPRBQHFp2rxVZ5dcPISDyVoRj0'; // из ссылки: .../d/СЮДА_ID/edit
var SHEET_NAME = 'Лист1'; // имя вкладки внизу таблицы (Лист1, Sheet1 или своё)

function doPost(e) {
  try {
    var spreadsheet = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = SHEET_NAME ? spreadsheet.getSheetByName(SHEET_NAME) : null;
    if (!sheet) sheet = spreadsheet.getSheets()[0];

    var json = {};
    var raw = (e.postData && e.postData.contents) ? e.postData.contents : '';
    if (e.parameter && e.parameter.data) {
      json = JSON.parse(e.parameter.data);
    } else if (raw.indexOf('data=') === 0) {
      json = JSON.parse(decodeURIComponent(raw.substring(5)));
    } else if (raw) {
      json = JSON.parse(raw);
    }

    var attend = json.attend || '';
    var guests = json.guests || [];

    guests.forEach(function (guest) {
      sheet.appendRow([
        guest.name || '',
        guest.partner || '',
        guest.children || '',
        attend,
        guest.drinks || ''
      ]);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: guests.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
