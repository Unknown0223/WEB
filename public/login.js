document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const submitButton = loginForm.querySelector('button[type="submit"]');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Sahifani yangilanishini oldini olish
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        // Eski xatolik xabarini tozalash
        errorMessage.textContent = '';
        errorMessage.classList.remove('active');

        // Kiritilgan ma'lumotlarni tekshirish
        if (!username || !password) {
            errorMessage.textContent = 'Login va parolni to\'liq kiriting.';
            errorMessage.classList.add('active');
            return;
        }

        // Tugmani bloklash va yuklanish holatini ko'rsatish
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = 'Kirilmoqda... <span class="spinner"></span>';

        try {
            // Serverga login so'rovini yuborish
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }), 
            });

            const result = await response.json();

            if (response.ok) {
                // Agar server "ok" javobini bersa (status 200-299)
                // Serverdan kelgan `redirectUrl` bo'yicha yo'naltirish.
                // Agar `redirectUrl` kelmasa, standart holatda asosiy sahifaga (/) o'tadi.
                window.location.href = result.redirectUrl || '/';
            } else {
                // Agar server xatolik javobini bersa
                throw new Error(result.message || 'Login yoki parol noto\'g\'ri.');
            }
        } catch (error) {
            // Agar server bilan umuman bog'lanib bo'lmasa yoki serverdan xatolik kelsa
            errorMessage.textContent = error.message || 'Server bilan bog\'lanishda xatolik yuz berdi.';
            errorMessage.classList.add('active');
            console.error('Login jarayonida xatolik:', error);
        } finally {
            // So'rov tugagach, tugmani asl holiga qaytarish
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
});
