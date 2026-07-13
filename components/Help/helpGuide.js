// helpGuide.js
// Nội dung hướng dẫn cho từng màn hình — tối ưu cho người dùng mới.
// Mỗi màn có mảng steps: { title, image, description, tips[] }

export const HELP_GUIDE = {

    // ─── TRANG CHỦ ───────────────────────────────────────────────
    home: {
        screenLabel: 'Trang chủ',
        steps: [
            {
                title: 'Chào mừng — Tổng quan số liệu',
                image: require('../../assets/images/help/home_01.png'),
                description:
                    'Đây là trang chủ — nơi bạn bắt đầu mỗi ngày làm việc. Bốn thẻ KPI ở trên hiển thị Doanh Thu, Tổng Đơn Hàng, Khách Hàng và Doanh Thu Trung Bình/Đơn của bạn trong kỳ hiện tại. Tất cả số liệu cập nhật tức thì khi có đơn hàng hoặc khách hàng mới.',
                tips: [
                    'Doanh thu chỉ tính các đơn có trạng thái "Đã thanh toán".',
                    'Nếu số liệu bằng 0, hãy tạo khách hàng và đơn hàng đầu tiên của bạn.',
                    'Nhấn vào bất kỳ thẻ nào để chuyển sang màn tương ứng.',
                ],
            },
            {
                title: 'Thao tác nhanh',
                image: require('../../assets/images/help/home_02.png'),
                description:
                    'Khu vực thao tác nhanh giúp bạn thực hiện ngay các việc thường làm nhất: tạo đơn hàng mới, thêm khách hàng, mở chat hỗ trợ hoặc xem hợp đồng — chỉ một lần nhấn, không cần đi qua nhiều màn hình.',
                tips: [
                    'Luồng cơ bản: Thêm khách hàng → Tạo đơn hàng → Đăng ký dịch vụ.',
                    '"Đơn hàng mới" tắt đường vào form tạo đơn ngay lập tức.',
                    'Nút "Phòng chat" mở danh sách tất cả phòng hỗ trợ của bạn.',
                ],
            },
            {
                title: 'Đơn hàng & khách hàng gần đây',
                image: require('../../assets/images/help/home_03.png'),
                description:
                    'Phần dưới trang chủ liệt kê các đơn hàng và khách hàng gần đây nhất. Bạn có thể nhấn thẳng vào một dòng để xem chi tiết mà không cần tìm kiếm trong danh sách đầy đủ.',
                tips: [
                    'Nhấn "Xem tất cả →" để mở toàn bộ danh sách đơn hàng hoặc khách hàng.',
                    'Trạng thái đơn được tô màu: vàng = chờ xử lý, xanh = hoàn thành, đỏ = hủy.',
                ],
            },
        ],
    },

    // ─── ĐƠN HÀNG ────────────────────────────────────────────────
    order: {
        screenLabel: 'Đơn hàng',
        steps: [
            {
                title: 'Tổng quan danh sách đơn',
                image: require('../../assets/images/help/order_01.png'),
                description:
                    'Màn hình Đơn hàng liệt kê tất cả đơn của bạn. Thẻ thống kê phía trên hiển thị tổng số đơn, đơn buôn, đơn lẻ và doanh thu. Nhấn "+ Tạo đơn hàng" ở góc phải trên để bắt đầu tạo đơn mới.',
                tips: [
                    'Gõ tên khách hoặc mã đơn vào ô tìm kiếm để lọc ngay lập tức.',
                    'Nhấn "Bộ lọc" để lọc theo năm, tháng, trạng thái hoặc loại thanh toán.',
                    'Doanh thu chỉ tính đơn "Đã thanh toán" — đơn đang xử lý không được tính.',
                ],
            },
            {
                title: 'Đọc danh sách & bộ lọc',
                image: require('../../assets/images/help/order_02.png'),
                description:
                    'Bảng đơn hàng hiển thị: mã đơn, ngày, người tạo, hình thức thanh toán và tổng giá trị. Dòng "Tổng cộng" ở đầu bảng tự cộng theo bộ lọc đang áp dụng. Nhấn vào bất kỳ dòng nào để xem chi tiết.',
                tips: [
                    'Bộ lọc "Tất cả năm" mặc định — hãy lọc theo tháng nếu danh sách quá dài.',
                    'Nhấn dòng tổng cộng để thấy tiền nhập và doanh thu bán ra (nếu có quyền).',
                    'Đơn bị hủy có chữ gạch ngang và màu xám nhạt hơn.',
                ],
            },
            {
                title: 'Chi tiết & cập nhật đơn hàng',
                image: require('../../assets/images/help/order_03.png'),
                description:
                    'Nhấn vào một đơn để mở panel chi tiết (trên máy tính) hoặc chuyển sang màn chi tiết (điện thoại). Tại đây bạn thấy đầy đủ: sản phẩm, khách hàng, dịch vụ kèm theo, và có thể cập nhật trạng thái, xuất biên bản hoặc mở chat.',
                tips: [
                    // 'Nhấn badge trạng thái (ví dụ "Chờ xử lý") để chuyển sang bước tiếp theo.',
                    'Nhấn "Xuất HĐ" để in biên bản bàn giao gửi khách ký xác nhận.',
                    'Nhấn "Chat" để trao đổi trực tiếp về đơn hàng với đội hỗ trợ.',
                    'Chỉ người tạo đơn hoặc Admin mới thấy nút "Sửa đơn".',
                ],
            },
        ],
    },

    // ─── KHÁCH HÀNG ──────────────────────────────────────────────
    customer: {
        screenLabel: 'Khách hàng',
        steps: [
            {
                title: 'Danh sách khách hàng',
                image: require('../../assets/images/help/customer_01.png'),
                description:
                    'Màn hình Khách hàng liệt kê tất cả khách hàng bạn đã thêm (và của đội nếu bạn là quản lý). Mỗi dòng hiển thị tên, số điện thoại, ngày tạo và email người phụ trách.',
                tips: [
                    'Tìm kiếm theo tên hoặc số điện thoại — kết quả lọc ngay khi gõ.',
                    'Cột "Tạo bởi" cho biết nhân viên nào đã thêm khách này vào hệ thống.',
                    'Nhấn vào dòng để xem đầy đủ thông tin và lịch sử đơn hàng của khách.',
                ],
            },
            {
                title: 'Thêm và quản lý khách',
                image: require('../../assets/images/help/customer_02.png'),
                description:
                    'Nhấn "+ Thêm khách hàng" để mở form nhập thông tin khách mới. Khi đã có khách trong hệ thống, bạn có thể tạo đơn hàng trực tiếp cho họ từ trang danh sách này mà không cần gõ lại thông tin.',
                tips: [
                    'Số điện thoại là trường bắt buộc và dùng để nhận diện — không được trùng.',
                    'Khách hàng mới thêm sẽ xuất hiện ngay trong form Tạo đơn hàng.',
                ],
            },
            {
                title: 'Chi tiết khách hàng',
                image: require('../../assets/images/help/customer_03.png'),
                description:
                    'Panel chi tiết hiển thị toàn bộ thông tin liên hệ (điện thoại, địa chỉ, email), ai đã tạo khách và danh sách đơn hàng đã đặt. Từ đây bạn có thể sửa thông tin hoặc tạo đơn hàng mới cho khách chỉ một bước.',
                tips: [
                    'Nhấn "Tạo đơn" — thông tin khách sẽ tự điền vào form tạo đơn.',
                    'Nhấn "Sửa" để cập nhật tên, SĐT hoặc địa chỉ nếu khách thay đổi.',
                    'Lịch sử đơn hàng hiển thị đầy đủ các đơn đã tạo cho khách này.',
                ],
            },
        ],
    },

    // ─── GIỚI THIỆU KHÁCH (CTV) ──────────────────────────────────
    consult: {
        screenLabel: 'Giới thiệu khách',
        steps: [
            {
                title: 'Theo dõi khách đã giới thiệu',
                image: require('../../assets/images/help/consult_01.png'),
                description:
                    'Đây là màn hình giới thiệu khách, dành cho những khách hàng mình cần tư vấn hộ. Mỗi khi bạn giới thiệu một khách hàng tiềm năng, họ sẽ xuất hiện tại đây kèm trạng thái xử lý. Nhấn "+ Giới thiệu khách" để thêm người mới.',
                tips: [
                    'Badge "Đang tư vấn" (xanh dương) = đội bán hàng đang liên hệ với khách.',
                    'Badge "Thành công" (xanh lá) = tư vấn khách thành công -> Khách sẽ sớm có đơn hàng.',
                    'Badge "Thất bại" (đỏ) = khách không chốt — bạn không mất gì, hãy giới thiệu thêm khách hàng để tư vấn viên hỗ trợ tư vấn nhé.',
                    'Nhấn vào khách để xem chi tiết tiến trình xử lý.',
                ],
            },
            {
                title: 'Chi tiết người cần tư vấn',
                image: require('../../assets/images/help/consult_02.png'),
                description:
                    'Hiển thị chi tiết người cần tư vấn bao gồm các thông tin cơ bản, kèm theo đó là các chức năng đi kèm như gọi điện, nhắn tin',
                tips: [
                    'Với những khách hàng tư vấn thành công sẽ được hiển thị bên tab Khách hàng và người giới thiệu khách sẽ nhận được hoa hồng mỗi khi vị khách đó có đơn.',
                    'Điền đầy đủ thông tin (tên, SĐT, địa chỉ, nhu cầu) để tăng tỉ lệ chốt.',
                ],
            },
        ],
    },

    // ─── DỊCH VỤ ─────────────────────────────────────────────────
    service: {
        screenLabel: 'Dịch vụ',
        steps: [
            {
                title: 'Danh sách dịch vụ',
                image: require('../../assets/images/help/service_01.png'),
                description:
                    'Màn dịch vụ hiển thị thông số các dịch vụ đã được tạo, danh sách đã hoàn thành và chưa hoàn thành',
                tips: [
                    'Nhấn "+ Tạo dịch vụ" để đăng ký dịch vụ mới cho khách.',
                    'Tìm kiếm theo tên khách hoặc mã dịch vụ để lọc nhanh.',
                    'Dịch vụ có thể liên kết với đơn hàng hoặc đứng độc lập.',
                ],
            },
            {
                title: 'Đọc và lọc danh sách',
                image: require('../../assets/images/help/service_02.png'),
                description:
                    'Bảng dịch vụ hiển thị mã, khách hàng, loại dịch vụ (Giao hàng / Lắp đặt / Bảo dưỡng), ngày tạo, ngày dự kiến hoàn thành và trạng thái. Dịch vụ đang chọn được tô sáng viền xanh bên trái.',
                tips: [
                    'Nhấn vào dòng để mở chi tiết ở panel bên phải (máy tính) hoặc màn tiếp theo (điện thoại).',
                    'Màu trạng thái: vàng cam = chờ, xanh dương = đang xử lý, xanh lá = hoàn thành.',
                ],
            },
            {
                title: 'Chi tiết và cập nhật dịch vụ',
                image: require('../../assets/images/help/service_03.png'),
                description:
                    'Panel chi tiết hiển thị loại dịch vụ, thông tin khách hàng (tên, SĐT, địa chỉ), mã đơn hàng liên kết và danh sách thiết bị cần xử lý. Nhấn "Chỉnh sửa" để cập nhật tiến độ.',
                tips: [
                    'Nhấn "Chỉnh sửa" → thay đổi trạng thái → "Lưu" để cập nhật tiến độ.',
                    'Khi hoàn thành, đổi trạng thái sang "Hoàn thành" để đóng yêu cầu.',
                    'Nhấn "Huỷ dịch vụ" chỉ khi khách yêu cầu hủy — thao tác này không hoàn tác được.',
                ],
            },
        ],
    },

    // ─── ĐỘI NGŨ ─────────────────────────────────────────────────
    team: {
        screenLabel: 'Đội ngũ',
        steps: [
            {
                title: 'Danh sách thành viên trực thuộc',
                image: require('../../assets/images/help/team_01.png'),
                description:
                    'Màn hình Đội ngũ hiển thị tất cả thành viên đang hoạt động trong đội nhóm của bạn , nhóm theo vai trò. Mỗi thẻ ghi rõ tên, email, số điện thoại và vai trò hiện tại.',
                tips: [
                    'Bạn chỉ thấy những người đã đăng ký dưới mã giới thiệu của bạn.',
                    'Nhấn vào thẻ thành viên để xem thông tin chi tiết và liên hệ.',
                    'Số liệu đội nhóm ảnh hưởng trực tiếp đến doanh thu và xếp hạng của bạn.',
                ],
            },
            {
                title: 'Xem chi tiết thành viên',
                image: require('../../assets/images/help/team_02.png'),
                description:
                    'Nhấn vào một thành viên để xem thông tin đầy đủ: email, số điện thoại, vai trò, ngày tham gia và doanh số. ',
                tips: [
                    // 'Nhấn "Chat" trong chi tiết thành viên để liên lạc trực tiếp.',
                    'Muốn thêm thành viên mới: chia sẻ mã giới thiệu của bạn .',
                ],
            },
        ],
    },

    // ─── BẢNG XẾP HẠNG ───────────────────────────────────────────
    leaderboard: {
        screenLabel: 'Bảng xếp hạng',
        steps: [
            {
                title: 'Xếp hạng doanh số theo kỳ',
                image: require('../../assets/images/help/leaderboard_01.png'),
                description:
                    'Bảng xếp hạng so sánh doanh số giữa các thành viên trong nhóm theo từng kỳ (hôm nay, tháng này, quý, năm). Các thẻ ở trên hiển thị tổng số người tham gia, tổng doanh thu Top 3 và người đang dẫn đầu.',
                tips: [
                    'Chọn bộ lọc kỳ ở trên cùng để so sánh theo hôm nay, tháng, quý hoặc năm.',
                    'Doanh số chỉ tính đơn có trạng thái "Đã thanh toán".',
                    'Thứ hạng cập nhật ngay khi có đơn hàng mới được xác nhận thanh toán.',
                ],
            },
            // {
            //     title: 'Xem chi tiết từng thành viên',
            //     image: require('../../assets/images/help/leaderboard_02.png'),
            //     description:
            //         'Nhấn vào tên một thành viên trong bảng để xem chi tiết doanh số, số đơn hàng và hiệu suất của họ. Admin và Giám đốc thấy toàn bộ đội; các vai trò khác chỉ thấy người cùng cấp và cấp dưới.',
            //     tips: [
            //         'Tìm kiếm theo tên để nhanh chóng tra cứu thành viên cụ thể.',
            //         'Màu xanh = đứng đầu kỳ; vị trí 1-3 có huy hiệu vàng/bạc/đồng.',
            //     ],
            // },
        ],
    },

    // ─── HOA HỒNG ────────────────────────────────────────────────
    commission: {
        screenLabel: 'Hoa hồng',
        steps: [
            {
                title: 'Tổng quan hoa hồng',
                image: require('../../assets/images/help/commission_01.png'),
                description:
                    'Màn hình Hoa hồng hiển thị 3 thẻ tổng hợp: số đơn đang chờ giải ngân, số đã thanh toán và tổng hoa hồng tích lũy trong kỳ. Viền vàng = chờ, viền xanh = đã nhận.',
                tips: [
                    'Hoa hồng phát sinh khi đơn hàng chuyển sang trạng thái "Đã thanh toán".',
                    'Nếu hoa hồng chưa hiển thị, liên hệ Admin để xác nhận trạng thái đơn hàng.',
                ],
            },
            {
                title: 'Chi tiết từng khoản hoa hồng',
                image: require('../../assets/images/help/commission_02.png'),
                description:
                    'Bảng lịch sử liệt kê từng giao dịch kèm mã đơn, tên khách hàng, giá trị đơn, số tiền hoa hồng và trạng thái (Chờ trả / Đã trả). Admin nhấn "Xác nhận trả" để đánh dấu đã thanh toán cho nhân viên.',
                tips: [
                    '"Chờ trả" (cam) = hoa hồng đã được duyệt, chờ Admin giải ngân.',
                    '"Đã trả" (xanh lá) = đã nhận tiền — lưu lại để đối soát.',
                    'Admin: nhấn "Xác nhận trả" sau khi đã chuyển khoản thực tế cho nhân viên.',
                ],
            },
        ],
    },

    // ─── BÁO CÁO DOANH THU ───────────────────────────────────────
    revenue: {
        screenLabel: 'Báo cáo doanh thu',
        steps: [
            {
                title: 'Các thẻ KPI doanh thu',
                image: require('../../assets/images/help/analytics_01.png'),
                description:
                    'Màn báo cáo hiển thị 3 thẻ chính: Tổng thu nhập (bao gồm cả chưa thanh toán), Đang chờ xử lý (đơn đã tạo nhưng chưa thu tiền) và Đã thanh toán tháng này (doanh thu thực thu).',
                tips: [
                    '"Tổng thu nhập" = doanh thu đã thu + doanh thu dự kiến — dùng để theo dõi toàn bộ.',
                    '"Đã thanh toán tháng này" là con số thực tế quan trọng nhất.',
                ],
            },
            {
                title: 'Lịch sử giao dịch',
                image: require('../../assets/images/help/analytics_02.png'),
                description:
                    'Bảng lịch sử liệt kê từng đơn hàng với giá trị, hoa hồng và trạng thái thanh toán. Bạn có thể lọc theo khoảng thời gian hoặc tìm theo tên khách để xem báo cáo riêng.',
                tips: [
                    'Lọc theo tháng hoặc quý để xuất báo cáo gửi cấp trên.',
                    'Admin: nhấn "Xác nhận trả" để cập nhật trạng thái hoa hồng.',
                ],
            },
            {
                title: 'Biểu đồ xu hướng',
                image: require('../../assets/images/help/analytics_03.png'),
                description:
                    'Biểu đồ cột so sánh doanh thu theo quý (Q1–Q4) hoặc theo từng tháng trong năm. Cột màu đậm là kỳ đang dẫn đầu. Dùng bộ lọc góc phải để chuyển giữa "Theo quý" và "Theo năm".',
                tips: [
                    'Nhấn vào một cột để xem chi tiết danh sách đơn trong kỳ đó.',
                    'Dùng biểu đồ để xác định tháng cao điểm và lập kế hoạch bán hàng.',
                ],
            },
        ],
    },

    // ─── BÁO CÁO KHU VỰC ─────────────────────────────────────────
    region: {
        screenLabel: 'Báo cáo khu vực',
        steps: [
            {
                title: 'Phân bổ doanh thu theo khu vực',
                image: require('../../assets/images/help/region_01.png'),
                description:
                    'Màn hình phân tích doanh thu theo 3 miền: Bắc, Trung, Nam. Mỗi thẻ hiển thị doanh thu, số đơn hàng và số khách hàng thuộc vùng đó. Thanh tiến trình bên dưới thể hiện tỉ lệ % so với tổng.',
                tips: [
                    'Khu vực có viền tô sáng là vùng đang đóng góp doanh thu cao nhất.',
                    'Nhấn vào thẻ khu vực để xem danh sách đơn hàng và khách hàng trong vùng.',
                    'Dữ liệu khu vực xác định dựa trên địa chỉ của khách hàng.',
                ],
            },
        ],
    },

    // ─── TIN TỨC ─────────────────────────────────────────────────
    news: {
        screenLabel: 'Tin tức',
        steps: [
            {
                title: 'Đọc thông báo & tin tức nội bộ',
                image: require('../../assets/images/help/news_01.png'),
                description:
                    'Màn hình Tin tức là nơi công ty đăng thông báo nội bộ, chính sách mới, chương trình khuyến mãi và cập nhật hệ thống. Banner lớn ở trên là bài nổi bật, phần bên dưới là các bài mới nhất.',
                tips: [
                    'Nhấn "Đọc chi tiết →" để đọc toàn bộ nội dung bài viết.',
                    'Nhãn màu cho biết loại tin: HỆ THỐNG (xanh), KHUYẾN MÃI (cam), THÔNG BÁO (tím).',
                    'Admin có thể nhấn icon bút để sửa và icon thùng rác để xóa bài viết.',
                    'Kiểm tra mục này thường xuyên để không bỏ lỡ thông tin quan trọng.',
                ],
            },
        ],
    },

    // ─── BẢNG GIÁ ────────────────────────────────────────────────
    information: {
        screenLabel: 'Bảng giá',
        steps: [
            {
                title: 'Bảng giá sản phẩm',
                image: require('../../assets/images/help/information_01.png'),
                description:
                    'Danh sách toàn bộ sản phẩm kèm giá bán.',
                tips: [
                    'Giá bạn thấy chính là giá gợi ý — dùng để báo giá cho khách.',
                    'Nhấn vào thẻ sản phẩm để xem thông số kỹ thuật đầy đủ (công suất, thương hiệu...).',

                ],
            },
        ],
    },

    // ─── PHÒNG CHAT ──────────────────────────────────────────────
    chatList: {
        screenLabel: 'Phòng Chat',
        steps: [
            {
                title: 'Danh sách phòng hỗ trợ',
                image: require('../../assets/images/help/chat_01.png'),
                description:
                    'Mỗi đơn hàng tạo ra một phòng chat riêng để trao đổi với đội hỗ trợ. Danh sách này hiển thị tất cả phòng chat bạn đang tham gia, kèm tên khách hàng và mã đơn liên kết.',
                tips: [
                    'Nhấn vào phòng để mở cửa sổ chat và xem toàn bộ lịch sử tin nhắn.',
                    'Admin thấy toàn bộ phòng; nhân viên chỉ thấy phòng mình liên quan.',
                    'Phòng chat tự tạo khi đơn hàng mới được tạo — bạn không cần tạo thủ công.',
                ],
            },
            // {
            //     title: 'Mở chat nhanh từ trang chủ',
            //     image: require('../../assets/images/help/chat_02.png'),
            //     description:
            //         'Từ trang chủ, nhấn nút "Phòng chat" trong khu vực Thao tác nhanh để vào ngay danh sách chat. Đây là cách nhanh nhất khi bạn đang ở trang chủ và cần trả lời tin nhắn gấp.',
            //     tips: [
            //         'Bạn sẽ nhận thông báo đẩy mỗi khi có tin nhắn mới trong phòng của mình.',
            //     ],
            // },
        ],
    },

    // ─── THÔNG TIN CÁ NHÂN ───────────────────────────────────────
    profile: {
        screenLabel: 'Thông tin cá nhân',
        steps: [
            {
                title: 'Thông tin tài khoản & mã giới thiệu',
                image: require('../../assets/images/help/profile_01.png'),
                description:
                    'Trang hồ sơ hiển thị tên, vai trò, email, số điện thoại và địa chỉ của bạn. Phần "Mã giới thiệu" bên dưới là mã duy nhất để bạn mời thành viên mới tham gia dưới nhóm của mình.',
                tips: [
                    'Chia sẻ mã giới thiệu với đối tác/cộng tác viên để họ đăng ký dưới tên bạn.',
                    'Mỗi thành viên đăng ký qua mã của bạn sẽ tạo ra hoa hồng lên tuyến cho bạn.',
                    // 'Nhấn vào mã để sao chép và chia sẻ qua Zalo, Facebook...',
                ],
            },
            {
                title: 'Chỉnh sửa & bảo mật',
                image: require('../../assets/images/help/profile_02.png'),
                description:
                    'Nhấn "Chỉnh sửa hồ sơ" để cập nhật thông tin cá nhân và tài khoản ngân hàng. Mục "Bảo mật" cho phép đổi mật khẩu — nên thực hiện ngay khi lần đầu đăng nhập.',
                tips: [
                    'Thông tin ngân hàng cần điền đúng để nhận thanh toán hoa hồng.',
                    'Mật khẩu nên có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.',
                    'Đổi mật khẩu định kỳ mỗi 3 tháng để bảo mật tài khoản.',
                ],
            },
        ],
    },

    // ─── TÍNH TOÁN ───────────────────────────────────────────────
    calculator: {
        screenLabel: 'Tính toán',
        steps: [
            {
                title: 'Bảng tính giá & hoa hồng nhanh',
                image: require('../../assets/images/help/calculator_01.png'),
                description:
                    'Công cụ tính toán giúp bạn ước tính nhanh giá bán, chiết khấu và hoa hồng trước khi báo giá cho khách. Nhập tên sản phẩm, số lượng và giá — bảng sẽ tự tính tổng và hoa hồng tương ứng.',
                tips: [
                    'Thay đổi số lượng hoặc % chiết khấu — tổng cộng cập nhật ngay lập tức.',
                    'Dùng bảng tính này để thương lượng giá với khách mà không mất thời gian tính tay.',
                    'Cột "Hoa hồng" tính theo tỉ lệ vai trò của bạn trong hệ thống.',
                ],
            },
        ],
    },

    // ─── CHỈNH SỬA HỒ SƠ ────────────────────────────────────────
    editProfile: {
        screenLabel: 'Chỉnh sửa hồ sơ',
        steps: [
            {
                title: 'Cập nhật thông tin cá nhân',
                image: require('../../assets/images/help/editProfile_01.png'),
                description:
                    'Form chỉnh sửa cho phép cập nhật họ tên, số điện thoại và địa chỉ. Nhấn "Lưu thay đổi" ở cuối trang để áp dụng — thông tin mới sẽ hiển thị ngay trên toàn hệ thống.',
                tips: [
                    'Họ tên và số điện thoại là bắt buộc — không được để trống.',
                    'Địa chỉ của bạn có thể được dùng làm địa chỉ giao hàng mặc định khi tạo đơn.',
                    'Ảnh đại diện hiển thị trong danh sách thành viên và phòng chat.',
                ],
            },
        ],
    },

    // ─── TẠO ĐƠN HÀNG ────────────────────────────────────────────
    addOrder: {
        screenLabel: 'Tạo đơn hàng',
        steps: [
            {
                title: 'Bước 1 — Chọn loại đơn & khách hàng',
                image: require('../../assets/images/help/addOrder_01.png'),
                description:
                    'Đầu tiên chọn loại đơn: "Đơn lẻ" (lắp đặt tại nhà khách) hoặc "Đơn buôn" (bán số lượng lớn). Với đơn lẻ, bạn phải chọn khách hàng từ danh sách — gõ tên hoặc SĐT để tìm nhanh. Tiếp theo chọn ngày giao hàng.',
                tips: [
                    'Chưa có khách? Thoát ra, vào tab Khách hàng thêm mới, rồi quay lại tạo đơn.',
                    'Đơn lẻ áp giá CTV/Đối tác; Đơn buôn áp giá Đại lý — giá tự điền khi chọn sản phẩm.',
                    'Địa chỉ giao hàng tự điền từ địa chỉ khách — có thể sửa lại nếu cần.',
                ],
            },
            {
                title: 'Bước 2 — Thêm sản phẩm vào đơn',
                image: require('../../assets/images/help/addOrder_02.png'),
                description:
                    'Nhấn "+ Thêm sản phẩm" → chọn từ danh mục → nhập số lượng và giá bán → nhấn "Thêm". Có thể thêm nhiều sản phẩm khác nhau vào cùng một đơn. Tổng giá trị đơn hiển thị tự động ở cuối.',
                tips: [
                    'Giá sản phẩm tự điền theo vai trò — bạn có thể sửa nếu cần thương lượng.',
                    'Nhấn icon thùng rác bên cạnh sản phẩm để xóa khỏi đơn.',
                    'Tối thiểu 1 sản phẩm mới tạo được đơn hàng.',
                ],
            },
            {
                title: 'Bước 3 — Dịch vụ kèm & hoàn tất',
                image: require('../../assets/images/help/addOrder_03.png'),
                description:
                    'Phần "Dịch vụ tự động tạo" cho phép bật/tắt dịch vụ kèm theo đơn (giao hàng, lắp đặt). Bật dịch vụ nào thì sau khi tạo đơn, một yêu cầu dịch vụ tương ứng sẽ tự động xuất hiện trong tab Dịch vụ. Nhấn "Tạo đơn hàng" để hoàn tất.',
                tips: [
                    'Bật dịch vụ "Lắp đặt" nếu khách cần đội kỹ thuật đến tận nơi.',
                    'Sau khi tạo đơn, bạn có thể tạo thêm dịch vụ riêng từ tab Dịch vụ bất cứ lúc nào.',
                    'Ghi chú đơn hàng sẽ hiển thị cho nhân viên giao hàng và kỹ thuật.',
                ],
            },
        ],
    },

    // ─── SỬA ĐƠN HÀNG ────────────────────────────────────────────
    editOrder: {
        screenLabel: 'Sửa đơn hàng',
        steps: [
            {
                title: 'Chỉnh sửa thông tin đơn hàng',
                image: require('../../assets/images/help/editOrder_01.png'),
                description:
                    'Form sửa đơn cho phép chỉnh sửa danh sách sản phẩm (thêm/xóa/đổi số lượng), địa chỉ giao hàng và ghi chú. Nhấn "Lưu" để áp dụng thay đổi. Lưu ý: chỉ có thể sửa khi đơn còn ở trạng thái "Chờ xác nhận".',
                tips: [
                    'Chỉ người tạo đơn hoặc Admin mới có quyền chỉnh sửa.',
                    'Đơn đã xác nhận hoặc đang giao hàng không thể sửa — liên hệ Admin.',
                    'Không thể xóa sản phẩm cuối cùng trong đơn — phải hủy đơn nếu cần.',
                ],
            },
        ],
    },

    // ─── THÊM KHÁCH HÀNG ─────────────────────────────────────────
    addCustomer: {
        screenLabel: 'Thêm khách hàng',
        steps: [
            {
                title: 'Nhập thông tin cơ bản',
                image: require('../../assets/images/help/addCustomer_01.png'),
                description:
                    'Điền tên đầy đủ, số điện thoại (bắt buộc) và địa chỉ của khách hàng. Chọn mô hình kinh doanh: "Cá nhân" cho khách mua lẻ, "Doanh nghiệp / Hộ KD" cho khách có mã số thuế. Số điện thoại phải là duy nhất — hệ thống sẽ cảnh báo nếu trùng.',
                tips: [
                    'Số điện thoại dùng để nhận diện khách — điền đúng từ đầu để tránh sai sót.',
                    'Địa chỉ sẽ tự điền vào form tạo đơn hàng — điền đầy đủ để thuận tiện.',
                    'Chọn "Doanh nghiệp" để mở thêm trường mã số thuế và người liên hệ.',
                ],
            },
        ],
    },

    // ─── SỬA KHÁCH HÀNG ──────────────────────────────────────────
    editCustomer: {
        screenLabel: 'Sửa khách hàng',
        steps: [
            {
                title: 'Cập nhật thông tin liên hệ',
                image: require('../../assets/images/help/editCustomer_01.png'),
                description:
                    'Cập nhật tên, số điện thoại, địa chỉ hoặc các thông tin khác khi khách hàng thay đổi. Nhấn "Lưu thay đổi" để xác nhận. Lịch sử đơn hàng và dịch vụ của khách không bị ảnh hưởng.',
                tips: [
                    'Chỉ người tạo khách hoặc Admin mới có quyền chỉnh sửa.',
                    'Thay đổi địa chỉ sẽ áp dụng cho đơn mới — các đơn cũ không đổi.',
                    'Email tài khoản (nếu có) là duy nhất — không thể đổi sau khi đã tạo.',
                ],
            },
        ],
    },

    // ─── THÊM GIỚI THIỆU KHÁCH ───────────────────────────────────
    addConsult: {
        screenLabel: 'Giới thiệu khách mới',
        steps: [
            {
                title: 'Điền thông tin khách được giới thiệu',
                image: require('../../assets/images/help/addConsult_01.png'),
                description:
                    'Nhập tên, số điện thoại (bắt buộc), địa chỉ và ghi chú nhu cầu của người bạn muốn giới thiệu. Sau khi gửi, đội bán hàng sẽ liên hệ với khách này và theo dõi tiến trình tư vấn.',
                tips: [
                    'Điền thêm nhu cầu cụ thể vào "Ghi chú" để đội tư vấn tiếp cận đúng hơn.',
                    'Sau khi gửi, theo dõi trạng thái trong tab Giới thiệu khách.',
                    'Hoa hồng chỉ được tính khi khách chốt đơn và thanh toán thành công.',
                    'Một số điện thoại chỉ giới thiệu được một lần — kiểm tra trước khi gửi.',
                ],
            },
        ],
    },

    // ─── ĐĂNG KÝ DỊCH VỤ ─────────────────────────────────────────
    addService: {
        screenLabel: 'Tạo dịch vụ',
        steps: [
            {
                title: 'Chọn loại dịch vụ',
                image: require('../../assets/images/help/addService_01.png'),
                description:
                    'Chọn loại dịch vụ cần thực hiện: Lắp đặt (kỹ thuật đến lắp máy), Giao hàng (vận chuyển đến địa điểm), Bảo dưỡng (bảo trì định kỳ) hoặc Tư vấn. Mỗi loại có quy trình và đội phụ trách riêng.',
                tips: [
                    'Dịch vụ "Lắp đặt" và "Bảo dưỡng" yêu cầu chọn đơn hàng và thiết bị cụ thể.',
                    '"Giao hàng" và "Tư vấn" không bắt buộc phải có đơn hàng liên kết.',
                ],
            },
            {
                title: 'Liên kết đơn hàng & điền thông tin khách',
                image: require('../../assets/images/help/addService_01.png'),
                description:
                    'Nếu dịch vụ liên quan đến một đơn hàng cụ thể, chọn đơn từ danh sách — tên và số điện thoại khách sẽ tự điền. Nếu dịch vụ độc lập (chưa có đơn), điền thẳng thông tin khách vào form. Bật "Lưu làm khách hàng" nếu muốn lưu khách vào hệ thống.',
                tips: [
                    'Chọn đơn hàng → SĐT và tên khách tự điền — không cần gõ lại.',
                    '"Lưu làm khách hàng" chỉ hiện khi SĐT chưa có trong hệ thống.',
                    'Địa chỉ lắp đặt có thể khác địa chỉ giao hàng — sửa lại nếu cần.',
                    'Thêm ghi chú yêu cầu đặc biệt (tầng lầu, loại ống nước...) để kỹ thuật chuẩn bị.',
                ],
            },
        ],
    },

    // ─── SỬA DỊCH VỤ ─────────────────────────────────────────────
    editService: {
        screenLabel: 'Sửa dịch vụ',
        steps: [
            {
                title: 'Cập nhật tiến độ dịch vụ',
                image: require('../../assets/images/help/editService_01.png'),
                description:
                    'Cập nhật trạng thái dịch vụ, địa chỉ, ngày hoàn thành dự kiến và ghi chú. Mỗi lần thay đổi trạng thái sẽ được ghi nhận vào lịch sử để dễ theo dõi. Nhấn "Lưu" để xác nhận.',
                tips: [
                    'Đổi sang "Đang xử lý" khi kỹ thuật đã ra hiện trường.',
                    'Đổi sang "Hoàn thành" sau khi khách đã nhận hàng và ký biên nhận.',
                    'Ghi chú tiến độ (vật liệu thiếu, phát sinh...) để đội nội bộ nắm tình hình.',
                ],
            },
        ],
    },

    // ─── SỬA NGƯỜI DÙNG (ADMIN) ──────────────────────────────────
    editUser: {
        screenLabel: 'Sửa tài khoản',
        steps: [
            {
                title: 'Chỉnh sửa thông tin tài khoản người dùng',
                image: require('../../assets/images/help/editUser_01.png'),
                description:
                    'Màn hình chỉ dành cho Admin và Giám đốc. Có thể chỉnh sửa thông tin cá nhân, tài khoản ngân hàng (để trả hoa hồng) và ghi chú nội bộ về người dùng này. Nhấn "Lưu thay đổi" để áp dụng.',
                tips: [
                    'Thông tin ngân hàng cần đúng để hệ thống trả hoa hồng chính xác.',
                    'Trường "Email tài khoản" là khóa định danh — không thể thay đổi.',
                    'Ghi chú admin chỉ Admin/GĐ thấy — dùng để ghi chú nội bộ về nhân viên.',
                    'Thay đổi vai trò ảnh hưởng ngay đến quyền truy cập — thực hiện cẩn thận.',
                ],
            },
        ],
    },

    // ─── XEM CHI TIẾT KHÁCH HÀNG ────────────────────────────────
    CustomerView: {
        screenLabel: 'Hồ sơ khách hàng',
        steps: [
            {
                title: 'Hồ sơ đầy đủ của khách hàng',
                image: require('../../assets/images/help/editCustomer_01.png'),
                description:
                    'Trang hồ sơ hiển thị toàn bộ thông tin liên hệ, ai đã tạo khách, danh sách đơn hàng đã đặt và dịch vụ liên quan. Từ đây bạn có thể tạo đơn hàng mới cho khách chỉ một bước, không cần tìm lại thông tin.',
                tips: [
                    'Nhấn "Tạo đơn" — thông tin khách tự điền vào form, tiết kiệm thời gian.',
                    'Nhấn "Sửa" để cập nhật thông tin nếu khách thay đổi địa chỉ hoặc SĐT.',
                    'Đơn hàng được sắp xếp mới nhất lên đầu — cuộn xuống để xem lịch sử cũ hơn.',
                ],
            },
        ],
    },

    // ─── XEM CHI TIẾT TIN TỨC ────────────────────────────────────
    newsDetail: {
        screenLabel: 'Bài viết',
        steps: [
            {
                title: 'Đọc nội dung bài viết đầy đủ',
                image: require('../../assets/images/help/newsDetail_01.png'),
                description:
                    'Trang chi tiết hiển thị toàn bộ nội dung bài viết với ảnh minh họa, tiêu đề, loại bài (Hệ thống / Khuyến mãi / Thông báo) và thời gian đăng. Cuộn xuống để đọc hết nội dung.',
                tips: [
                    'Cuộn xuống để đọc toàn bộ — một số bài có ảnh và bảng thông tin ở phần dưới.',
                    'Admin: nhấn icon bút (✏️) để chỉnh sửa nội dung bài viết.',
                    'Admin: nhấn icon thùng rác (🗑️) để xóa bài — hành động này không hoàn tác.',
                ],
            },
        ],
    },

    // ─── PHÒNG CHAT ──────────────────────────────────────────────
    chat: {
        screenLabel: 'Phòng chat',
        steps: [
            {
                title: 'Trao đổi hỗ trợ theo đơn hàng',
                image: require('../../assets/images/help/chat_room_01.png'),
                description:
                    'Mỗi phòng chat liên kết với một đơn hàng cụ thể, giúp đội ngũ trao đổi về tiến độ, vấn đề phát sinh hoặc yêu cầu đặc biệt của khách. Gõ tin nhắn vào ô phía dưới và nhấn gửi.',
                tips: [
                    'Tin nhắn của bạn hiển thị bên phải (nền xanh), tin đối phương bên trái.',
                    'Thông báo đẩy sẽ gửi đến điện thoại khi có tin nhắn mới — bật thông báo để không bỏ lỡ.',
                    'Mã đơn hàng hiển thị ở tiêu đề phòng — nhấn vào để xem chi tiết đơn.',
                ],
            },
        ],
    },

    // ─── HỢP ĐỒNG / BIÊN BẢN BÀN GIAO ──────────────────────────
    orderContract: {
        screenLabel: 'Biên bản bàn giao',
        steps: [
            {
                title: 'Xuất biên bản bàn giao',
                image: require('../../assets/images/help/orderContract_01.png'),
                description:
                    'Trang này tạo biên bản bàn giao hàng chính thức từ thông tin đơn hàng: tên khách, danh sách thiết bị, dịch vụ kèm và điều khoản bảo hành. Nhấn "Xuất PDF" để tải về và in cho khách ký.',
                tips: [
                    'In biên bản và yêu cầu khách ký trước khi bàn giao thiết bị.',
                    'Biên bản tự điền thông tin từ đơn hàng — kiểm tra lại trước khi in.',
                    'Lưu file PDF sau khi khách ký để làm bằng chứng giao nhận.',
                ],
            },
        ],
    },

    // ─── DANH SÁCH NGƯỜI DÙNG (ADMIN) ────────────────────────────
    user: {
        screenLabel: 'Người dùng',
        steps: [
            {
                title: 'Quản lý danh sách tài khoản',
                image: require('../../assets/images/help/user_01.png'),
                description:
                    'Màn hình chỉ dành cho Admin và Giám đốc. Bảng hiển thị tất cả tài khoản trong hệ thống: avatar, tên, email, biệt danh, vai trò và trạng thái xác minh. Nhấn vào dòng để xem và quản lý tài khoản đó.',
                tips: [
                    'Dòng có viền xanh bên trái là tài khoản đang được chọn.',
                    'Tìm kiếm theo tên hoặc email để nhanh chóng tìm tài khoản cần quản lý.',
                    'Tài khoản "Chờ xác thực" cần Admin duyệt trước khi người dùng có thể sử dụng đầy đủ.',
                ],
            },
            {
                title: 'Chi tiết và quản lý tài khoản',
                image: require('../../assets/images/help/user_02.png'),
                description:
                    'Panel chi tiết có 3 tab: "Thông tin" (email, SĐT, địa chỉ, vai trò, ngân hàng), "Biệt danh" (tên hiển thị nội bộ) và "Cộng tác" (liên kết cộng tác với các tài khoản khác). Nút "Khóa TK" để tạm vô hiệu hóa đăng nhập.',
                tips: [
                    'Nhấn "Chỉnh sửa" để cập nhật thông tin tài khoản (vai trò, SĐT, ngân hàng).',
                    'Nhấn "Khóa TK" để ngăn tài khoản đăng nhập — không xóa dữ liệu.',
                    'Tab "Ngân hàng" lưu tài khoản ngân hàng để hệ thống trả hoa hồng đúng người.',
                ],
            },
        ],
    },
};
