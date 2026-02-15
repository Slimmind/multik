import { IconMoon } from "../../icons/icon-moon";
import { IconSun } from "../../icons/icon-sun";
import { t } from "../../locales/i18n";

import "./header.styles.css";

interface HeaderProps {
    isDarkTheme: boolean;
    toggleTheme: () => void;
}

export const Header = ({ isDarkTheme, toggleTheme }: HeaderProps) => {
  return (
    <header className="header">
      <h2>{t('app.title')}</h2>
      <button id="themeToggle" className="theme-toggle" aria-label={t('app.title')} onClick={toggleTheme}>
        {isDarkTheme ? (
            <IconMoon />
        ) : (
            <IconSun />
        )}
      </button>
    </header>
  )
}