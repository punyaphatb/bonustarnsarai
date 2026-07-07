export function initAuth(supabase) {
    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');

    document.getElementById('go-to-register').addEventListener('click', () => {
        loginScreen.classList.add('hidden');
        registerScreen.classList.remove('hidden');
    });
    document.getElementById('go-to-login').addEventListener('click', () => {
        registerScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    });

    document.getElementById('form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signUp({
            email: document.getElementById('reg-email').value,
            password: document.getElementById('reg-password').value,
            options: { data: { display_name: document.getElementById('reg-name').value } }
        });
        if (error) alert("สมัครไม่สำเร็จ: " + error.message);
        else alert("สมัครสมาชิกสำเร็จ!");
    });

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
        });
        if (error) alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
    });
}