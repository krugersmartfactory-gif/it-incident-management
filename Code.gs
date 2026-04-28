// ============================================================
// IT Incident Management System — Google Apps Script
// ============================================================

// ── Constants ────────────────────────────────────────────────
const SHEET_INCIDENT_LOG = 'Incident Log';
const SHEET_DEVICE_LIST  = 'danh sách thiết bị';
const SHEET_USER         = 'user';
const SPREADSHEET_ID     = '1z-Z0KxHFY3QJAxNoooMN4Or_Zki0IEfAkmN3YGMeUlQ';

// ── Router ───────────────────────────────────────────────────
/**
 * Entry point for GET requests.
 * If ?deviceCode=XXX is present → render DeviceInfo page.
 * Otherwise → render main SPA (index).
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('IT Incident Management')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Helper Module ────────────────────────────────────────────
/**
 * Returns a Sheet object by name from the configured Spreadsheet.
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
}

/**
 * Formats a Date object as "DD/MM/YYYY HH:MM:SS".
 * @param {Date} date
 * @returns {string}
 */
function formatTimestamp(date) {
  var d  = date.getDate();
  var mo = date.getMonth() + 1;
  var y  = date.getFullYear();
  var h  = date.getHours();
  var mi = date.getMinutes();
  var s  = date.getSeconds();

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  return pad(d) + '/' + pad(mo) + '/' + y + ' ' + pad(h) + ':' + pad(mi) + ':' + pad(s);
}

/**
 * Writes the 16-column header row to Incident Log if the sheet is empty.
 */
function initIncidentLogHeaders() {
  try {
    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet) return;
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Mã sự cố', 'Ngày sự cố', 'Người dùng', 'Bộ phận',
        'Mã thiết bị', 'Tên thiết bị', 'Mô tả sự cố', 'Mức độ',
        'Trạng thái', 'Người xử lý', 'Kết quả xử lý', 'Nguyên nhân gốc rễ',
        'Ngày đóng', 'Số sao', 'Người đánh giá', 'Nhận xét thái độ'
      ]);
    }
  } catch (err) {
    // Non-critical — silently ignore
  }
}

// ── Auth Module ──────────────────────────────────────────────
/**
 * Authenticates a user against the "user" sheet.
 * On success, creates a session token in CacheService (TTL 8h).
 * @param {string} email
 * @param {string} password
 * @returns {{success: boolean, token?: string, userName?: string, department?: string, accessRole?: string, formAccess?: string, error?: string}}
 */
function loginUser(email, password) {
  try {
    var sheet = getSheet(SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Không tìm thấy sheet người dùng.' };
    }

    var data = sheet.getDataRange().getValues();
    // Row 0 is header; data rows start at index 1
    var foundUser = null;
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      var rowEmail = String(data[i][0]).trim().toLowerCase();
      if (rowEmail === String(email).trim().toLowerCase()) {
        foundUser = data[i];
        rowIndex = i + 1; // 1-indexed for sheet
        break;
      }
    }

    if (!foundUser) {
      return { success: false, error: 'Email không tồn tại' };
    }

    var storedPassword = String(foundUser[1]);
    if (storedPassword !== String(password)) {
      return { success: false, error: 'Mật khẩu không đúng' };
    }

    var userName   = String(foundUser[2]);
    var department = String(foundUser[3]);
    var phone      = String(foundUser[4] || '');
    var accessRole = String(foundUser[5] || 'user').trim(); // Column F: Access Role
    var formAccess = String(foundUser[7] || 'báo hỏng, xử lý, đánh giá').trim(); // Column H: FormAccess

    // Create session token
    var token = Utilities.getUuid();
    var cache = CacheService.getUserCache();
    var sessionData = JSON.stringify({ 
      userName: userName, 
      department: department,
      accessRole: accessRole,
      formAccess: formAccess,
      email: email
    });
    cache.put(token, sessionData, 28800); // 8 hours = 28800 seconds

    return { 
      success: true, 
      token: token, 
      userName: userName, 
      department: department,
      accessRole: accessRole,
      formAccess: formAccess
    };
  } catch (err) {
    return { success: false, error: 'Lỗi hệ thống: ' + err.message };
  }
}

/**
 * Validates a session token.
 * @param {string} token
 * @returns {{valid: boolean, userName?: string, department?: string, accessRole?: string, formAccess?: string, email?: string}}
 */
