export const formatThousand = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const digits = String(value).replace(/\D/g, ''); // chỉ giữ chữ số
    if (!digits) return '';
    // Tách nhóm 3 số từ phải sang, chèn dấu chấm
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseThousand = (value) => String(value || '').replace(/\D/g, '');