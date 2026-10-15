// components/Utils/dropdownPosition.js
import { Dimensions } from 'react-native';

const EDGE = 8;              // khoảng cách tối thiểu tới mép màn hình
const GAP = 4;               // khoảng cách giữa phần tử neo và menu
export const MENU_ITEM_HEIGHT = 40;

/**
 * Vị trí menu thả xuống neo theo phần tử đã đo bằng measure() (toạ độ pageX/pageY).
 * Mặc định mở xuống dưới; nếu phía dưới không đủ chỗ (dòng ở cuối danh sách trên mobile)
 * thì lật lên trên. Trả về { top, right } để dùng làm style position absolute.
 *
 * Luôn dùng `top` (không dùng `bottom`): một số menu nằm trong lớp bọc Pressable cao 0px ở
 * đỉnh màn hình, `bottom` khi đó tính từ y=0 nên menu bay ra ngoài mép trên.
 */
export function getDropdownPosition({ pageX, pageY, width, height }, menuHeight) {
    const { width: sw, height: sh } = Dimensions.get('window');
    const right = Math.max(sw - pageX - width, EDGE);
    const below = pageY + height + GAP;
    const above = pageY - GAP - menuHeight;
    const fitsBelow = below + menuHeight <= sh - EDGE;
    const fitsAbove = above >= EDGE;
    return { top: !fitsBelow && fitsAbove ? above : below, right };
}