function validateSession(token) {
  try {
    if (!token) return { valid: false };
    var cache = CacheService.getUserCache();
    var raw = cache.get(token);
    if (!raw) return { valid: false };
    var data = JSON.parse(raw);
    return { 
      valid: true, 
      userName: data.userName, 
      department: data.department,
      accessRole: data.accessRole || 'user',
      formAccess: data.formAccess || 'báo hỏng, xử lý, đánh giá',
      email: data.email || ''
    };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Destroys a session token.
 * @param {string} token
 * @returns {{success: boolean}}
 */
function logoutUser(token) {
  try {
    if (token) {
      var cache = CacheService.getUserCache();
      cache.remove(token);
    }
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

/**
 * Changes user password.
 * @param {string} email
 * @param {string} oldPassword
 * @param {string} newPassword
 * @param {string} sessionToken
 * @returns {{success: boolean, error?: string}}
 */
function changePassword(email, oldPassword, newPassword, sessionToken) {
  try {
    // Validate session
    var session = validateSession(sessionToken);
    if (!session.valid) {
      return { success: false, error: 'Phiên đăng nhập không hợp lệ.' };
    }
    
    // Validate new password
    if (!newPassword || String(newPassword).trim().length < 6) {
      return { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
    }
    
    var sheet = getSheet(SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Không tìm thấy sheet người dùng.' };
    }

    var data = sheet.getDataRange().getValues();
    var targetRow = -1;

    for (var i = 1; i < data.length; i++) {
      var rowEmail = String(data[i][0]).trim().toLowerCase();
      if (rowEmail === String(email).trim().toLowerCase()) {
        var storedPassword = String(data[i][1]);
        if (storedPassword !== String(oldPassword)) {
          return { success: false, error: 'Mật khẩu cũ không đúng.' };
        }
        targetRow = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: 'Không tìm thấy tài khoản.' };
    }

    // Update password and last changed date
    var now = new Date();
    sheet.getRange(targetRow, 2).setValue(String(newPassword).trim()); // Column B: password
    sheet.getRange(targetRow, 7).setValue(formatTimestamp(now));        // Column G: password_last_changed

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Lỗi đổi mật khẩu: ' + err.message };
  }
}

// ── ID Generator Module ──────────────────────────────────────
/**
 * Generates a unique Incident Code in the format INC-YYYY-XXX.
 * Uses ScriptLock to prevent duplicate codes under concurrent submissions.
 * @returns {string} e.g. "INC-2026-001"
 */
function generateIncidentCode() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var year = new Date().getFullYear();
    var prefix = 'INC-' + year + '-';
    var maxSeq = 0;

    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (sheet && sheet.getLastRow() > 1) {
      var codes = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        var code = String(codes[i][0]);
        if (code.indexOf(prefix) === 0) {
          var seq = parseInt(code.substring(prefix.length), 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }

    var nextSeq = maxSeq + 1;
    var seqStr = nextSeq < 10 ? '00' + nextSeq : (nextSeq < 100 ? '0' + nextSeq : '' + nextSeq);
    return prefix + seqStr;
  } finally {
    lock.releaseLock();
  }
}

// ── Device Module ────────────────────────────────────────────
/**
 * Test function để debug sheet
 */
function testGetDeviceList() {
  Logger.log('=== TEST getDeviceList ===');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('✅ Spreadsheet opened');
  
  var sheets = ss.getSheets();
  Logger.log('📋 Total sheets: ' + sheets.length);
  for (var i = 0; i < sheets.length; i++) {
    Logger.log('  Sheet ' + (i+1) + ': ' + sheets[i].getName());
  }
  
  var result = getDeviceList();
  Logger.log('📦 Result:', result);
}

/**
 * Returns all devices from the Device List sheet.
 * @returns {{success: boolean, devices?: Array, error?: string}}
 */
function getDeviceList() {
  try {
    var sheet = getSheet(SHEET_DEVICE_LIST);
    if (!sheet) {
      Logger.log('❌ Sheet not found: ' + SHEET_DEVICE_LIST);
      return { success: false, devices: [], error: 'Không tìm thấy sheet danh sách thiết bị.' };
    }

    var lastRow = sheet.getLastRow();
    Logger.log('📋 getDeviceList: lastRow=' + lastRow);
    if (lastRow <= 1) {
      Logger.log('⚠️ Sheet is empty');
      return { success: true, devices: [] };
    }

    var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    Logger.log('📋 getDeviceList: data rows=' + data.length);
    var devices = [];

    for (var i = 0; i < data.length; i++) {
      var code = String(data[i][0]).trim();
      if (code === '') continue;
      var device = {
        code:         code,
        name:         String(data[i][1]).trim(),
        department:   String(data[i][2]).trim(),
        purchaseDate: data[i][3] ? formatDateOnly(data[i][3]) : ''
      };
      devices.push(device);
      Logger.log('  Device ' + (i+1) + ': ' + code + ' - ' + device.name);
    }

    Logger.log('✅ getDeviceList: returning ' + devices.length + ' devices');
    return { success: true, devices: devices };
  } catch (err) {
    Logger.log('❌ getDeviceList error: ' + err.message);
    return { success: false, devices: [], error: 'Lỗi đọc danh sách thiết bị: ' + err.message };
  }
}

/**
 * Đếm số lần sửa chữa (incident đã đóng) của một thiết bị
 * @param {string} deviceCode
 * @returns {{success: boolean, count?: number, error?: string}}
 */
function getRepairCount(deviceCode) {
  try {
    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, count: 0 };
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    var count = 0;

    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][8]).trim();
      var deviceCodeInSheet = String(data[i][4]).trim();
      
      // Đếm incident: Closed (đã sửa xong)
      if (status === 'Closed' && deviceCodeInSheet.toLowerCase() === String(deviceCode).trim().toLowerCase()) {
        count++;
      }
    }

    return { success: true, count: count };
  } catch (err) {
    return { success: false, count: 0, error: 'Lỗi đếm sửa chữa: ' + err.message };
  }
}

/**
 * Returns detailed info for a single device, including calculated age.
 * @param {string} deviceCode
 * @returns {{success: boolean, device?: Object, error?: string}}
 */
function getDeviceInfo(deviceCode) {
  try {
    var sheet = getSheet(SHEET_DEVICE_LIST);
    if (!sheet) {
      return { success: false, error: 'Không tìm thấy sheet danh sách thiết bị.' };
    }

    var lastRow = sheet.getLastRow();
    Logger.log('📋 Sheet lastRow: ' + lastRow);
    if (lastRow <= 1) {
      return { success: false, error: 'Mã thiết bị không tồn tại' };
    }

    var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    Logger.log('📋 Data rows: ' + data.length);
    Logger.log('🔍 Looking for deviceCode: ' + deviceCode);

    for (var i = 0; i < data.length; i++) {
      var code = String(data[i][0]).trim();
      Logger.log('  Row ' + i + ': code=' + code);
      if (code.toLowerCase() === String(deviceCode).trim().toLowerCase()) {
        var purchaseDateRaw = data[i][3];
        var purchaseDateStr = purchaseDateRaw ? formatDateOnly(purchaseDateRaw) : '';
        var age = calculateDeviceAge(purchaseDateRaw);

        Logger.log('✅ Found device: ' + code);
        return {
          success: true,
          device: {
            code:         code,
            name:         String(data[i][1]).trim(),
            department:   String(data[i][2]).trim(),
            purchaseDate: purchaseDateStr,
            age:          age,
            repairCount:  getRepairCount(code).count
          }
        };
      }
    }

    Logger.log('❌ Device not found: ' + deviceCode);
    return { success: false, error: 'Mã thiết bị không tồn tại' };
  } catch (err) {
    Logger.log('❌ Error in getDeviceInfo: ' + err.message);
    return { success: false, error: 'Lỗi tra cứu thiết bị: ' + err.message };
  }
}

/**
 * Generates a Google Charts QR Code URL for a device.
 * @param {string} deviceCode
 * @returns {string} QR image URL
 */
function generateQRCodeUrl(deviceCode) {
  try {
    var webAppUrl = ScriptApp.getService().getUrl();
    var targetUrl = webAppUrl + '?deviceCode=' + encodeURIComponent(deviceCode);
    return 'https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=' + encodeURIComponent(targetUrl);
  } catch (err) {
    // Fallback if service URL is unavailable (e.g., during development)
    var targetUrl = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?deviceCode=' + encodeURIComponent(deviceCode);
    return 'https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=' + encodeURIComponent(targetUrl);
  }
}

/**
 * Formats a date value (Date object or string) as "DD/MM/YYYY".
 * @param {Date|string} dateVal
 * @returns {string}
 */
function formatDateOnly(dateVal) {
  try {
    var d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    var day = d.getDate();
    var mon = d.getMonth() + 1;
    var yr  = d.getFullYear();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return pad(day) + '/' + pad(mon) + '/' + yr;
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Calculates device age from purchase date to today.
 * @param {Date|string} purchaseDateVal
 * @returns {string} e.g. "3 năm 2 tháng"
 */
function calculateDeviceAge(purchaseDateVal) {
  try {
    if (!purchaseDateVal) return 'Không rõ';
    var purchaseDate = (purchaseDateVal instanceof Date) ? purchaseDateVal : new Date(purchaseDateVal);
    if (isNaN(purchaseDate.getTime())) return 'Không rõ';

    var now = new Date();
    var years  = now.getFullYear() - purchaseDate.getFullYear();
    var months = now.getMonth() - purchaseDate.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years === 0 && months === 0) return 'Dưới 1 tháng';
    if (years === 0) return months + ' tháng';
    if (months === 0) return years + ' năm';
    return years + ' năm ' + months + ' tháng';
  } catch (e) {
    return 'Không rõ';
  }
}

// ── Incident Module ──────────────────────────────────────────
/**
 * Submits a new incident to the Incident Log.
 * @param {Object} incidentData - {userName, department, deviceCode, deviceName, description, severity}
 * @param {string} sessionToken
 * @returns {{success: boolean, incidentCode?: string, error?: string}}
 */
function submitIncident(incidentData, sessionToken) {
  try {
    // Validate session
    var session = validateSession(sessionToken);
    if (!session.valid) {
      return { success: false, error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' };
    }

    // Validate required fields
    var required = ['userName', 'department', 'deviceCode', 'deviceName', 'description', 'severity'];
    for (var i = 0; i < required.length; i++) {
      var field = required[i];
      if (!incidentData[field] || String(incidentData[field]).trim() === '') {
        var fieldNames = {
          userName:    'Người dùng',
          department:  'Bộ phận',
          deviceCode:  'Mã thiết bị',
          deviceName:  'Tên thiết bị',
          description: 'Mô tả sự cố',
          severity:    'Mức độ'
        };
        return { success: false, error: 'Vui lòng điền đầy đủ thông tin: ' + (fieldNames[field] || field) };
      }
    }

    // Validate severity value
    var validSeverities = ['Cao', 'Trung bình', 'Thấp'];
    if (validSeverities.indexOf(incidentData.severity) === -1) {
      return { success: false, error: 'Mức độ không hợp lệ. Chọn: Cao, Trung bình, hoặc Thấp.' };
    }

    // Ensure headers exist
    initIncidentLogHeaders();

    // Generate incident code
    var incidentCode = generateIncidentCode();
    var now = new Date();

    // Write row to Incident Log (16 columns)
    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet) {
      return { success: false, error: 'Không tìm thấy sheet Incident Log.' };
    }

    sheet.appendRow([
      incidentCode,                              // A: Mã sự cố
      formatTimestamp(now),                      // B: Ngày sự cố
      String(incidentData.userName).trim(),      // C: Người dùng
      String(incidentData.department).trim(),    // D: Bộ phận
      String(incidentData.deviceCode).trim(),    // E: Mã thiết bị
      String(incidentData.deviceName).trim(),    // F: Tên thiết bị
      String(incidentData.description).trim(),   // G: Mô tả sự cố
      String(incidentData.severity).trim(),      // H: Mức độ
      'Open',                                    // I: Trạng thái
      '',                                        // J: Người xử lý
      '',                                        // K: Kết quả xử lý
      '',                                        // L: Nguyên nhân gốc rễ
      '',                                        // M: Ngày đóng
      '',                                        // N: Số sao
      '',                                        // O: Người đánh giá
      ''                                         // P: Nhận xét thái độ
    ]);

    // Enqueue email notification
    enqueueIncidentEmail(incidentCode, incidentData);

    return { success: true, incidentCode: incidentCode };
  } catch (err) {
    return { success: false, error: 'Lỗi ghi sự cố: ' + err.message };
  }
}

/**
 * Returns all Open incidents from the Incident Log.
 * @param {string} sessionToken
 * @returns {{success: boolean, incidents?: Array, error?: string}}
 */
function getOpenIncidents(sessionToken) {
  try {
    var session = validateSession(sessionToken);
    if (!session.valid) {
      return { success: false, error: 'Phiên đăng nhập không hợp lệ.' };
    }

    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, incidents: [] };
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    var incidents = [];

    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][8]).trim();
      if (status === 'Open') {
        incidents.push({
          incidentCode: String(data[i][0]),
          incidentDate: String(data[i][1]),
          userName:     String(data[i][2]),
          department:   String(data[i][3]),
          deviceCode:   String(data[i][4]),
          deviceName:   String(data[i][5]),
          description:  String(data[i][6]),
          severity:     String(data[i][7]),
          status:       status
        });
      }
    }

    return { success: true, incidents: incidents };
  } catch (err) {
    return { success: false, error: 'Lỗi đọc danh sách sự cố: ' + err.message };
  }
}

