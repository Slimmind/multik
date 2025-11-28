export class ThemeManager {
  constructor() {
    this.toggleBtn = document.getElementById('themeToggle');
    this.sunIcon = this.toggleBtn.querySelector('.sun-icon');
    this.moonIcon = this.toggleBtn.querySelector('.moon-icon');
    this.init();
  }

  init() {
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
      document.body.classList.add('dark-mode');
      this.updateIcons(true);
    }

    this.toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      this.updateIcons(isDark);
    });
  }

  updateIcons(isDark) {
    if (isDark) {
      this.sunIcon.style.display = 'none';
      this.moonIcon.style.display = 'block';
    } else {
      this.sunIcon.style.display = 'block';
      this.moonIcon.style.display = 'none';
    }
  }
}
