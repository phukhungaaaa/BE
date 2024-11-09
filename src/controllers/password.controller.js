const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
        return res.status(400).json({ message: "Vui lòng nhập email hợp lệ để đặt lại mật khẩu" });
    }

    try {
        const response = await fetch(
            `${process.env.REACT_APP_PASSWORD_RESET_URL}?key=${process.env.REACT_APP_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requestType: "PASSWORD_RESET",
                    email: email,
                }),
            }
        );

        if (response.ok) {
            return res.status(200).json({
                message: "Liên kết đặt lại mật khẩu đã được gửi, vui lòng kiểm tra email của bạn.",
            });
        } else {
            return res.status(404).json({ message: "Email này chưa đăng ký tài khoản Locket nào!" });
        }
    } catch (error) {
        return res.status(500).json({ message: "Đã xảy ra lỗi khi gửi yêu cầu đặt lại mật khẩu." });
    }
};

module.exports = {
    forgotPassword,
};