/**
 * Closes (resolves) an incident.
 * @param {string} incidentCode
 * @param {Object} resolutionData - {resolver, resolution, rootCause}
 * @param {string} sessionToken
 * @returns {{success: boolean, incidentCode?: string, error?: string}}
 */
function resolveIncident(incidentCode, resolutionData, sessionToken) {
  try {
    var session = validateSession(sessionToken);
    if (!session.valid) {
      return { success: false, error: 'Phiên đăng nhập không hợp lệ.' };
    }

    // Validate required resolution fields
    if (!resolutionData.resolver || String(resolutionData.resolver).trim() === '') {
      return { success: false, error: 'Vui lòng nhập Người xử lý.' };
    }
    if (!resolutionData.resolution || String(resolutionData.resolution).trim() === '') {
      return { success: false, error: 'Vui lòng nhập Kết quả xử lý.' };
    }

    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, error: 'Không tìm thấy sự cố: ' + incidentCode };
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    var targetRow = -1;

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(incidentCode).trim()) {
        targetRow = i + 2; // +2 because data starts at row 2 (1-indexed) and array is 0-indexed
        var currentStatus = String(data[i][8]).trim();
        if (currentStatus === 'Closed') {
          return { success: false, error: 'Sự cố ' + incidentCode + ' đã được đóng trước đó.' };
        }
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: 'Không tìm thấy sự cố: ' + incidentCode };
    }

    var now = new Date();
    // Update columns I (9), J (10), K (11), L (12), M (13) — 1-indexed
    sheet.getRange(targetRow, 9).setValue('Closed');                                    // I: Trạng thái
    sheet.getRange(targetRow, 10).setValue(String(resolutionData.resolver).trim());     // J: Người xử lý
    sheet.getRange(targetRow, 11).setValue(String(resolutionData.resolution).trim());   // K: Kết quả xử lý
    sheet.getRange(targetRow, 12).setValue(String(resolutionData.rootCause || '').trim()); // L: Nguyên nhân gốc rễ
    sheet.getRange(targetRow, 13).setValue(formatTimestamp(now));                       // M: Ngày đóng

    return { success: true, incidentCode: incidentCode };
  } catch (err) {
    return { success: false, error: 'Lỗi đóng sự cố: ' + err.message };
  }
}

