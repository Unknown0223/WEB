document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        errorMessage.textContent = '';
        if (!username || !password) {
            errorMessage.textContent = 'Login va parolni to\'liq kiriting.';
            return;
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }), 
            });
            const result = await response.json();
            if (response.ok) {
                window.location.href = '/';
            } else {
                errorMessage.textContent = result.message || 'Login yoki parol noto\'g\'ri.';
            }
        } catch (error) {
            errorMessage.textContent = 'Server bilan bog\'lanishda xatolik yuz berdi.';
            console.error('Login jarayonida xatolik:', error);
        }
    });
});