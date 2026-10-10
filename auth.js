"use strict";

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#c62828" : "#087c58";
}

function setButtonLoading(button, loading, normalText) {
    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
}


// ========================================
// Registration
// ========================================

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const button = document.getElementById("registerButton");

        if (password.length < 8) {
            showMessage(
                "Your password must contain at least 8 characters.",
                true
            );
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.", true);
            return;
        }

        setButtonLoading(button, true, "Create Account");
        showMessage("");

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin + "/login.html"
                }
            });

            if (error) {
                throw error;
            }

            if (data.session) {
                showMessage("Account created successfully! Opening dashboard...");

                window.location.replace("dashboard.html");
            } else {
                showMessage(
                    "Registration successful! Check your email for a confirmation link. After confirming, return to the login page."
                );

                registerForm.reset();
            }
        } catch (error) {
            showMessage(error.message || "Registration failed.", true);
        } finally {
            setButtonLoading(button, false, "Create Account");
        }
    });
}


// ========================================
// Login
// ========================================

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const button = document.getElementById("loginButton");

        setButtonLoading(button, true, "Log In");
        showMessage("");

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            showMessage("Login successful! Opening dashboard...");

            window.location.replace("dashboard.html");
        } catch (error) {
            showMessage(
                error.message || "Login failed. Check your email and password.",
                true
            );
        } finally {
            setButtonLoading(button, false, "Log In");
        }
    });
}