/**
 * Returns all Closed incidents for a device that haven't been rated yet.
 * @param {string} deviceCode
 * @returns {{success: boolean, incidents?: Array, error?: string}}
 */
function getUnratedIncidentsByDevice(deviceCode) {
  try {
    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, incidents: [] };
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    var incidents = [];

    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][8]).trim();
      var deviceCodeInSheet = String(data[i][4]).trim();
      var rating = data[i][13]; // Column N (14th column, 0-indexed = 13)

      // Chỉ lấy incident: Closed, cùng device code, và chưa có rating
      if (status === 'Closed' && deviceCodeInSheet.toLowerCase() === String(deviceCode).trim().toLowerCase() && !rating) {
        incidents.push({
          incidentCode: String(data[i][0]),
          incidentDate: String(data[i][1]),
          userName:     String(data[i][2]),
          department:   String(data[i][3]),
          deviceCode:   String(data[i][4]),
          deviceName:   String(data[i][5]),
          description:  String(data[i][6]),
          severity:     String(data[i][7]),
          resolver:     String(data[i][9]),
          resolution:   String(data[i][10]),
          status:       status
        });
      }
    }

    return { success: true, incidents: incidents };
  } catch (err) {
    return { success: false, error: 'Lỗi đọc danh sách sự cố: ' + err.message };
  }
}

