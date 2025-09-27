// Bu kod faqat DOM (sahifa elementlari) to'liq yuklangandan so'ng ishga tushadi
document.addEventListener('DOMContentLoaded', () => {
    // Kerakli HTML elementlarni topib olamiz
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    // Formadagi "KIRISH" tugmasi bosilishini eshitib turamiz
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Formaning standart ishi (sahifani yangilash)ni bekor qilamiz

        // Kiritilgan login va parolni o'zgaruvchilarga olamiz
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        // Har urinishdan oldin eski xatolik xabarini tozalaymiz
        errorMessage.textContent = '';

        // Agar maydonlar bo'sh bo'lsa, xato beramiz
        if (!username || !password) {
            errorMessage.textContent = 'Login va parolni to\'liq kiriting.';
            return;
        }

        try {
            // Serverning '/api/login' manziliga POST so'rovini yuboramiz
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Yuborilayotgan ma'lumot JSON formatida ekanligini bildiramiz
                },
                // Yuboriladigan ma'lumotni JSON string formatiga o'tkazamiz
                body: JSON.stringify({ username, password }), 
            });

            // Serverdan kelgan javobni JSON formatida o'qib olamiz
            const result = await response.json();

            if (response.ok) {
                // Agar serverdan "muvaffaqiyatli" (status 200-299) javob kelsa
                // Asosiy sahifaga ('/') yo'naltiramiz
                window.location.href = '/';
            } else {
                // Agar serverdan xatolik (status 4xx, 5xx) javobi kelsa
                // Xatolik xabarini ekranga chiqaramiz
                errorMessage.textContent = result.message || 'Login yoki parol noto\'g\'ri.';
            }
        } catch (error) {
            // Agar server bilan umuman bog'lanib bo'lmasa (masalan, internet yo'q yoki server ishlamayapti)
            errorMessage.textContent = 'Server bilan bog\'lanishda xatolik yuz berdi.';
            console.error('Login jarayonida xatolik:', error);
        }
    });
});
