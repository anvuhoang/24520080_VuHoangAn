document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. Skip-Link Programmatic Focus Shift (WCAG 2.4.1 & 2.4.3)
  // ==========================================================================
  const skipLink = document.querySelector(".skip-link");
  const mainContent = document.getElementById("main-content");

  if (skipLink && mainContent) {
    skipLink.addEventListener("click", () => {
      mainContent.focus();
    });
  }

  // ==========================================================================
  // 2. Theme Switcher Component & State Handling
  // ==========================================================================
  const themeToggleBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const themeText = document.getElementById("theme-text");

  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem("app-theme") || "dark";
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);

    const isDark = theme === "dark";

    if (themeToggleBtn && themeIcon && themeText) {
      themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
      themeIcon.textContent = isDark ? "🌙" : "☀️";
      themeText.textContent = isDark ? "Dark Mode" : "Light Mode";
    }
  }

  // ==========================================================================
  // 3. Mobile Navigation Drawer & Keyboard Trap Prevention (WCAG 2.1.2 & 2.4.3)
  // ==========================================================================
  const menuToggleBtn = document.getElementById("menu-toggle");
  const mainNav = document.getElementById("main-nav");
  const navLinks = mainNav ? mainNav.querySelectorAll(".nav-link") : [];

  if (menuToggleBtn && mainNav) {
    menuToggleBtn.addEventListener("click", () => {
      const isExpanded = menuToggleBtn.getAttribute("aria-expanded") === "true";
      if (isExpanded) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close menu when clicking any nav link and restore natural flow
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        if (mainNav.classList.contains("nav-open")) {
          closeMobileMenu(false); // Close without refocusing toggle so user jumps to target
        }
      });
    });

    // Focus trap & Escape key handler for mobile navigation
    mainNav.addEventListener("keydown", (e) => {
      if (!mainNav.classList.contains("nav-open")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeMobileMenu(true);
        return;
      }

      if (e.key === "Tab") {
        const focusableNavItems = [menuToggleBtn, ...navLinks];
        const firstItem = focusableNavItems[0];
        const lastItem = focusableNavItems[focusableNavItems.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstItem) {
            e.preventDefault();
            lastItem.focus();
          }
        } else {
          if (document.activeElement === lastItem) {
            e.preventDefault();
            firstItem.focus();
          }
        }
      }
    });
  }

  function openMobileMenu() {
    menuToggleBtn.setAttribute("aria-expanded", "true");
    mainNav.classList.add("nav-open");
    if (navLinks.length > 0) {
      navLinks[0].focus();
    }
  }

  function closeMobileMenu(restoreFocus = true) {
    menuToggleBtn.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("nav-open");
    if (restoreFocus) {
      menuToggleBtn.focus();
    }
  }

  // ==========================================================================
  // 4. Project Cards Filtering with WAI-ARIA Roving Tabindex & APG Keyboard Navigation
  // ==========================================================================
  const filterBar = document.querySelector(".filter-bar");
  const filterBtns = Array.from(document.querySelectorAll(".filter-btn"));
  const projectCards = document.querySelectorAll(".project-card");

  if (filterBar && filterBtns.length > 0) {
    // Arrow Key Navigation for Tablist (WAI-ARIA Tabs Pattern)
    filterBar.addEventListener("keydown", (e) => {
      const currentIndex = filterBtns.indexOf(document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % filterBtns.length;
        activateTab(nextIndex, true);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + filterBtns.length) % filterBtns.length;
        activateTab(nextIndex, true);
      } else if (e.key === "Home") {
        e.preventDefault();
        activateTab(0, true);
      } else if (e.key === "End") {
        e.preventDefault();
        activateTab(filterBtns.length - 1, true);
      }
    });

    // Click handler for tab buttons
    filterBtns.forEach((btn, index) => {
      btn.addEventListener("click", () => {
        activateTab(index, false);
      });
    });
  }

  function activateTab(index, shouldFocus = false) {
    const selectedBtn = filterBtns[index];
    const filterValue = selectedBtn.getAttribute("data-filter");

    // Check if active element inside a project card would be hidden
    const activeEl = document.activeElement;
    const isFocusInsideHiddenCard = Array.from(projectCards).some(card => {
      const category = card.getAttribute("data-category");
      const willBeHidden = filterValue !== "all" && category !== filterValue;
      return willBeHidden && card.contains(activeEl);
    });

    // Update roving tabindex & aria-selected
    filterBtns.forEach((btn, i) => {
      if (i === index) {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        btn.setAttribute("tabindex", "0");
        if (shouldFocus) btn.focus();
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
        btn.setAttribute("tabindex", "-1");
      }
    });

    // Filter project cards
    projectCards.forEach(card => {
      const category = card.getAttribute("data-category");
      if (filterValue === "all" || category === filterValue) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });

    // Focus Loss Prevention: redirect focus to active tab if focused card was hidden
    if (isFocusInsideHiddenCard) {
      selectedBtn.focus();
    }
  }

  // ==========================================================================
  // 5. Accessible Project Detail Modal with Strict Focus Containment & Restoration
  // ==========================================================================
  const modalBackdrop = document.getElementById("project-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalDesc = document.getElementById("modal-desc");
  const modalTechStack = document.getElementById("modal-tech-stack");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalActionBtn = document.getElementById("modal-action-btn");
  const detailBtns = document.querySelectorAll(".card-detail-btn");

  let lastFocusedTrigger = null;

  const projectDetailsData = {
    pipeline: {
      title: "Distributed ETL Pipeline Engine",
      desc: "Hệ thống xử lý và chuẩn hóa dữ liệu phân tán tự động xây dựng trên nền tảng PySpark và Apache Airflow. Chịu tải 50M+ bản ghi mỗi ngày với cơ chế idempotency, retry thông minh và kiểm định chất lượng dữ liệu thời gian thực.",
      stack: ["PySpark", "Apache Airflow", "PostgreSQL", "Docker", "Great Expectations"]
    },
    streaming: {
      title: "Real-time CDC Streaming Bus",
      desc: "Hạ tầng đồng bộ và phân tích dữ liệu giao dịch thời gian thực từ nhiều cơ sở dữ liệu nguồn sử dụng Kafka Connect (Debezium) và Apache Flink với độ trễ xử lý sub-second (dưới 1 giây).",
      stack: ["Apache Kafka", "Apache Flink", "Debezium", "Elasticsearch", "Grafana"]
    },
    lakehouse: {
      title: "Enterprise Data Lakehouse",
      desc: "Mô hình hóa dữ liệu theo kiến trúc Medallion (Bronze-Silver-Gold) trên Snowflake và dbt. Hỗ trợ truy vấn SQL tốc độ cao và tự động hóa testing schema/dữ liệu cho báo cáo BI quy mô lớn.",
      stack: ["Snowflake", "dbt", "Apache Iceberg", "Delta Lake", "BigQuery"]
    },
    dataops: {
      title: "Automated DataOps Platform",
      desc: "Nền tảng kiểm định chất lượng dữ liệu tự động, phát hiện trôi dạt lược đồ (schema drift) và cảnh báo tức thời qua Slack/PagerDuty, tích hợp sâu vào CI/CD GitHub Actions.",
      stack: ["Great Expectations", "Python", "CI/CD", "Terraform", "Docker"]
    }
  };

  if (modalBackdrop) {
    detailBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const projectKey = btn.getAttribute("data-project");
        openProjectModal(projectKey, btn);
      });
    });

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", closeProjectModal);
    }

    if (modalActionBtn) {
      modalActionBtn.addEventListener("click", closeProjectModal);
    }

    // Backdrop click dismissal
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        closeProjectModal();
      }
    });

    // Keyboard Focus Trap & Escape key listener
    modalBackdrop.addEventListener("keydown", (e) => {
      if (!modalBackdrop.classList.contains("modal-open")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeProjectModal();
        return;
      }

      if (e.key === "Tab") {
        const focusableModalElements = modalBackdrop.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableModalElements[0];
        const lastFocusable = focusableModalElements[focusableModalElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    });
  }

  function openProjectModal(projectKey, triggerElement) {
    const data = projectDetailsData[projectKey];
    if (!data) return;

    lastFocusedTrigger = triggerElement;

    modalTitle.textContent = data.title;
    modalDesc.textContent = data.desc;

    // Render badges
    modalTechStack.innerHTML = "";
    data.stack.forEach(tech => {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = tech;
      modalTechStack.appendChild(span);
    });

    modalBackdrop.classList.add("modal-open");
    modalBackdrop.setAttribute("aria-hidden", "false");

    // Move focus inside dialog immediately
    modalCloseBtn.focus();
  }

  function closeProjectModal() {
    modalBackdrop.classList.remove("modal-open");
    modalBackdrop.setAttribute("aria-hidden", "true");

    // Restore focus to triggering button (WCAG 2.4.3)
    if (lastFocusedTrigger) {
      lastFocusedTrigger.focus();
      lastFocusedTrigger = null;
    }
  }

  // ==========================================================================
  // 6. Contact Form Client-side State & Validation Handler
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
    if (!field.input) return;

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
    if (!field || !field.input) return true;
    const errorMessage = field.validate(field.input.value);

    if (errorMessage) {
      field.input.classList.add("invalid");
      field.input.setAttribute("aria-invalid", "true");
      if (field.error) field.error.textContent = errorMessage;
      return false;
    } else {
      field.input.classList.remove("invalid");
      field.input.removeAttribute("aria-invalid");
      if (field.error) field.error.textContent = "";
      return true;
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // Form submission handler with async state simulation
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();

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

        contactForm.reset();
        Object.keys(fields).forEach(key => {
          if (fields[key].input) {
            fields[key].input.classList.remove("invalid");
            fields[key].input.removeAttribute("aria-invalid");
          }
          if (fields[key].error) {
            fields[key].error.textContent = "";
          }
        });
      }, 1200);
    });
  }

  function setSubmittingState(isLoading) {
    if (!submitBtn) return;
    if (isLoading) {
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      const btnText = submitBtn.querySelector(".btn-text");
      if (btnText) btnText.textContent = "Đang gửi...";
    } else {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
      const btnText = submitBtn.querySelector(".btn-text");
      if (btnText) btnText.textContent = "Gửi Tin Nhắn";
    }
  }

  function showStatus(msg, statusType) {
    if (!formStatus) return;
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