/**
 * Records a rating for a closed incident.
 * @param {string} incidentCode
 * @param {number} rating - integer 1–5
 * @param {string} raterName
 * @param {string} attitudeComment - Nhận xét thái độ người xử lý
 * @param {string} sessionToken
 * @returns {{success: boolean, error?: string}}
 */
function rateIncident(incidentCode, rating, raterName, attitudeComment, sessionToken) {
  try {
    var session = validateSession(sessionToken);
    if (!session.valid) {
      return { success: false, error: 'Phiên đăng nhập không hợp lệ.' };
    }

    // Validate rating
    var ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return { success: false, error: 'Số sao không hợp lệ. Vui lòng chọn từ 1 đến 5 sao.' };
    }

    var sheet = getSheet(SHEET_INCIDENT_LOG);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, error: 'Không tìm thấy sự cố: ' + incidentCode };
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    var targetRow = -1;

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(incidentCode).trim()) {
        targetRow = i + 2;
        var currentStatus = String(data[i][8]).trim();
        if (currentStatus !== 'Closed') {
          return { success: false, error: 'Sự cố ' + incidentCode + ' chưa được xử lý. Chỉ có thể đánh giá sự cố đã đóng.' };
        }
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: 'Không tìm thấy sự cố: ' + incidentCode };
    }

    // Update columns N (14), O (15), P (16) — 1-indexed
    sheet.getRange(targetRow, 14).setValue(ratingNum);                              // N: Số sao
    sheet.getRange(targetRow, 15).setValue(String(raterName || '').trim());         // O: Người đánh giá
    sheet.getRange(targetRow, 16).setValue(String(attitudeComment || '').trim());   // P: Nhận xét thái độ

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Lỗi ghi đánh giá: ' + err.message };
  }
}


