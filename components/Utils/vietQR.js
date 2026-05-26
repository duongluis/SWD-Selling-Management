// components/Utils/vietqr.js
/**
 * Tạo chuỗi VietQR theo tiêu chuẩn
 * @param {Object} params
 * @param {string} params.bankBin - Mã BIN ngân hàng (6 số)
 * @param {string} params.bankNumber - Số tài khoản thụ hưởng
 * @param {number} params.amount - Số tiền (VNĐ)
 * @param {string} params.description - Nội dung chuyển khoản (không dấu, tối đa 25 ký tự)
 * @returns {string} Chuỗi QR (định dạng MerchantPayLoad)
 */
function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc <<= 1;
        }
    }
    crc &= 0xFFFF;
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateVietQR({ bankBin, bankNumber, amount, description }) {
    const GUID = 'A000000727';
    // Tạo phần Merchant Account Information
    let merchantInfo = `${GUID}01130006${bankBin}0010${bankNumber}`;
    let payload = `00020101021238580010${merchantInfo}`;

    if (amount && amount > 0) {
        const amountStr = Math.round(amount).toString();
        payload += `5405${amountStr}`;
    }

    if (description && description.length > 0) {
        let cleanDesc = description
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9 ]/g, '')
            .substring(0, 25);
        payload += `6208${cleanDesc}`;
    }

    payload += '5802VN';
    const crc = crc16(payload);
    payload += `6304${crc}`;
    return payload;
}

export default generateVietQR;