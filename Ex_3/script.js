/**
 * Exercise 3: Component Architecture & State Modeling
 * JavaScript Implementation for Theme State, Dynamic Component Filters, and Form Validation State
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. Theme Switcher Component & State Handling
  // ==========================================================================
  const themeToggleBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const themeText = document.getElementById("theme-text");

  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem("app-theme") || "dark";
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);

    const isDark = theme === "dark";
    
    // Update accessible state (aria-pressed) & visuals
    themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
    themeIcon.textContent = isDark ? "🌙" : "☀️";
    themeText.textContent = isDark ? "Dark Mode" : "Light Mode";
  }

  // ==========================================================================
  // 2. Project Cards Filtering (Category State Modeling)
  // ==========================================================================
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll(".project-card");

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const filterValue = btn.getAttribute("data-filter");

      // Update tab state
      filterBtns.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      // Filter project cards
      projectCards.forEach(card => {
        const category = card.getAttribute("data-category");
        if (filterValue === "all" || category === filterValue) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });

  // ==========================================================================
  // 3. Contact Form Client-side State & Validation Handler
  // ==========================================================================
  const contactForm = document.getElementById("contact-form");
  const submitBtn = document.getElementById("submit-btn");
  const formStatus = document.getElementById("form-status");

  const fields = {
    name: {
      input: document.getElementById("name"),
      error: document.getElementById("name-error"),
      validate: (val) => val.trim().length >= 2 ? "" : "Họ và tên phải có ít nhất 2 ký tự."
    },
    email: {
      input: document.getElementById("email"),
      error: document.getElementById("email-error"),
      validate: (val) => validateEmail(val) ? "" : "Email không hợp lệ (Ví dụ: name@domain.com)."
    },
    subject: {
      input: document.getElementById("subject"),
      error: document.getElementById("subject-error"),
      validate: (val) => val.trim().length >= 3 ? "" : "Vui lòng nhập chủ đề (ít nhất 3 ký tự)."
    },
    message: {
      input: document.getElementById("message"),
      error: document.getElementById("message-error"),
      validate: (val) => val.trim().length >= 10 ? "" : "Nội dung tin nhắn phải từ 10 ký tự trở lên."
    }
  };

  // Real-time inline validation on blur / input
  Object.keys(fields).forEach(key => {
    const field = fields[key];
    
    field.input.addEventListener("blur", () => {
      validateSingleField(key);
    });

    field.input.addEventListener("input", () => {
      if (field.input.classList.contains("invalid")) {
        validateSingleField(key);
      }
    });
  });

  function validateSingleField(key) {
    const field = fields[key];
    const errorMessage = field.validate(field.input.value);

    if (errorMessage) {
      field.input.classList.add("invalid");
      field.input.setAttribute("aria-invalid", "true");
      field.error.textContent = errorMessage;
      return false;
    } else {
      field.input.classList.remove("invalid");
      field.input.removeAttribute("aria-invalid");
      field.error.textContent = "";
      return true;
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // Form submission handler with async state simulation
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Validate all fields
    let isFormValid = true;
    Object.keys(fields).forEach(key => {
      const isValid = validateSingleField(key);
      if (!isValid) isFormValid = false;
    });

    if (!isFormValid) {
      showStatus("Vui lòng kiểm tra và sửa các lỗi phía trên trước khi gửi.", "error");
      return;
    }

    // Set Loading State
    setSubmittingState(true);
    showStatus("", "");

    // Simulate Network Request (1.2s delay)
    setTimeout(() => {
      setSubmittingState(false);
      showStatus("✓ Tin nhắn của bạn đã được gửi thành công! Tôi sẽ phản hồi sớm nhất có thể.", "success");
      
      // Reset form input values & state
      contactForm.reset();
      Object.keys(fields).forEach(key => {
        fields[key].input.classList.remove("invalid");
        fields[key].input.removeAttribute("aria-invalid");
        fields[key].error.textContent = "";
      });
    }, 1200);
  });

  function setSubmittingState(isLoading) {
    if (isLoading) {
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-text").textContent = "Đang gửi...";
    } else {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
      submitBtn.querySelector(".btn-text").textContent = "Gửi Tin Nhắn";
    }
  }

  function showStatus(msg, statusType) {
    formStatus.className = "form-status";
    if (!msg) {
      formStatus.style.display = "none";
      formStatus.textContent = "";
      return;
    }
    formStatus.classList.add(statusType);
    formStatus.textContent = msg;
    formStatus.style.display = "block";
  }
});