// =============================================
// EMAIL QUEUE SYSTEM
// =============================================
const EMAIL_QUEUE_SHEET = 'EMAIL_QUEUE';
const MAX_RETRY = 3;
const TO_EMAIL = 'duomle@krugervn.com';
const CC_EMAILS = 'duom1988@gmail.com';

/**
 * Thêm email vào hàng đợi khi báo hỏng được lưu
 */
function enqueueIncidentEmail(incidentCode, incidentData) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(EMAIL_QUEUE_SHEET);
    
    // Tự tạo sheet nếu chưa có
    if (!sheet) {
      sheet = ss.insertSheet(EMAIL_QUEUE_SHEET);
      sheet.appendRow(['createdAt', 'status', 'retryCount', 'lastAttempt', 'subject', 'toEmail', 'ccEmails', 'htmlBody', 'errorLog']);
      sheet.setFrozenRows(1);
      Logger.log('✅ Đã tạo sheet EMAIL_QUEUE');
    }

    var subject = '[BÁO HỎng] ' + incidentData.deviceCode + ' - ' + incidentData.severity + ' - ' + incidentData.deviceName;
    var htmlBody = buildIncidentEmailHtml(incidentCode, incidentData);

    sheet.appendRow([
      new Date(),
      'PENDING',
      0,
      '',
      subject,
      TO_EMAIL,
      CC_EMAILS,
      htmlBody,
      ''
    ]);

    Logger.log('📬 Email enqueued for incident: ' + incidentCode);
    setupEmailTrigger();
  } catch (err) {
    Logger.log('⚠️ enqueueIncidentEmail failed: ' + err.message);
  }
}

/**
 * Build HTML email body cho báo hỏng
 */
