import "./footer.styles.css";
import { VERSION } from "../../version";
import { t } from "../../locales/i18n";

export const Footer = () => {
  return (
    <footer className="footer">
        <small className="copyright">
          slimmind &copy; {new Date().getFullYear()} Multik. {t('app.footer.rights')}
        </small>
        <small className="semver">
          v{VERSION}
        </small>
    </footer>
  )
}