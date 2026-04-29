// services/firebaseMailService.js
//
// Gửi email qua Firebase "Trigger Email from Firestore" Extension.
// Extension lắng nghe collection "mail" và tự động gửi qua SMTP Gmail.
//
// Setup: xem hướng dẫn trong /docs/firebase-email-setup.md
// hoặc: https://extensions.dev/extensions/firebase/firestore-send-email

import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

// ✅ Đổi thành URL thực của app
const APP_URL = 'https://duongluis.github.io/SWD-Selling-Management';

const ROLE_LABEL_MAP = {
  'đại lý': 'Đại lý / NPP',
  'dealer': 'Đại lý / NPP',
  'đối tác': 'đối tác',
  'distributor': 'đối tác',
  'đối tác': 'Đối tác',
  'partner': 'Đối tác',
  'cộng tác viên': 'Cộng tác viên',
  'ctv': 'Cộng tác viên',
};
const getRoleLabel = (role) =>
  ROLE_LABEL_MAP[(role || '').toLowerCase()] || role || 'Thành viên';

/**
 * Ghi document vào collection "mail" để Extension tự gửi.
 * @param {object} user - { email, name, role, member, ... }
 */
export const sendApprovalEmailViaFirebase = async (user) => {
  const roleLabel = getRoleLabel(user.role || user.member);
  const verifiedDate = new Date().toLocaleDateString('vi-VN');
  const displayName = user.companyName || user.name || 'bạn';

  await addDoc(collection(db, 'mail'), {
    to: [user.email],
    message: {
      subject: '✅ Tài khoản của bạn đã được xác thực',
      html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
      style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

      <!-- Header gradient -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:40px 32px;text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">✅</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
            Tài khoản đã được xác thực!
          </h1>
          <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Chào mừng bạn gia nhập hệ thống</p>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:32px;">
        <p style="color:#374151;font-size:15px;margin:0 0 8px;">
          Xin chào <strong>${displayName}</strong>,
        </p>
        <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 20px;">
          Tài khoản của bạn đã được Admin xét duyệt và kích hoạt thành công.
          Bạn có thể đăng nhập và sử dụng đầy đủ tính năng ngay bây giờ.
        </p>

        <!-- Info table -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin:0 0 24px;">
          <tr><td style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#94a3b8;font-size:12px;width:130px;padding:7px 0;vertical-align:top;">Họ và tên</td>
                <td style="color:#0f172a;font-weight:600;font-size:13px;padding:7px 0;">${displayName}</td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="color:#94a3b8;font-size:12px;padding:7px 0;vertical-align:top;">Email</td>
                <td style="color:#0f172a;font-weight:600;font-size:13px;padding:7px 0;">${user.email}</td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="color:#94a3b8;font-size:12px;padding:7px 0;vertical-align:top;">Vai trò</td>
                <td style="padding:7px 0;">
                  <span style="background:#eff6ff;color:#2563eb;font-size:11px;font-weight:700;
                    padding:3px 10px;border-radius:20px;">${roleLabel}</span>
                </td>
              </tr>
              ${user.phone ? `
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="color:#94a3b8;font-size:12px;padding:7px 0;">Số điện thoại</td>
                <td style="color:#0f172a;font-weight:600;font-size:13px;padding:7px 0;">${user.phone}</td>
              </tr>` : ''}
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="color:#94a3b8;font-size:12px;padding:7px 0;">Ngày xác thực</td>
                <td style="color:#059669;font-weight:700;font-size:13px;padding:7px 0;">${verifiedDate}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td align="center">
            <a href="${APP_URL}"
              style="display:inline-block;background:linear-gradient(135deg,#1e40af,#2563eb);
                color:#fff;font-weight:700;font-size:14px;padding:14px 44px;
                border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
              Đăng nhập ngay →
            </a>
          </td></tr>
        </table>

        <!-- Warning note -->
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
          <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
            💡 <strong>Lưu ý:</strong> Nếu bạn không thực hiện yêu cầu này,
            vui lòng liên hệ ngay với chúng tôi để được hỗ trợ.
          </p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            © ${new Date().getFullYear()} SWD Seller Management · All rights reserved.
          </p>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">
            Email này được gửi tự động, vui lòng không trả lời.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    // Metadata theo dõi
    sentTo: user.email,
    sentBy: 'admin-approval',
    createdAt: new Date().toISOString(),
  });
};