function buildIncidentEmailHtml(incidentCode, incidentData) {
  var severityColorMap = {
    'Cao': '#d32f2f',
    'Trung bình': '#F57C00',
    'Thấp': '#388E3C'
  };
  var pColor = severityColorMap[incidentData.severity] || '#555';

  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>'
    + 'body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;}'
    + '.content{padding:20px;background:#f9f9f9;}'
    + '.info-box{background:white;border-left:4px solid #2196F3;padding:15px;margin:10px 0;}'
    + '.label{font-weight:bold;color:#555;}'
    + '.value{color:#000;margin-left:8px;}'
    + '</style></head><body>'
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1565C0;">'
    + '<tr><td align="center" style="padding:24px 20px;background:linear-gradient(135deg,#2196F3 0%,#1565C0 100%);"><h2 style="margin:0;color:#ffffff;font-size:22px;font-family:Arial,sans-serif;text-align:center;">🔧 BÁO HỎNG THIẾT BỊ 🔧</h2>'
    + '<p style="margin:8px 0 0 0;color:#ffffff;font-size:13px;font-family:Arial,sans-serif;text-align:center;">Hệ thống quản lý sự cố IT</p></td></tr></table>'
    + '<div class="content">'
    + '<div class="info-box"><h3 style="color:#1565C0;margin-top:0;border-bottom:2px solid #2196F3;padding-bottom:6px;">📋 THÔNG TIN NGƯỜI BÁO CÁO</h3>'
    + '<p><span class="label">👤 Họ tên:</span><span class="value">' + (incidentData.userName || '') + '</span></p>'
    + '<p><span class="label">🏢 Bộ phận:</span><span class="value">' + (incidentData.department || '') + '</span></p></div>'
    + '<div class="info-box"><h3 style="color:#E65100;margin-top:0;border-bottom:2px solid #FF6F00;padding-bottom:6px;">🔧 THÔNG TIN THIẾT BỊ</h3>'
    + '<p><span class="label">Tên thiết bị:</span><span class="value">' + (incidentData.deviceName || '') + '</span></p>'
    + '<p><span class="label">Mã thiết bị:</span><span class="value">' + (incidentData.deviceCode || '') + '</span></p></div>'
    + '<div class="info-box"><h3 style="color:#BF360C;margin-top:0;border-bottom:2px solid #E64A19;padding-bottom:6px;">⚠️ CHI TIẾT SỰ CỐ</h3>'
    + '<p><span class="label">Mã sự cố:</span><span class="value" style="color:#1565C0;font-weight:bold;">' + incidentCode + '</span></p>'
    + '<p><span class="label">Mức độ ưu tiên:</span><span class="value" style="color:' + pColor + ';font-weight:bold;">' + (incidentData.severity || '') + '</span></p>'
    + '<p><span class="label">📄 Mô tả:</span></p>'
    + '<p style="background:#f5f5f5;padding:10px;border-radius:4px;margin:5px 0;">' + (incidentData.description || '') + '</p></div>'
    + '</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0">'
    + '<tr><td align="center" style="padding:15px;font-size:12px;color:#999;border-top:1px solid #eee;font-family:Arial,sans-serif;text-align:center;">'
    + '<p style="margin:4px 0;">CÔNG TY TNHH CÔNG NGHIỆP THÔNG GIÓ KRUGER VIỆT NAM</p>'
    + '<p style="margin:4px 0;">Email tự động – Vui lòng không trả lời email này</p>'
    + '<p style="margin:4px 0;">⏰ ' + new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + '</p>'
    + '</td></tr></table></body></html>';
}

/**
 * Xử lý hàng đợi EMAIL_QUEUE
 */
