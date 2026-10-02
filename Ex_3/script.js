document.addEventListener("DOMContentLoaded", () => {
  // 1. Theme Switcher State & Handler
  const themeToggleBtn = document.getElementById("theme-toggle");
  const themeIcon = themeToggleBtn.querySelector(".theme-icon");
  const themeText = themeToggleBtn.querySelector(".theme-text");
  
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const isDark = currentTheme === "dark";
    
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    
    // Cập nhật trạng thái accessibility (aria-pressed) và icon/text
    themeToggleBtn.setAttribute("aria-pressed", (!isDark).toString());
    themeIcon.textContent = isDark ? "☀️" : "🌙";
    themeText.textContent = isDark ? "Light Mode" : "Dark Mode";
  });

  // 2. Contact Form Client-side State & Validation Handling
  const contactForm = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");

  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Reset lỗi cũ
    document.querySelectorAll(".error-msg").forEach(el => el.textContent = "");
    formStatus.textContent = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    let isValid = true;

    if (!name) {
      document.getElementById("name-error").textContent = "Vui lòng nhập tên.";
      isValid = false;
    }

    if (!email || !validateEmail(email)) {
      document.getElementById("email-error").textContent = "Email không hợp lệ.";
      isValid = false;
    }

    if (!message) {
      document.getElementById("message-error").textContent = "Vui lòng nhập nội dung lời nhắn.";
      isValid = false;
    }

    if (isValid) {
      // Xử lý gửi form thành công (Mô phỏng State Client-side)
      formStatus.style.color = "#38a169";
      formStatus.textContent = "Gửi tin nhắn thành công!";
      contactForm.reset();
    } else {
      formStatus.style.color = "#e53e3e";
      formStatus.textContent = "Vui lòng kiểm tra lại thông tin nhập.";
    }
  });

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});