function processEmailQueue() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(EMAIL_QUEUE_SHEET);
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var processed = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var status = String(row[1] || '').trim();
      var retryCount = parseInt(row[2]) || 0;

      if (status === 'SENT' || status === 'DEAD') continue;
      if (status === 'FAILED' && retryCount >= MAX_RETRY) {
        sheet.getRange(i + 1, 2).setValue('DEAD');
        Logger.log('💀 Email DEAD (hết retry) row ' + (i + 1));
        continue;
      }

      var subject = String(row[4] || '');
      var toEmail = String(row[5] || '');
      var ccEmails = String(row[6] || '').replace(/\s+/g, '');
      var htmlBody = String(row[7] || '');

      if (!toEmail || !htmlBody) {
        sheet.getRange(i + 1, 2).setValue('DEAD');
        sheet.getRange(i + 1, 9).setValue('Thiếu toEmail hoặc htmlBody');
        continue;
      }

      try {
        var options = {
          htmlBody: htmlBody,
          name: 'Hệ thống Báo hỏng - Kruger VN',
          replyTo: toEmail,
          noReply: false
        };
        if (ccEmails) options.cc = ccEmails;

        MailApp.sendEmail(toEmail, subject, 'Vui lòng xem email dạng HTML', options);

        sheet.getRange(i + 1, 2).setValue('SENT');
        sheet.getRange(i + 1, 4).setValue(now);
        sheet.getRange(i + 1, 9).setValue('');

        Logger.log('✅ Email SENT row ' + (i + 1) + ' → ' + toEmail);
        processed++;
      } catch (err) {
        var newRetry = retryCount + 1;
        var errMsg = err.message || String(err);
        sheet.getRange(i + 1, 2).setValue(newRetry >= MAX_RETRY ? 'DEAD' : 'FAILED');
        sheet.getRange(i + 1, 3).setValue(newRetry);
        sheet.getRange(i + 1, 4).setValue(now);
        sheet.getRange(i + 1, 9).setValue('[' + now.toLocaleString('vi-VN') + '] ' + errMsg);
        Logger.log('❌ Email FAILED row ' + (i + 1) + ' retry=' + newRetry + ' err=' + errMsg);
      }
    }

    if (processed > 0) Logger.log('📨 processEmailQueue: đã gửi ' + processed + ' email(s)');

    // Kiểm tra còn PENDING hoặc FAILED chưa hết retry không
    var remaining = sheet.getDataRange().getValues().slice(1).some(function(r) {
      var st = String(r[1] || '').trim();
      var retry = parseInt(r[2]) || 0;
      return (st === 'PENDING') || (st === 'FAILED' && retry < MAX_RETRY);
    });

    if (!remaining) {
      removeEmailTrigger();
      Logger.log('✅ Queue trống - trigger đã được xóa');
    }
  } catch (err) {
    Logger.log('Error in processEmailQueue: ' + err.message);
  }
}

/**
 * Tạo trigger chạy processEmailQueue mỗi 1 phút
 */
function setupEmailTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var exists = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'processEmailQueue') {
        exists = true;
        break;
      }
    }
    if (exists) return;

    ScriptApp.newTrigger('processEmailQueue')
      .timeBased()
      .everyMinutes(1)
      .create();

    Logger.log('✅ Trigger processEmailQueue đã được tạo (mỗi 1 phút)');
  } catch (err) {
    Logger.log('⚠️ setupEmailTrigger failed: ' + err.message);
  }
}

/**
 * Xóa trigger khi queue trống
 */
function removeEmailTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'processEmailQueue') {
        ScriptApp.deleteTrigger(triggers[i]);
        Logger.log('🗑️ Đã xóa trigger processEmailQueue');
      }
    }
  } catch (err) {
    Logger.log('⚠️ removeEmailTrigger failed: ' + err.message);
  }
}

/**
 * Test function - Kiểm tra email queue
 */
function testEmailQueue() {
  Logger.log('=== TEST EMAIL QUEUE ===');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(EMAIL_QUEUE_SHEET);
  
  if (!sheet) {
    Logger.log('❌ Sheet EMAIL_QUEUE không tồn tại');
    return;
  }
  
  var lastRow = sheet.getLastRow();
  Logger.log('📋 Total rows: ' + lastRow);
  
  if (lastRow <= 1) {
    Logger.log('⚠️ Queue trống');
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  Logger.log('📧 Email queue status:');
  for (var i = 1; i < data.length; i++) {
    Logger.log('  Row ' + (i+1) + ': status=' + data[i][1] + ', retry=' + data[i][2] + ', subject=' + data[i][4]);
  }
  
  // Thử gửi ngay
  Logger.log('🚀 Calling processEmailQueue()...');
  processEmailQueue();
}

/**
 * Test function - Tạo email test
 */
function testCreateEmail() {
  Logger.log('=== TEST CREATE EMAIL ===');
  var testIncidentData = {
    userName: 'Test User',
    department: 'IT',
    deviceCode: 'TEST001',
    deviceName: 'Test Device',
    description: 'Test incident description',
    severity: 'Cao'
  };
  
  enqueueIncidentEmail('INC-2026-TEST', testIncidentData);
  Logger.log('✅ Test email enqueued');
  
  // Kiểm tra queue
  testEmailQueue();
}
